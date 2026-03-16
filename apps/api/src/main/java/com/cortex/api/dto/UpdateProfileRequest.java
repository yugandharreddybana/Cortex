package com.cortex.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 100) String fullName,
        @Email String email,
        @Size(max = 500) String avatarUrl
) {
}
