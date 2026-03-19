-- V3 Migration: Rename tables to match plural JPA entity mappings

ALTER TABLE folder RENAME TO folders;
ALTER TABLE tag RENAME TO tags;
ALTER TABLE shared_link RENAME TO shared_links;
-- link_access intentionally left as link_access assuming no plural entity mapping, let me double check entity
ALTER TABLE highlight RENAME TO highlights;
ALTER TABLE comment RENAME TO comments;
ALTER TABLE highlight_tag RENAME TO highlight_tags;
ALTER TABLE resource_permission RENAME TO resource_permissions;
ALTER TABLE user_shared_view RENAME TO user_shared_views;
ALTER TABLE notification RENAME TO notifications;
ALTER TABLE batched_email_event RENAME TO batched_email_events;
ALTER TABLE extension_token RENAME TO extension_tokens;
