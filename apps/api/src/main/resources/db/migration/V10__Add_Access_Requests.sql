-- V10: Add access_requests table for shared folder permission request workflow
-- Allows Viewer-level users to formally request higher access (COMMENTER/EDITOR)
-- from folder owners. The owner can APPROVE or REJECT via notifications.

CREATE TABLE IF NOT EXISTS access_requests (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP(6) WITH TIME ZONE,

    -- Who is requesting access
    requester_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Who owns the folder (and must approve/reject)
    owner_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Target folder
    folder_id     BIGINT NOT NULL,

    -- Requested role: VIEWER, COMMENTER, EDITOR, OWNER (stored as string via @EnumType.STRING)
    requested_level VARCHAR(16) NOT NULL,

    -- Lifecycle: PENDING, APPROVED, REJECTED (stored as string for clarity)
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING'
);

-- Index to quickly look up pending requests for a given owner (notification inbox)
CREATE INDEX IF NOT EXISTS idx_access_requests_owner_status
    ON access_requests(owner_id, status);

-- Index to prevent duplicate pending requests from the same requester per folder
CREATE INDEX IF NOT EXISTS idx_access_requests_requester_folder_status
    ON access_requests(requester_id, folder_id, status);
