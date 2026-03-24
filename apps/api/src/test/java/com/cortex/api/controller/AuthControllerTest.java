package com.cortex.api.controller;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.dto.UserResponseDTO;
import com.cortex.api.service.AuthService;
import com.cortex.api.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.security.Principal;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtService jwtService; // Required for JwtAuthFilter

    @MockBean
    private JdbcTemplate jdbcTemplate; // Required by CortexApiApplication bean migrateNameColumn

    @Test
    @DisplayName("POST /api/v1/auth/signup - Success")
    void testSignupSuccess() throws Exception {
        SignupRequest request = new SignupRequest("test@example.com", "password123", "Test User", "starter", null);
        UserResponseDTO userResponse = new UserResponseDTO(1L, "test@example.com", "Test User", "", "starter", Instant.now());
        AuthResponse response = new AuthResponse("token123", userResponse);

        when(authService.signup(any(SignupRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("token123"))
                .andExpect(jsonPath("$.user.email").value("test@example.com"))
                .andExpect(jsonPath("$.user.id").value(1));
    }

    @Test
    @DisplayName("POST /api/v1/auth/signup - Validation Failure")
    void testSignupValidationFailure() throws Exception {
        SignupRequest request = new SignupRequest("invalid-email", "pass", "", "starter", null);

        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/v1/auth/login - Success")
    void testLoginSuccess() throws Exception {
        LoginRequest request = new LoginRequest("test@example.com", "password123");
        UserResponseDTO userResponse = new UserResponseDTO(1L, "test@example.com", "Test User", "", "starter", Instant.now());
        AuthResponse response = new AuthResponse("token123", userResponse);

        when(authService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("token123"))
                .andExpect(jsonPath("$.user.email").value("test@example.com"));
    }

    @Test
    @DisplayName("POST /api/v1/auth/login - Validation Failure")
    void testLoginValidationFailure() throws Exception {
        LoginRequest request = new LoginRequest("invalid-email", "");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/v1/auth/probe - Success")
    void testProbeGet() throws Exception {
        mockMvc.perform(get("/api/v1/auth/probe"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("HEAD /api/v1/auth/probe - Success")
    void testProbeHead() throws Exception {
        mockMvc.perform(head("/api/v1/auth/probe"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/v1/auth/refresh-token - Success")
    void testRefreshTokenSuccess() throws Exception {
        UserResponseDTO userResponse = new UserResponseDTO(1L, "test@example.com", "Test User", "", "starter", Instant.now());
        AuthResponse response = new AuthResponse("new-token123", userResponse);

        when(authService.refresh("1")).thenReturn(response);

        Authentication authentication = new UsernamePasswordAuthenticationToken("1", null);

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                .principal(authentication))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-token123"));
    }
}
