package com.cortex.api.entity;
 
import jakarta.persistence.*;
import java.time.Instant;
 
/**
 * CommentReaction entity: Represents an emoji reaction to a specific comment.
 * WhatsApp-style: one reaction per user per comment.
 */
@Entity
@Table(name = "comment_reactions", 
       uniqueConstraints = {@UniqueConstraint(columnNames = {"comment_id", "user_id"})})
public class CommentReaction {
 
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
 
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "comment_id", nullable = false)
    private Comment comment;
 
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
 
    @Column(nullable = false)
    private String emoji;
 
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
 
    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
 
    // Getters & Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
 
    public Comment getComment() { return comment; }
    public void setComment(Comment comment) { this.comment = comment; }
 
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
 
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
 
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
