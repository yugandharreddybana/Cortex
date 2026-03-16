package com.cortex.api.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.io.Serializable;

/**
 * Junction table for Many-to-Many relationship between Highlight and Tag.
 * Ensures data integrity: only valid tags (belonging to the user owning the highlight)
 * can be associated with highlights.
 */
@Entity
@Table(name = "highlight_tags")
@IdClass(HighlightTagId.class)
public class HighlightTag implements Serializable {

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "highlight_id", nullable = false)
    private Highlight highlight;

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    public HighlightTag() {}

    public HighlightTag(Highlight highlight, Tag tag) {
        this.highlight = highlight;
        this.tag = tag;
    }

    public Highlight getHighlight() { return highlight; }
    public void setHighlight(Highlight highlight) { this.highlight = highlight; }

    public Tag getTag() { return tag; }
    public void setTag(Tag tag) { this.tag = tag; }
}
