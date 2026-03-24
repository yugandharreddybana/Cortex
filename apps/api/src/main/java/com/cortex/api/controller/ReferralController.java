package com.cortex.api.controller;

import com.cortex.api.entity.User;
import com.cortex.api.repository.ReferralRepository;
import com.cortex.api.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/referrals")
public class ReferralController {

    private final UserRepository userRepository;
    private final ReferralRepository referralRepository;

    public ReferralController(UserRepository userRepository, ReferralRepository referralRepository) {
        this.userRepository = userRepository;
        this.referralRepository = referralRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getReferralStats(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findById(Long.valueOf(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        long totalReferred = referralRepository.countByReferrer(user);
        long totalAccepted = referralRepository.countByReferrerAndStatus(user, "COMPLETED");

        Map<String, Object> response = Map.of(
                "referralCode", user.getReferralCode(),
                "totalReferred", totalReferred,
                "totalAccepted", totalAccepted
        );

        return ResponseEntity.ok(response);
    }
}
