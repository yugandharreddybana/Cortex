package com.cortex.api.controller;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResponse response = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
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
