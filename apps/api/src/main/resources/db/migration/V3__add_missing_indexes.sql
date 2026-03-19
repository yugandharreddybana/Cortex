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
