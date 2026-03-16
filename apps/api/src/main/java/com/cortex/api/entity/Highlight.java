package com.cortex.api.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "highlights")
public class Highlight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String source = "";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String url = "";

    @Column(columnDefinition = "TEXT")
    private String topic;
    private String topicColor;

    @Column(name = "saved_at", nullable = false)
    private String savedAt;

    @Column(name = "folder_id")
    private Long folderId;

    /**
     * Many-to-One: The folder containing this highlight.
     * Nullable: highlights can exist at the root level (folder_id = null).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id", insertable = false, updatable = false)
    private Folder folder;

    @Column(columnDefinition = "TEXT")
    private String note;

    // Many-to-Many relationship to tags via HighlightTag junction table
    @OneToMany(mappedBy = "highlight", cascade = CascadeType.REMOVE, fetch = FetchType.LAZY)
    private Set<HighlightTag> highlightTags = new HashSet<>();

    @Column(name = "is_code")
    private boolean isCode;

    @Column(name = "is_favorite")
    private boolean isFavorite;

    @Column(name = "is_archived")
    private boolean isArchived;

    @Column(name = "is_pinned")
    private boolean isPinned;

    @Column(name = "highlight_color")
    private String highlightColor;

    // AI-specific fields
    @Column(name = "is_ai")
    private boolean isAI;

    @Column(name = "chat_name", columnDefinition = "TEXT")
    private String chatName;

    @Column(name = "chat_url", columnDefinition = "TEXT")
    private String chatUrl;

    /**
     * One-to-Many: all comments on this highlight.
     */
    @OneToMany(mappedBy = "highlight", cascade = CascadeType.REMOVE, fetch = FetchType.LAZY)
    private Set<Comment> comments = new HashSet<>();

    // ── Video / YouTube fields ──
    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false)
    private ResourceType resourceType = ResourceType.TEXT;

    @Column(name = "video_timestamp")
    private Integer videoTimestamp;

    // ── Access control ──
    @Enumerated(EnumType.STRING)
    @Column(name = "link_access", nullable = false)
    private LinkAccess linkAccess = LinkAccess.RESTRICTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "default_link_role", nullable = false)
    private AccessLevel defaultLinkRole = AccessLevel.VIEWER;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * Soft deletion flag: true if this highlight has been deleted by the user.
     * Deleted highlights are NOT returned in any API queries, but the record remains
     * in the database for potential future restore operations.
     */
    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    /**
     * ID of the user who deleted this highlight (audit trail).
     * NULL if the highlight has not been deleted.
     */
    @Column(name = "deleted_by_user_id")
    private Long deletedByUserId;

    /**
     * Timestamp when this highlight was deleted.
     * NULL if the highlight has not been deleted.
     */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
        if (savedAt == null) savedAt = Instant.now().toString();
    }

    // ── Getters & Setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getTopicColor() { return topicColor; }
    public void setTopicColor(String topicColor) { this.topicColor = topicColor; }

    public String getSavedAt() { return savedAt; }
    public void setSavedAt(String savedAt) { this.savedAt = savedAt; }

    public Long getFolderId() { return folderId; }
    public void setFolderId(Long folderId) { this.folderId = folderId; }

    public Folder getFolder() { return folder; }
    public void setFolder(Folder folder) { this.folder = folder; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Set<HighlightTag> getHighlightTags() { return highlightTags; }
    public void setHighlightTags(Set<HighlightTag> highlightTags) { this.highlightTags = highlightTags; }

    public Set<Comment> getComments() { return comments; }
    public void setComments(Set<Comment> comments) { this.comments = comments; }

    public boolean isCode() { return isCode; }
    public void setCode(boolean code) { isCode = code; }

    public boolean isFavorite() { return isFavorite; }
    public void setFavorite(boolean favorite) { isFavorite = favorite; }

    public boolean isArchived() { return isArchived; }
    public void setArchived(boolean archived) { isArchived = archived; }

    public boolean isPinned() { return isPinned; }
    public void setPinned(boolean pinned) { isPinned = pinned; }

    public String getHighlightColor() { return highlightColor; }
    public void setHighlightColor(String highlightColor) { this.highlightColor = highlightColor; }

    public boolean isAI() { return isAI; }
    public void setAI(boolean AI) { isAI = AI; }

    public String getChatName() { return chatName; }
    public void setChatName(String chatName) { this.chatName = chatName; }

    public String getChatUrl() { return chatUrl; }
    public void setChatUrl(String chatUrl) { this.chatUrl = chatUrl; }

    public ResourceType getResourceType() { return resourceType; }
    public void setResourceType(ResourceType resourceType) { this.resourceType = resourceType; }

    public Integer getVideoTimestamp() { return videoTimestamp; }
    public void setVideoTimestamp(Integer videoTimestamp) { this.videoTimestamp = videoTimestamp; }

    public LinkAccess getLinkAccess() { return linkAccess; }
    public void setLinkAccess(LinkAccess linkAccess) { this.linkAccess = linkAccess; }

    public AccessLevel getDefaultLinkRole() { return defaultLinkRole; }
    public void setDefaultLinkRole(AccessLevel defaultLinkRole) { this.defaultLinkRole = defaultLinkRole; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }

    public Long getDeletedByUserId() { return deletedByUserId; }
    public void setDeletedByUserId(Long deletedByUserId) { this.deletedByUserId = deletedByUserId; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
