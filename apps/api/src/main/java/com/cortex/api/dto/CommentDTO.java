package com.cortex.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * CommentDTO: Read-only representation of a comment on a highlight.
 * Includes author information and all current reactions.
 */
public record CommentDTO(
    Long id,
    Long highlightId,
    Long authorId,
    String authorEmail,
    String authorFullName,
    String text,
    Instant createdAt,
    List<ReactionDTO> reactions
) {
}
