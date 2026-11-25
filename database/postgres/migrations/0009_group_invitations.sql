-- Clinical instructors can now register themselves, so a student must accept
-- before an instructor sees any of their records.
--
-- group_memberships holds every membership, including pending invitations.
-- group_members becomes a view of ACCEPTED memberships only, so every query
-- that reads it (instructor pages, duties, reviews, announcements,
-- notifications, ...) ignores pending invitations automatically.

ALTER TABLE group_members RENAME TO group_memberships;
ALTER INDEX group_members_student_idx RENAME TO group_memberships_student_idx;

ALTER TABLE group_memberships
    ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
    ADD COLUMN responded_at TIMESTAMPTZ;

CREATE VIEW group_members AS
    SELECT group_id, student_id, added_at
    FROM group_memberships
    WHERE status = 'active';
