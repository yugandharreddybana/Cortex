CREATE TABLE IF NOT EXISTS hidden_highlights (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    highlight_id BIGINT REFERENCES highlights(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, highlight_id)
);
