package com.cortex.api.dto;

public record UserResponseDTO(Long id, String email, String fullName, String avatarUrl, String tier, java.time.Instant createdAt) {
}
