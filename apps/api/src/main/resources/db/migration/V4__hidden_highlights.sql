CREATE TABLE hidden_highlights (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    highlight_id BIGINT REFERENCES highlight(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, highlight_id)
);
