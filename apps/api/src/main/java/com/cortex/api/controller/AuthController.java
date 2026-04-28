package com.cortex.api.controller;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.dto.UserResponseDTO;
import com.cortex.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    @Value("${cortex.cookie.secure:true}")
    private boolean cookieSecure;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(
            @Valid @RequestBody SignupRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.signup(request);
        setAuthCookie(response, authResponse.getToken());
        // FIX: do not return the raw JWT in the response body — it is set via HTTP-only cookie only
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "success", true,
                "user", authResponse.getUser()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        setAuthCookie(response, authResponse.getToken());
        // FIX: do not return the raw JWT in the response body — it is set via HTTP-only cookie only
        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", authResponse.getUser()
        ));
    }

    /**
     * Endpoint for the frontend useAuthStore.fetchUser() to get the current profile.
     * Mapped to /api/v1/auth/me (rewritten from /api/auth/me in Next.js).
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("authenticated", false));
        }
        Long userId = Long.parseLong(auth.getName());
        UserResponseDTO userDTO = authService.getUserProfile(userId);
        return ResponseEntity.ok(Map.of(
                "authenticated", true,
                "user", userDTO
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        // FIX: use Set-Cookie header directly to support SameSite=Strict
        String clearCookie = "cortex_session=; Path=/; HttpOnly; Max-Age=0"
                + (cookieSecure ? "; Secure" : "")
                + "; SameSite=Strict";
        response.addHeader("Set-Cookie", clearCookie);
        return ResponseEntity.ok().build();
    }

    /**
     * Refresh token endpoint — called every 15 min while user is active on dashboard.
     * Requires valid authentication (JWT in Authorization header or cookie).
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<Map<String, Object>> refresh(Authentication auth, HttpServletResponse response) {
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Long userId = Long.parseLong(auth.getName());
        AuthResponse authResponse = authService.refresh(userId.toString());
        setAuthCookie(response, authResponse.getToken());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @RequestMapping(value = "/login", method = org.springframework.web.bind.annotation.RequestMethod.HEAD)
    public ResponseEntity<Void> loginHead() {
        return ResponseEntity.ok().build();
    }

    // Health probe for the extension to detect if Java backend is running.
    @RequestMapping(value = "/probe", method = {
            org.springframework.web.bind.annotation.RequestMethod.GET,
            org.springframework.web.bind.annotation.RequestMethod.HEAD
    })
    public ResponseEntity<Void> probe() {
        return ResponseEntity.ok().build();
    }

    /**
     * Sets an HTTP-only, SameSite=Strict cookie containing the JWT.
     * Uses Set-Cookie header directly because jakarta Cookie does not support SameSite.
     */
    private void setAuthCookie(HttpServletResponse response, String token) {
        String cookieValue = "cortex_session=" + token
                + "; Path=/; HttpOnly; Max-Age=604800"
                + (cookieSecure ? "; Secure" : "")
                + "; SameSite=Strict";
        response.addHeader("Set-Cookie", cookieValue);
    }
}
