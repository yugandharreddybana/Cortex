package com.cortex.api.controller;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class ExtensionTokenController {

    private final AuthService authService;

    public ExtensionTokenController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/extension-token")
    public ResponseEntity<Map<String, String>> issueExtensionToken(Authentication auth) {
        String token = authService.generateExtensionToken(auth.getName());
        return ResponseEntity.ok(Map.of("token", token));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<AuthResponse> refreshToken(Authentication auth) {
        AuthResponse response = authService.refresh(auth.getName());
        return ResponseEntity.ok(response);
    }
}
