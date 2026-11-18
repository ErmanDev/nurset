-- Clinical instructor tools. Group-level items (assignments, requirements,
-- instructions) fan out to per-student rows so the student pages keep
-- working unchanged; deleting the group-level item removes its copies.

-- Duty Assignments ------------------------------------------------------------
CREATE TABLE duty_assignments (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    group_id       BIGINT NOT NULL REFERENCES clinical_groups (id) ON DELETE CASCADE,
    area           TEXT NOT NULL,
    hospital       TEXT NOT NULL,
    location       TEXT,
    duty_date      DATE NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX duty_assignments_instructor_idx ON duty_assignments (instructor_id, duty_date DESC);
CREATE TRIGGER duty_assignments_updated_at BEFORE UPDATE ON duty_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE duties ADD COLUMN assignment_id BIGINT REFERENCES duty_assignments (id) ON DELETE CASCADE;
CREATE INDEX duties_assignment_idx ON duties (assignment_id);

-- Requirements ------------------------------------------------------------------
CREATE TABLE requirement_assignments (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    group_id       BIGINT NOT NULL REFERENCES clinical_groups (id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    due_date       DATE NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX requirement_assignments_instructor_idx ON requirement_assignments (instructor_id, due_date);

ALTER TABLE requirements ADD COLUMN assignment_id BIGINT REFERENCES requirement_assignments (id) ON DELETE CASCADE;
CREATE INDEX requirements_assignment_idx ON requirements (assignment_id);

-- Reviews
ALTER TABLE documents ADD COLUMN reviewer_id BIGINT REFERENCES users (id) ON DELETE SET NULL;

-- Instructions (delivered as CI notes) ------------------------------------------
CREATE TABLE ci_instructions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    group_id       BIGINT REFERENCES clinical_groups (id) ON DELETE CASCADE,
    student_id     BIGINT REFERENCES users (id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    content        TEXT NOT NULL,
    clinical_area  TEXT,
    note_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    is_important   BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ci_instructions_one_audience CHECK ((group_id IS NULL) <> (student_id IS NULL))
);
CREATE INDEX ci_instructions_instructor_idx ON ci_instructions (instructor_id, created_at DESC);

ALTER TABLE ci_notes ADD COLUMN instruction_id BIGINT REFERENCES ci_instructions (id) ON DELETE CASCADE;
CREATE INDEX ci_notes_instruction_idx ON ci_notes (instruction_id);

-- Duty Day: attendance -----------------------------------------------------------
CREATE TABLE duty_attendance (
    duty_id      BIGINT PRIMARY KEY REFERENCES duties (id) ON DELETE CASCADE,
    status       TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
    time_in      TIME,
    remarks      TEXT,
    recorded_by  BIGINT REFERENCES users (id) ON DELETE SET NULL,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evaluations & confirmed hours ----------------------------------------------------
CREATE TABLE duty_evaluations (
    duty_id           BIGINT PRIMARY KEY REFERENCES duties (id) ON DELETE CASCADE,
    evaluator_id      BIGINT REFERENCES users (id) ON DELETE SET NULL,
    knowledge         INTEGER NOT NULL CHECK (knowledge BETWEEN 1 AND 5),
    skills            INTEGER NOT NULL CHECK (skills BETWEEN 1 AND 5),
    professionalism   INTEGER NOT NULL CHECK (professionalism BETWEEN 1 AND 5),
    communication     INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
    comments          TEXT,
    verified_minutes  INTEGER NOT NULL CHECK (verified_minutes BETWEEN 0 AND 1440),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER duty_evaluations_updated_at BEFORE UPDATE ON duty_evaluations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Announcements: author_id NULL = school-wide; group_id NULL = all of the author's groups.
ALTER TABLE announcements
    ADD COLUMN author_id BIGINT REFERENCES users (id) ON DELETE CASCADE,
    ADD COLUMN group_id BIGINT REFERENCES clinical_groups (id) ON DELETE CASCADE;
CREATE INDEX announcements_author_idx ON announcements (author_id);
