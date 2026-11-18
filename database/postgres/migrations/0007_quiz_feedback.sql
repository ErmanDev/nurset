-- Feedback on a finished quiz attempt (AI-written or basic), cached so viewing
-- it again doesn't call the AI. Cleared when the quiz is retaken.
ALTER TABLE quizzes
    ADD COLUMN feedback     JSONB,
    ADD COLUMN feedback_at  TIMESTAMPTZ;
