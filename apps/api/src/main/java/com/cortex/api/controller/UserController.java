package com.cortex.api.controller;

import com.cortex.api.dto.ChangePasswordRequest;
import com.cortex.api.dto.UpdateProfileRequest;
import com.cortex.api.dto.UserResponseDTO;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cortex.api.service.EncryptionService;
import org.springframework.web.bind.annotation.PostMapping;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/v1/user")
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private final EncryptionService encryptionService;

    public UserController(UserRepository userRepository, PasswordEncoder passwordEncoder, EncryptionService encryptionService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.encryptionService = encryptionService;
    }

    @GetMapping("/profile")
    public ResponseEntity<UserResponseDTO> getProfile(Authentication auth) {
        User user = findUser(auth);
        return ResponseEntity.ok(toDTO(user));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserResponseDTO> updateProfile(
            Authentication auth,
            @Valid @RequestBody UpdateProfileRequest request) {
        User user = findUser(auth);

        if (request.fullName() != null) {
            user.setFullName(request.fullName());
        }
        if (request.avatarUrl() != null) {
            user.setAvatarUrl(request.avatarUrl());
        }
        if (request.email() != null && !request.email().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.email())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use");
            }
            user.setEmail(request.email());
        }

        user = userRepository.save(user);
        return ResponseEntity.ok(toDTO(user));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            Authentication auth,
            @Valid @RequestBody ChangePasswordRequest request) {
        User user = findUser(auth);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    private User findUser(Authentication auth) {
        Long userId = Long.parseLong(auth.getName());
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
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
}
