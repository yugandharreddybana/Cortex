package com.cortex.api.service;

import com.cortex.api.dto.AuthResponse;
import com.cortex.api.dto.LoginRequest;
import com.cortex.api.dto.SignupRequest;
import com.cortex.api.dto.UserResponseDTO;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.repository.ReferralRepository;
import com.cortex.api.entity.Referral;
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
    private final ReferralRepository referralRepository;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       EncryptionService encryptionService,
                       ReferralRepository referralRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.encryptionService = encryptionService;
        this.referralRepository = referralRepository;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        if (userRepository.existsByEmail(email)) {
            // FIX: log hashed email instead of plaintext to avoid PII in logs (GDPR)
            log.warn("[SIGNUP] 409 — existsByEmail matched for hash:{}", sha256(email));
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setTier(request.tier() != null ? request.tier() : "starter");
        user.setEmailHash(sha256(email));
        user.setEncryptedEmail(encryptionService.encrypt(email));
        user.setReferralCode(generateUniqueReferralCode());

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            log.warn("[SIGNUP] 409 — DataIntegrityViolation: {}", e.getMostSpecificCause().getMessage());
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        if (request.referralCode() != null && !request.referralCode().isBlank()) {
            String refCode = request.referralCode().trim();
            final User savedUser = user;
            userRepository.findByReferralCode(refCode).ifPresent(referrer -> {
                if (!referrer.getId().equals(savedUser.getId())) {
                    Referral referral = new Referral();
                    referral.setReferrer(referrer);
                    referral.setReferred(savedUser);
                    referral.setStatus("PENDING");
                    referralRepository.save(referral);
                }
            });
        }

        String token = jwtService.generateToken(user.getId().toString(), buildClaims(user));
        return new AuthResponse(token, toDTO(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // FIX: do not log plaintext email — use ID after lookup or log hash only
        log.info("[LOGIN] Attempt received");

        if (request.email() == null || request.email().isBlank()) {
            log.warn("[LOGIN] Email is blank or null");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        if (request.password() == null || request.password().isBlank()) {
            log.warn("[LOGIN] Password is blank or null");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        String email = request.email().trim().toLowerCase();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    // FIX: log hash not plaintext email
                    log.warn("[LOGIN] User not found — hash:{}", sha256(email));
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
                });

        log.debug("[LOGIN] User found: id={}", user.getId());

        boolean needsUpdate = false;
        if (user.getEmailHash() == null) {
            user.setEmailHash(sha256(user.getEmail()));
            needsUpdate = true;
        }
        if (user.getReferralCode() == null || user.getReferralCode().isBlank()) {
            user.setReferralCode(generateUniqueReferralCode());
            needsUpdate = true;
        }
        if (user.getEncryptedEmail() == null) {
            user.setEncryptedEmail(encryptionService.encrypt(user.getEmail()));
            needsUpdate = true;
        }
        if (needsUpdate) {
            user = userRepository.save(user);
        }

        if (user.getPasswordHash() == null) {
            log.error("[LOGIN] User id={} has null passwordHash!", user.getId());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "User password is not set");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            // FIX: log user ID not email
            log.warn("[LOGIN] Invalid password for user id={}", user.getId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        log.info("[LOGIN] Success for user id={}", user.getId());
        String token = jwtService.generateToken(user.getId().toString(), buildClaims(user));
        return new AuthResponse(token, toDTO(user));
    }

    /**
     * FIX: Added max-attempts guard to prevent an infinite loop in the unlikely
     * event of repeated collisions in the referral code space.
     */
    private String generateUniqueReferralCode() {
        int length = 8;
        String characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        java.security.SecureRandom rnd = new java.security.SecureRandom();
        int maxAttempts = 20;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            StringBuilder code = new StringBuilder(length);
            for (int i = 0; i < length; i++) {
                code.append(characters.charAt(rnd.nextInt(characters.length())));
            }
            if (!userRepository.existsByReferralCode(code.toString())) {
                return code.toString();
            }
        }
        throw new IllegalStateException("Could not generate a unique referral code after " + maxAttempts + " attempts");
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        Map<String, Object> claims = buildClaims(user);
        claims.put("scope", "extension");
        return jwtService.generateExtensionToken(user.getId().toString(), claims);
    }

    public AuthResponse refresh(String userId) {
        User user = userRepository.findById(Long.parseLong(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        String token = jwtService.generateToken(user.getId().toString(), buildClaims(user));
        return new AuthResponse(token, toDTO(user));
    }

    public UserResponseDTO getUserProfile(Long userId) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid session");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toDTO(user);
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
