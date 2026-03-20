package com.cortex.api.entity;

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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "folders", uniqueConstraints = {
    @UniqueConstraint(name = "uk_folder_user_parent_name",
            columnNames = {"user_id", "parent_folder_id", "name"})
})
public class Folder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String emoji = "📁";

    /**
     * Self-referential foreign key: links to parent folder.
     * NULL = root-level folder.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_folder_id")
    private Folder parentFolder;

    /**
     * One-to-Many: all child folders (subfolders).
     * Mapped by the parentFolder field in child Folder entities.
     */
    @OneToMany(mappedBy = "parentFolder", fetch = FetchType.LAZY)
    private Set<Folder> childFolders = new HashSet<>();

    /**
     * One-to-Many: highlights in this folder.
     */
    @OneToMany(mappedBy = "folder", fetch = FetchType.LAZY)
    private Set<Highlight> highlights = new HashSet<>();

    @Column(name = "is_pinned")
    private boolean isPinned;

    /**
     * Link access control: how this folder can be shared via public links.
     * Default: RESTRICTED (only via explicit sharing).
     */
    @Column(name = "link_access", nullable = false)
    @Enumerated(EnumType.STRING)
    private LinkAccess linkAccess = LinkAccess.RESTRICTED;

    /**
     * Default access level for public links to this folder.
     * Default: VIEWER (read-only).
     */
    @Column(name = "default_link_role", nullable = false)
    @Enumerated(EnumType.STRING)
    private AccessLevel defaultLinkRole = AccessLevel.VIEWER;

    /**
     * Timestamp when the folder was created.
     */
    @Column(name = "created_at", nullable = true, updatable = false)
    private Instant createdAt = Instant.now();

    /**
     * Timestamp when the folder was last updated.
     */
    @Column(name = "updated_at", nullable = true)
    private Instant updatedAt = Instant.now();

    @Column(columnDefinition = "TEXT")
    private String synthesis;

    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }

    public Folder getParentFolder() { return parentFolder; }
    public void setParentFolder(Folder parentFolder) { this.parentFolder = parentFolder; }

    public Set<Folder> getChildFolders() { return childFolders; }
    public void setChildFolders(Set<Folder> childFolders) { this.childFolders = childFolders; }

    public Set<Highlight> getHighlights() { return highlights; }
    public void setHighlights(Set<Highlight> highlights) { this.highlights = highlights; }

    public boolean isPinned() { return isPinned; }
    public void setPinned(boolean pinned) { isPinned = pinned; }

    public LinkAccess getLinkAccess() { return linkAccess; }
    public void setLinkAccess(LinkAccess linkAccess) { this.linkAccess = linkAccess; }

    public AccessLevel getDefaultLinkRole() { return defaultLinkRole; }
    public void setDefaultLinkRole(AccessLevel defaultLinkRole) { this.defaultLinkRole = defaultLinkRole; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getSynthesis() { return synthesis; }
    public void setSynthesis(String synthesis) { this.synthesis = synthesis; }
}
