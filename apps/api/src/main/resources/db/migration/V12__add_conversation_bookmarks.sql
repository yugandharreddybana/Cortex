-- ──────────────────────────────────────────────────────────────────────────
-- V12: Conversation Bookmark plugin
--
-- Creates the `conversation_bookmarks` table that stores user-created anchors
-- pointing to a specific text selection inside an AI conversation highlight.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_bookmarks (

    -- PK
    id               BIGSERIAL PRIMARY KEY,

    -- Owner
    user_id          BIGINT       NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    -- Parent AI conversation highlight
    highlight_id     BIGINT       NOT NULL
        REFERENCES highlights(id) ON DELETE CASCADE,

    -- Logical message/turn identifier (optional, client-supplied)
    message_id       VARCHAR(255),

    -- Text range anchor
    selected_text    TEXT         NOT NULL,
    start_offset     INT,
    end_offset       INT,
    quote_snippet    VARCHAR(200),

    -- User-facing metadata
    label            VARCHAR(120),
    color            VARCHAR(20)  NOT NULL DEFAULT '#FFD700',
    note             TEXT,

    -- Auditing
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Soft delete
    is_deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at       TIMESTAMPTZ
);

-- Retrieve all bookmarks for a user (bookmark panel listing)
CREATE INDEX IF NOT EXISTS idx_conv_bm_user_id
    ON conversation_bookmarks (user_id)
    WHERE is_deleted = FALSE;

-- Retrieve bookmarks scoped to a single AI highlight
CREATE INDEX IF NOT EXISTS idx_conv_bm_highlight_id
    ON conversation_bookmarks (highlight_id)
    WHERE is_deleted = FALSE;

-- Fast lookup of a single bookmark by (id, user) for ownership checks
CREATE INDEX IF NOT EXISTS idx_conv_bm_id_user
    ON conversation_bookmarks (id, user_id)
    WHERE is_deleted = FALSE;

COMMENT ON TABLE conversation_bookmarks IS
    'User-created text-selection anchors within AI conversation highlights.';
