package com.cortex.api.dto;

/**
 * Generic error response DTO used by GlobalExceptionHandler for all non-success API responses.
 * Using this instead of AuthResponse avoids leaking null token/user fields in error payloads.
 */
public record ErrorResponse(boolean success, String error) {

    /**
     * Convenience factory method for failure responses.
     * Usage: ErrorResponse.of("Something went wrong")
     */
    public static ErrorResponse of(String message) {
        return new ErrorResponse(false, message);
    }
}
