package com.cortex.api.controller;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.signup(request);
        setAuthCookie(response, authResponse.getToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(authResponse);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        setAuthCookie(response, authResponse.getToken());
        return ResponseEntity.ok(authResponse);
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
        var userDTO = authService.getUserProfile(userId);
        
        return ResponseEntity.ok(Map.of(
            "authenticated", true,
            "user", userDTO
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("cortex_session", null);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        return ResponseEntity.ok().build();
    }

    private void setAuthCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("cortex_session", token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in production with HTTPS
        cookie.setMaxAge(86400 * 7); // 7 days
        response.addCookie(cookie);
    }

    @RequestMapping(value = "/login", method = org.springframework.web.bind.annotation.RequestMethod.HEAD)
    public ResponseEntity<Void> loginHead() {
        return ResponseEntity.ok().build();
    }

    // Health probe for the extension to detect if Java backend is running.
    // Uses GET (not HEAD) because Spring MVC HEAD + POST on the same path can hang.
    @RequestMapping(value = "/probe", method = {
        org.springframework.web.bind.annotation.RequestMethod.GET,
        org.springframework.web.bind.annotation.RequestMethod.HEAD
    })
    public ResponseEntity<Void> probe() {
        return ResponseEntity.ok().build();
    }

    /**
     * Refresh token endpoint — called every 10 min while user is active on dashboard.
     * Requires valid authentication (JWT in Authorization header).
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<AuthResponse> refresh(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        AuthResponse response = authService.refresh(userId.toString());
        return ResponseEntity.ok(response);
    }
}
