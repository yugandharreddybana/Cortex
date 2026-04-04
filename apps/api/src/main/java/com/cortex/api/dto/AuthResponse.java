package com.cortex.api.dto;

public class AuthResponse {
    private boolean success = true;
    private String error;
    private String token;
    private UserResponseDTO user;

    public AuthResponse() {}

    public AuthResponse(String token, UserResponseDTO user) {
        this.token = token;
        this.user = user;
        this.success = true;
    }

    public AuthResponse(boolean success, String error) {
        this.success = success;
        this.error = error;
    }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public UserResponseDTO getUser() { return user; }
    public void setUser(UserResponseDTO user) { this.user = user; }
}