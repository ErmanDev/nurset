-- Clinical instructor side: account types, clinical groups, and group members.

ALTER TABLE users
    ADD COLUMN account_type TEXT NOT NULL DEFAULT 'student'
        CHECK (account_type IN ('student', 'clinical_instructor'));

CREATE TABLE clinical_groups (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    instructor_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name           TEXT NOT NULL CHECK (length(btrim(name)) > 0),   -- e.g. BSN 4-A · Group 1
    area           TEXT,                                            -- e.g. Medical Ward
    hospital       TEXT,
    term           TEXT,                                            -- e.g. 1st Sem 2026-2027
    color          TEXT NOT NULL DEFAULT 'blue',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clinical_groups_unique_name ON clinical_groups (instructor_id, lower(name));
CREATE TRIGGER clinical_groups_updated_at BEFORE UPDATE ON clinical_groups
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE group_members (
    group_id    BIGINT NOT NULL REFERENCES clinical_groups (id) ON DELETE CASCADE,
    student_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, student_id)
);
CREATE INDEX group_members_student_idx ON group_members (student_id);
