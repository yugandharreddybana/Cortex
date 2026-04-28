package com.cortex.api.controller;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.SecurityService;
import com.cortex.api.service.StripeService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/stripe")
public class StripeController {

    private final StripeService stripeService;
    private final SecurityService securityService;
    private final UserRepository userRepository;

    @Value("${cortex.app.url:http://localhost:3000}")
    private String appUrl;

    public StripeController(StripeService stripeService,
                            SecurityService securityService,
                            UserRepository userRepository) {
        this.stripeService = stripeService;
        this.securityService = securityService;
        this.userRepository = userRepository;
    }

    /**
     * Validates that a redirect URL belongs to our own application domain.
     * Prevents open redirect attacks where an attacker could supply a malicious URL.
     */
    private boolean isAllowedRedirectUrl(String url) {
        if (url == null || url.isBlank()) return false;
        // Allow relative paths and URLs that start with the configured app URL
        return url.startsWith(appUrl) || url.startsWith("/");
    }

    @PostMapping("/checkout")
    public ResponseEntity<?> createCheckoutSession(@RequestBody Map<String, Object> payload) {
        Long userId = securityService.getCurrentUserId();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String planId = (String) payload.get("planId");
        Boolean isAnnual = (Boolean) payload.get("annual");
        String successUrl = (String) payload.get("successUrl");
        String cancelUrl = (String) payload.get("cancelUrl");

        if (planId == null || planId.isBlank()
                || successUrl == null || successUrl.isBlank()
                || cancelUrl == null || cancelUrl.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Missing required checkout fields"));
        }

        // FIX: validate successUrl and cancelUrl to prevent open redirect attacks
        if (!isAllowedRedirectUrl(successUrl) || !isAllowedRedirectUrl(cancelUrl)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Invalid redirect URL: must be within the application domain"));
        }

        if (isAnnual == null) {
            isAnnual = Boolean.FALSE;
        }

        try {
            String url = stripeService.createCheckoutSession(
                    userOpt.get(), planId, isAnnual, successUrl, cancelUrl);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (StripeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/portal")
    public ResponseEntity<?> createPortalSession(@RequestBody Map<String, String> payload) {
        Long userId = securityService.getCurrentUserId();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String returnUrl = payload.get("returnUrl");
        if (returnUrl == null || returnUrl.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Missing returnUrl"));
        }

        // FIX: validate returnUrl to prevent open redirect attacks
        if (!isAllowedRedirectUrl(returnUrl)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Invalid returnUrl: must be within the application domain"));
        }

        try {
            String url = stripeService.createPortalSession(userOpt.get(), returnUrl);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String sigHeader) {
        if (sigHeader == null || sigHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Missing Stripe-Signature header");
        }
        try {
            stripeService.handleWebhook(payload, sigHeader);
            return ResponseEntity.ok("Success");
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook error");
        }
    }
}
