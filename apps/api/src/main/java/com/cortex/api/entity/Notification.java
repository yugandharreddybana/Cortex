package com.cortex.api.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(name = "action_url", columnDefinition = "TEXT")
    private String actionUrl;

    @Column(name = "type", nullable = false)
    private String type = "GENERAL";

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "responded")
    private String responded;

    /**
     * UUID of the user who performed the action that triggered this notification.
     * Null for system-generated notifications (e.g., billing alerts).
     */
    @Column(name = "actor_id")
    private Long actorId;

    /**
     * Semantic type of the action: CREATED | EDITED | DELETED | SHARED | COMMENTED.
     * Distinct from {@link #type} which classifies the notification format
     * (GENERAL, SHARE_INVITE, FOLDER_ACTIVITY, …).
     */
    @Column(name = "action_type", length = 32)
    private String actionType;

    /**
     * The primary resource this notification is about (folder ID, highlight ID, etc.).
     * Complements the deep-link in {@link #actionUrl} with a machine-readable reference.
     */
    @Column(name = "target_entity_id")
    private Long targetEntityId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }

    public String getActionUrl() { return actionUrl; }
    public void setActionUrl(String actionUrl) { this.actionUrl = actionUrl; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public String getResponded() { return responded; }
    public void setResponded(String responded) { this.responded = responded; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Long getActorId() { return actorId; }
    public void setActorId(Long actorId) { this.actorId = actorId; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public Long getTargetEntityId() { return targetEntityId; }
    public void setTargetEntityId(Long targetEntityId) { this.targetEntityId = targetEntityId; }
}
