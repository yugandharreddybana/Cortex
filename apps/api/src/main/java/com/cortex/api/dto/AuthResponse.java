package com.cortex.api.dto;

public class AuthResponse {
    private String token;
    private UserResponseDTO user;

    public AuthResponse() {}

    public AuthResponse(String token, UserResponseDTO user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public UserResponseDTO getUser() { return user; }
    public void setUser(UserResponseDTO user) { this.user = user; }
}