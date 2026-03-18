-- =========================================================================
-- MASTER LOG OF DATABASE QUERIES
-- =========================================================================
-- This file contains all the historical SQL commands executed in this project.
-- DO NOT RUN this entire file directly if your database already has data.
-- Use the Flyway migrations in 'src/main/resources/db/migration' to update the schema automatically.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Initial Schema setup (Base generation from JPA entities)
-- Executed via Hibernate auto-DDL previously, now tracked as V1 Migration.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_hash VARCHAR(64) NOT NULL UNIQUE,
    encrypted_email VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS folder (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES folder(id) ON DELETE SET NULL,
    color VARCHAR(255) DEFAULT 'gray'
);

CREATE TABLE IF NOT EXISTS tag (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    name VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color VARCHAR(255) DEFAULT 'gray'
);

CREATE TABLE IF NOT EXISTS shared_link (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    resource_id UUID NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    access_level VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE,
    password_hash VARCHAR(255),
    max_uses INTEGER,
    uses INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS link_access (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    shared_link_id UUID NOT NULL REFERENCES shared_link(id) ON DELETE CASCADE,
    ip_address VARCHAR(255),
    user_agent VARCHAR(255),
    accessed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS highlight (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    content TEXT NOT NULL,
    source_url VARCHAR(255),
    page_title VARCHAR(255),
    color VARCHAR(255) DEFAULT 'yellow',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folder(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comment (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    content TEXT NOT NULL,
    highlight_id UUID NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comment(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS highlight_tag (
    highlight_id UUID NOT NULL REFERENCES highlight(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (highlight_id, tag_id)
);

CREATE TABLE IF NOT EXISTS resource_permission (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    resource_id UUID NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_shared_view (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    last_accessed_at TIMESTAMP(6) WITH TIME ZONE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS notification (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(255) NOT NULL,
    resource_id UUID,
    resource_type VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS batched_email_event (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(255) NOT NULL,
    resource_id UUID,
    resource_type VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS extension_token (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP(6) WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);


-- -------------------------------------------------------------------------
-- Update: Add subscription_status to users table
-- Flyway Migration: V2__add_subscription_status_to_users.sql
-- Reason: To store Stripe subscription tiers. Executed to replace Hibernate auto-update timeout.
-- -------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(255);
