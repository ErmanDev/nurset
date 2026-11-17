-- NurSet PostgreSQL schema (hosted, multi-user). Target: PostgreSQL 16+ (Render).
--
-- Equivalent to database/sqlite/migrations 001–010 (the single-user desktop
-- database), with these deliberate differences:
--   * multi-user: `profile` became `users`; every personal table has user_id
--   * cross-table links are tenant-safe: composite foreign keys on
--     (user_id, id) make it impossible to link to another user's rows
--   * real types: DATE / TIME / TIMESTAMPTZ / BOOLEAN / TEXT[] / JSONB
--   * files: `storage_key` (object storage / disk key) instead of a local path
--   * per-user material bookmarks; materials can be shared with classmates
--   * auth support: password hash + password reset codes (Forgot Password)
--
-- Applied by database/postgres/scripts/migrate.mjs (or `psql -f`).

CREATE EXTENSION IF NOT EXISTS citext;

-- Keeps updated_at current on every UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- ===================================================================
-- Accounts
-- ===================================================================

CREATE TABLE users (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email              CITEXT NOT NULL UNIQUE,
    password_hash      TEXT,                 -- argon2id/bcrypt; NULL until set
    email_verified_at  TIMESTAMPTZ,
    full_name          TEXT NOT NULL,
    display_name       TEXT NOT NULL,
    role               TEXT NOT NULL DEFAULT 'Nursing Student',
    university         TEXT,
    student_id         TEXT,
    year_level         TEXT,
    avatar_url         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Forgot Password: one-time codes, stored hashed.
CREATE TABLE password_reset_codes (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    attempts    INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_codes_user_idx ON password_reset_codes (user_id, created_at DESC);

-- Key/value preferences (Settings page), per user.
CREATE TABLE user_settings (
    user_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key      TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 64),
    value    TEXT NOT NULL CHECK (length(value) <= 4000),
    PRIMARY KEY (user_id, key)
);

-- ===================================================================
-- Duty Schedule
-- ===================================================================

CREATE TABLE duties (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    area                 TEXT NOT NULL,          -- e.g. Medical Ward
    hospital             TEXT NOT NULL,
    location             TEXT,                   -- e.g. 3rd Floor - Medical Ward
    duty_date            DATE NOT NULL,
    start_time           TIME NOT NULL,
    end_time             TIME NOT NULL,          -- earlier than start = overnight shift
    clinical_instructor  TEXT,
    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, id)                         -- target for tenant-safe FKs
);
CREATE INDEX duties_user_date_idx ON duties (user_id, duty_date);
CREATE TRIGGER duties_updated_at BEFORE UPDATE ON duties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Calendar events that aren't duties (exams, return demos, ...).
CREATE TABLE events (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    event_type   TEXT NOT NULL DEFAULT 'other' CHECK (event_type IN ('exam', 'other')),
    event_date   DATE NOT NULL,
    start_time   TIME,
    end_time     TIME,
    location     TEXT,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_user_date_idx ON events (user_id, event_date);

-- ===================================================================
-- Requirements + Document Review
-- ===================================================================

CREATE TABLE requirements (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    due_date     DATE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'in_progress', 'submitted')),
    color        TEXT NOT NULL DEFAULT 'blue',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, id)
);
CREATE INDEX requirements_user_due_idx ON requirements (user_id, due_date);
CREATE TRIGGER requirements_updated_at BEFORE UPDATE ON requirements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE documents (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    requirement_id  BIGINT,
    title           TEXT,
    document_type   TEXT,
    notes           TEXT,
    file_name       TEXT NOT NULL,
    storage_key     TEXT,                    -- where the uploaded file lives
    file_size       BIGINT CHECK (file_size >= 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'under_review', 'approved', 'needs_revision')),
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    feedback        TEXT,
    feedback_at     TIMESTAMPTZ,
    reviewed_by     TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, requirement_id) REFERENCES requirements (user_id, id)
        ON DELETE SET NULL (requirement_id)
);
CREATE INDEX documents_user_submitted_idx ON documents (user_id, submitted_at DESC);
CREATE INDEX documents_requirement_idx ON documents (requirement_id);
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================================================================
-- Tasks
-- ===================================================================

CREATE TABLE tasks (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    category          TEXT NOT NULL DEFAULT 'Study',
    priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    subject           TEXT,                       -- e.g. Medical-Surgical Nursing
    notes             TEXT,
    duration_minutes  INTEGER CHECK (duration_minutes > 0),
    due_date          DATE NOT NULL,
    due_time          TIME,
    completed         BOOLEAN NOT NULL DEFAULT false,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tasks_completed_at CHECK (completed = (completed_at IS NOT NULL))
);
CREATE INDEX tasks_user_due_idx ON tasks (user_id, due_date);
CREATE INDEX tasks_user_completed_idx ON tasks (user_id, completed_at DESC) WHERE completed;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================================================================
-- Duty Checklist
-- ===================================================================

-- 'bag'      = what to bring, one per duty
-- 'rotation' = preparation reminders, one per rotation area
CREATE TABLE checklists (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'bag' CHECK (kind IN ('bag', 'rotation')),
    duty_id     BIGINT,
    area        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, duty_id) REFERENCES duties (user_id, id) ON DELETE SET NULL (duty_id),
    CONSTRAINT checklists_kind_fields CHECK (
        (kind = 'bag' AND area IS NULL) OR (kind = 'rotation' AND duty_id IS NULL AND area IS NOT NULL)
    )
);
CREATE UNIQUE INDEX checklists_one_bag_per_duty ON checklists (user_id, duty_id)
    WHERE kind = 'bag' AND duty_id IS NOT NULL;
CREATE UNIQUE INDEX checklists_one_rotation_per_area ON checklists (user_id, lower(area))
    WHERE kind = 'rotation';

CREATE TABLE checklist_items (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    checklist_id  BIGINT NOT NULL REFERENCES checklists (id) ON DELETE CASCADE,
    label         TEXT NOT NULL,
    checked       BOOLEAN NOT NULL DEFAULT false,
    position      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX checklist_items_list_idx ON checklist_items (checklist_id, position);

-- "Before you go" checks per duty.
CREATE TABLE duty_readiness (
    duty_id   BIGINT NOT NULL REFERENCES duties (id) ON DELETE CASCADE,
    item_key  TEXT NOT NULL CHECK (item_key IN ('schedule', 'requirements', 'bag', 'ci')),
    checked   BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (duty_id, item_key)
);

-- ===================================================================
-- CI Notes
-- ===================================================================

CREATE TABLE ci_notes (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    content              TEXT NOT NULL,
    clinical_instructor  TEXT,
    clinical_area        TEXT,
    note_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    is_important         BOOLEAN NOT NULL DEFAULT false,
    is_pinned            BOOLEAN NOT NULL DEFAULT false,
    duty_id              BIGINT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (user_id, duty_id) REFERENCES duties (user_id, id) ON DELETE SET NULL (duty_id)
);
CREATE INDEX ci_notes_user_date_idx ON ci_notes (user_id, note_date DESC);
CREATE TRIGGER ci_notes_updated_at BEFORE UPDATE ON ci_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===================================================================
-- AI Study
-- ===================================================================

CREATE TABLE quizzes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    source_notes    TEXT,
    question_types  TEXT[] NOT NULL CHECK (
        cardinality(question_types) > 0
        AND question_types <@ ARRAY['multiple_choice', 'true_false', 'identification', 'case_based']
    ),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    score           INTEGER CHECK (score >= 0)
);
CREATE INDEX quizzes_user_created_idx ON quizzes (user_id, created_at DESC);

-- One attempt per quiz: the answer is stored on the question row.
CREATE TABLE quiz_questions (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quiz_id       BIGINT NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    kind          TEXT NOT NULL
                  CHECK (kind IN ('multiple_choice', 'true_false', 'identification', 'case_based')),
    prompt        TEXT NOT NULL,
    case_text     TEXT,
    image         TEXT,                     -- built-in diagram key, e.g. 'heart:ra'
    choices       JSONB NOT NULL CHECK (jsonb_typeof(choices) = 'array'),
    answer_index  INTEGER NOT NULL CHECK (answer_index >= 0),
    explanation   TEXT,
    hint          TEXT,
    chosen_index  INTEGER CHECK (chosen_index >= 0),
    is_correct    BOOLEAN,
    answered_at   TIMESTAMPTZ,
    UNIQUE (quiz_id, position)
);

CREATE TABLE chat_messages (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    attachment  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_idx ON chat_messages (user_id, id);

CREATE TABLE study_activity (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    subtitle    TEXT,
    kind        TEXT NOT NULL CHECK (kind IN ('review', 'quiz', 'care_plan', 'chat')),
    link        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX study_activity_user_created_idx ON study_activity (user_id, created_at DESC);

-- ===================================================================
-- Quick Links
-- ===================================================================

-- owner_id NULL = NurSet library resource (visible to everyone).
CREATE TABLE materials (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id     BIGINT REFERENCES users (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    kind         TEXT NOT NULL DEFAULT 'pdf_notes'
                 CHECK (kind IN ('pdf_notes', 'presentation', 'reviewer', 'handbook')),
    file_name    TEXT,
    storage_key  TEXT,
    file_size    BIGINT CHECK (file_size >= 0),
    page_count   INTEGER CHECK (page_count >= 0),
    tone         TEXT NOT NULL DEFAULT 'blue',
    is_sample    BOOLEAN NOT NULL DEFAULT false,
    is_shared    BOOLEAN NOT NULL DEFAULT false,     -- shared with classmates
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT materials_handbook_is_private CHECK (kind <> 'handbook' OR NOT is_shared)
);
CREATE INDEX materials_owner_idx ON materials (owner_id, created_at DESC);
CREATE INDEX materials_shared_idx ON materials (created_at DESC) WHERE is_shared;
CREATE UNIQUE INDEX materials_one_handbook_per_owner ON materials (owner_id) WHERE kind = 'handbook';
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE material_bookmarks (
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    material_id  BIGINT NOT NULL REFERENCES materials (id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, material_id)
);

-- School-wide announcements (not per user).
CREATE TABLE announcements (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category    TEXT NOT NULL CHECK (category IN ('important', 'academic', 'reminder')),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    posted_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX announcements_posted_idx ON announcements (posted_at DESC);

CREATE TABLE quick_links (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id   BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    url       TEXT NOT NULL,
    position  INTEGER NOT NULL DEFAULT 0
);

-- ===================================================================
-- Premium (prototype: no payment provider yet)
-- ===================================================================

CREATE TABLE subscriptions (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    plan         TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled')),
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    canceled_at  TIMESTAMPTZ,
    CONSTRAINT subscriptions_canceled_at CHECK ((status = 'canceled') = (canceled_at IS NOT NULL))
);
CREATE UNIQUE INDEX subscriptions_one_active_per_user ON subscriptions (user_id) WHERE status = 'active';

CREATE TABLE receipts (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subscription_id  BIGINT REFERENCES subscriptions (id) ON DELETE SET NULL,
    plan             TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    amount_cents     INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency         CHAR(3) NOT NULL DEFAULT 'PHP',
    method           TEXT NOT NULL CHECK (method IN ('gcash', 'maya', 'card', 'bank', 'other')),
    reference        TEXT NOT NULL UNIQUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX receipts_user_idx ON receipts (user_id, created_at DESC);
