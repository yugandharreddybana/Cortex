-- V11: Create comment_reactions table for WhatsApp-style emoji reactions on comments
-- Supports one reaction per user per comment, including the comment ID and user ID references.

CREATE TABLE IF NOT EXISTS comment_reactions (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    
    -- Target comment being reacted to
    comment_id    BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    
    -- User who made the reaction
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Emoji symbol (stored as UTF-8 string)
    emoji         VARCHAR(255) NOT NULL,
    
    -- WhatsApp-style constraint: One reaction per user per comment
    UNIQUE (comment_id, user_id)
);

-- Index for optimized reaction retrieval by comment ID
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
