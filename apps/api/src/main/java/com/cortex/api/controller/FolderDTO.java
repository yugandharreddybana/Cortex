package com.cortex.api.controller;

import com.fasterxml.jackson.annotation.JsonSetter;
import java.time.Instant;

public class FolderDTO {
    public Long id;
    public String name;
    public String emoji;
    public Long parentId;
    public boolean parentIdPresent; // true when JSON explicitly includes "parentId" (even if null)
    public boolean isPinned;
    public String linkAccess;      // RESTRICTED, PUBLIC
    public String defaultLinkRole; // VIEWER, COMMENTER, EDITOR

    // RBAC: the caller's effective role on this folder (OWNER, EDITOR, COMMENTER, VIEWER)
    public String effectiveRole;
    public Long ownerId;

    // Timestamps
    public Instant createdAt;      // When the folder was created
    public Instant updatedAt;      // When the folder was last updated

    public String synthesis;       // AI Feature 3: Generated folder synthesis

    @JsonSetter("parentId")
    public void setParentId(Long parentId) {
        this.parentId = parentId;
        this.parentIdPresent = true;
    }
}