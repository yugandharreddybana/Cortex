package com.cortex.api.entity;

import java.io.Serializable;
import java.util.Objects;

/**
 * Composite key for HighlightTag junction table.
 */
public class HighlightTagId implements Serializable {
    
    private Long highlight;
    private Long tag;

    public HighlightTagId() {}

    public HighlightTagId(Long highlight, Long tag) {
        this.highlight = highlight;
        this.tag = tag;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        HighlightTagId that = (HighlightTagId) o;
        return Objects.equals(highlight, that.highlight) && Objects.equals(tag, that.tag);
    }

    @Override
    public int hashCode() {
        return Objects.hash(highlight, tag);
    }

    public Long getHighlight() { return highlight; }
    public void setHighlight(Long highlight) { this.highlight = highlight; }

    public Long getTag() { return tag; }
    public void setTag(Long tag) { this.tag = tag; }
}
