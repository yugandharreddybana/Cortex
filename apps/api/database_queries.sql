-- V1 Initial Schema generated from existing JPA entities

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    tier VARCHAR(255) NOT NULL DEFAULT 'starter',
    email_hash VARCHAR(255) NOT NULL UNIQUE,
    encrypted_email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS folder (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    name VARCHAR(255) NOT NULL,
    emoji VARCHAR(255) NOT NULL DEFAULT '📁',
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    parent_folder_id BIGINT REFERENCES folder(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    link_access SMALLINT NOT NULL DEFAULT 0,
    default_link_role SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tag (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(255) NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shared_link (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    unique_hash VARCHAR(255) NOT NULL UNIQUE,
    resource_type SMALLINT NOT NULL,
    resource_id BIGINT NOT NULL,
    created_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS link_access (
    id BIGSERIAL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS highlight (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    url TEXT NOT NULL,
    topic TEXT,
    topic_color VARCHAR(255),
    saved_at VARCHAR(255) NOT NULL,
    folder_id BIGINT REFERENCES folder(id) ON DELETE SET NULL,
    note TEXT,
    is_code BOOLEAN NOT NULL DEFAULT FALSE,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    highlight_color VARCHAR(255),
    is_ai BOOLEAN NOT NULL DEFAULT FALSE,
    chat_name TEXT,
    chat_url TEXT,
    resource_type SMALLINT NOT NULL DEFAULT 0,
    video_timestamp INTEGER,
    link_access SMALLINT NOT NULL DEFAULT 0,
    default_link_role SMALLINT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by_user_id BIGINT,
    deleted_at TIMESTAMP(6) WITH TIME ZONE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comment (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    text TEXT NOT NULL,
    highlight_id BIGINT REFERENCES highlight(id) ON DELETE CASCADE,
    author_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlight_tag (
    highlight_id BIGINT NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (highlight_id, tag_id)
);

CREATE TABLE IF NOT EXISTS resource_permission (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    resource_id BIGINT NOT NULL,
    resource_type SMALLINT NOT NULL,
    access_level SMALLINT NOT NULL,
    status SMALLINT NOT NULL DEFAULT 0,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_shared_view (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    shared_link_id BIGINT REFERENCES shared_link(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    type VARCHAR(255) NOT NULL DEFAULT 'GENERAL',
    metadata TEXT,
    responded VARCHAR(255),
    actor_id BIGINT,
    action_type VARCHAR(32),
    target_entity_id BIGINT,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batched_email_event (
    id BIGSERIAL PRIMARY KEY,
    folder_id BIGINT NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    action_count INTEGER NOT NULL DEFAULT 1,
    first_action_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    last_action_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMP(6) WITH TIME ZONE,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    editor_id BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS extension_token (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    token TEXT NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------------------
-- Update: Add stripe and subscription columns to users table
-- Flyway Migration: V2__add_subscription_status_to_users.sql
-- -------------------------------------------------------------------------
-- V2 Migration: Add newly added columns to users table
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(255);
-- V3 Add missing indexes for performance optimization

-- Folder table indexes
CREATE INDEX IF NOT EXISTS idx_folder_user_id ON folder(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_parent_folder_id ON folder(parent_folder_id);

-- Tag table index
CREATE INDEX IF NOT EXISTS idx_tag_user_id ON tag(user_id);

-- Shared_link table index
CREATE INDEX IF NOT EXISTS idx_shared_link_created_by_id ON shared_link(created_by_id);
CREATE INDEX IF NOT EXISTS idx_shared_link_resource ON shared_link(resource_type, resource_id);

-- Highlight table indexes
CREATE INDEX IF NOT EXISTS idx_highlight_user_id ON highlight(user_id);
CREATE INDEX IF NOT EXISTS idx_highlight_folder_id ON highlight(folder_id);
CREATE INDEX IF NOT EXISTS idx_highlight_deleted_by_user_id ON highlight(deleted_by_user_id);

-- Comment table indexes
CREATE INDEX IF NOT EXISTS idx_comment_highlight_id ON comment(highlight_id);
CREATE INDEX IF NOT EXISTS idx_comment_author_id ON comment(author_id);

-- Highlight_tag table indexes
-- Note: A primary key automatically creates an index on (highlight_id, tag_id).
-- However, an index on just tag_id is useful when querying highlights by tag.
CREATE INDEX IF NOT EXISTS idx_highlight_tag_tag_id ON highlight_tag(tag_id);

-- Resource_permission table indexes
CREATE INDEX IF NOT EXISTS idx_resource_permission_user_id ON resource_permission(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_permission_resource ON resource_permission(resource_type, resource_id);

-- User_shared_view table indexes
CREATE INDEX IF NOT EXISTS idx_user_shared_view_user_id ON user_shared_view(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shared_view_shared_link_id ON user_shared_view(shared_link_id);

-- Notification table indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notification(is_read);

-- Batched_email_event table indexes
CREATE INDEX IF NOT EXISTS idx_batched_email_event_owner_id ON batched_email_event(owner_id);
CREATE INDEX IF NOT EXISTS idx_batched_email_event_editor_id ON batched_email_event(editor_id);
CREATE INDEX IF NOT EXISTS idx_batched_email_event_processed ON batched_email_event(processed);

-- Extension_token table index
CREATE INDEX IF NOT EXISTS idx_extension_token_user_id ON extension_token(user_id);
