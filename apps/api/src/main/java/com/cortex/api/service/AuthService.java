package com.cortex.api.service;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.dto.UserResponseDTO;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.security.MessageDigest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);


    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EncryptionService encryptionService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       EncryptionService encryptionService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.encryptionService = encryptionService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setTier(request.tier() != null ? request.tier() : "starter");
        user.setEmailHash(sha256(request.email()));
        user.setEncryptedEmail(encryptionService.encrypt(request.email()));

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        String token = jwtService.generateToken(
                user.getId().toString(),
                buildClaims(user)
        );

        return new AuthResponse(token, toDTO(user));
    }

    public AuthResponse login(LoginRequest request) {
        log.info("[LOGIN] Attempt for email: {}", request.email());
        if (request.email() == null || request.email().isBlank()) {
            log.warn("[LOGIN] Email is blank or null");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        if (request.password() == null || request.password().isBlank()) {
            log.warn("[LOGIN] Password is blank or null for email: {}", request.email());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        log.debug("[LOGIN] Looking up user by email: {}", request.email());
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> {
                    log.warn("[LOGIN] User not found for email: {}", request.email());
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
                });

        log.debug("[LOGIN] User found: id={}, email={}", user.getId(), user.getEmail());

        boolean needsUpdate = false;
        if (user.getEmailHash() == null) {
            log.info("[LOGIN] User {} missing emailHash, updating...", user.getEmail());
            user.setEmailHash(sha256(user.getEmail()));
            needsUpdate = true;
        }
        if (user.getEncryptedEmail() == null) {
            log.info("[LOGIN] User {} missing encryptedEmail, updating...", user.getEmail());
            user.setEncryptedEmail(encryptionService.encrypt(user.getEmail()));
            needsUpdate = true;
        }
        if (needsUpdate) {
            user = userRepository.save(user);
            log.info("[LOGIN] User {} updated with missing fields.", user.getEmail());
        }

        log.debug("[LOGIN] Checking password for user: {}", user.getEmail());
        if (user.getPasswordHash() == null) {
            log.error("[LOGIN] User {} has null passwordHash!", user.getEmail());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User password is not set");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("[LOGIN] Invalid password for user {}", user.getEmail());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        log.debug("[LOGIN] Password valid for user: {}. Generating token...", user.getEmail());
        String token = jwtService.generateToken(
                user.getId().toString(),
                buildClaims(user)
        );

        log.info("[LOGIN] Success for user {} (id: {})", user.getEmail(), user.getId());
        return new AuthResponse(token, toDTO(user));
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public String generateExtensionToken(String userId) {
        User user = userRepository.findById(Long.parseLong(userId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "User not found"));

        Map<String, Object> claims = buildClaims(user);
        claims.put("scope", "extension");

        return jwtService.generateExtensionToken(
                user.getId().toString(),
                claims
        );
    }

    /**
     * Issue a fresh JWT for an already-authenticated user.
     * Called every 15 min while the user is active on the dashboard.
     */
    public AuthResponse refresh(String userId) {
        User user = userRepository.findById(Long.parseLong(userId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "User not found"));

        String token = jwtService.generateToken(
                user.getId().toString(),
                buildClaims(user)
        );

        return new AuthResponse(token, toDTO(user));
    }

    private Map<String, Object> buildClaims(User user) {
        Map<String, Object> claims = new java.util.HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("tier", user.getTier());
        claims.put("fullName", user.getFullName() != null ? user.getFullName() : "");
        if (user.getAvatarUrl() != null) {
            claims.put("avatarUrl", user.getAvatarUrl());
        }
        return claims;
    }

    private UserResponseDTO toDTO(User user) {
        return new UserResponseDTO(
            user.getId(),
            user.getEmail(),
            user.getFullName() != null ? user.getFullName() : "",
            user.getAvatarUrl() != null ? user.getAvatarUrl() : "",
            user.getTier() != null ? user.getTier() : "starter",
            user.getCreatedAt()
        );
    }
}
