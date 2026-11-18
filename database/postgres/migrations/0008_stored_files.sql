-- Uploaded files (requirement documents, study materials) are stored in the
-- database, so the server works on hosts without a persistent disk and files
-- are included in database backups. documents.storage_key and
-- materials.storage_key hold the `key` of a row here.
CREATE TABLE stored_files (
    key         TEXT PRIMARY KEY,
    data        BYTEA NOT NULL,
    size        BIGINT NOT NULL CHECK (size >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
