-- V3 Add missing indexes for performance optimization

-- Folders table indexes
CREATE INDEX IF NOT EXISTS idx_folder_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_parent_folder_id ON folders(parent_folder_id);

-- Tags table index
CREATE INDEX IF NOT EXISTS idx_tag_user_id ON tags(user_id);

-- Shared_links table index
CREATE INDEX IF NOT EXISTS idx_shared_link_created_by_id ON shared_links(created_by_id);
CREATE INDEX IF NOT EXISTS idx_shared_link_resource ON shared_links(resource_type, resource_id);

-- Highlights table indexes
CREATE INDEX IF NOT EXISTS idx_highlight_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlight_folder_id ON highlights(folder_id);
CREATE INDEX IF NOT EXISTS idx_highlight_deleted_by_user_id ON highlights(deleted_by_user_id);

-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comment_highlight_id ON comments(highlight_id);
CREATE INDEX IF NOT EXISTS idx_comment_author_id ON comments(author_id);

-- Highlight_tags table indexes
-- Note: A primary key automatically creates an index on (highlight_id, tag_id).
-- However, an index on just tag_id is useful when querying highlights by tag.
CREATE INDEX IF NOT EXISTS idx_highlight_tag_tag_id ON highlight_tags(tag_id);

-- Resource_permissions table indexes
CREATE INDEX IF NOT EXISTS idx_resource_permission_user_id ON resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_permission_resource ON resource_permissions(resource_type, resource_id);

-- User_shared_views table indexes
CREATE INDEX IF NOT EXISTS idx_user_shared_view_user_id ON user_shared_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_shared_view_shared_link_id ON user_shared_views(shared_link_id);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read ON notifications(is_read);

-- Batched_email_events table indexes
CREATE INDEX IF NOT EXISTS idx_batched_email_event_owner_id ON batched_email_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_batched_email_event_editor_id ON batched_email_events(editor_id);
CREATE INDEX IF NOT EXISTS idx_batched_email_event_processed ON batched_email_events(processed);

-- Extension_tokens table index
CREATE INDEX IF NOT EXISTS idx_extension_token_user_id ON extension_tokens(user_id);
