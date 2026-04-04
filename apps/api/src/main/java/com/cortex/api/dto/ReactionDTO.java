package com.cortex.api.dto;

/**
 * ReactionDTO: Read-only representation of a comment reaction.
 * Used for both REST responses and real-time WebSocket broadcasts.
 */
public record ReactionDTO(Long userId, String userName, String emoji) {
}
