package com.cortex.api.controller;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.SecurityService;
import com.cortex.api.service.StripeService;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
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

    public StripeController(StripeService stripeService, SecurityService securityService, UserRepository userRepository) {
        this.stripeService = stripeService;
        this.securityService = securityService;
        this.userRepository = userRepository;
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

        try {
            String url = stripeService.createCheckoutSession(userOpt.get(), planId, isAnnual, successUrl, cancelUrl);
            return ResponseEntity.ok(Map.of("url", url));
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
         try {
             String url = stripeService.createPortalSession(userOpt.get(), returnUrl);
             return ResponseEntity.ok(Map.of("url", url));
         } catch (Exception e) {
             return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
         }
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String sigHeader) {
        try {
            stripeService.handleWebhook(payload, sigHeader);
            return ResponseEntity.ok("Success");
        } catch (SignatureVerificationException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid signature");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Webhook error: " + e.getMessage());
        }
    }
}
