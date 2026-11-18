-- Notifications are built on the fly from duties, requirements, reviews,
-- announcements, etc. (see src-tauri/src/commands/notifications.rs). This
-- table only remembers which ones each user has already read, by a stable key
-- such as 'duty-assigned:42' or 'doc:17:approved'.
CREATE TABLE notification_reads (
    user_id  BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
);
