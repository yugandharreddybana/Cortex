package com.cortex.api.aspect;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Arrays;

@Aspect
@Component
public class TierValidationAspect {

    private final UserRepository userRepository;

    public TierValidationAspect(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Before("@annotation(requireTier)")
    public void validateTier(JoinPoint joinPoint, RequireTier requireTier) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        String principal = auth.getName();
        System.out.println("[DEBUG-TIER] Evaluating tier for principal: " + principal);
        User user;
        try {
            Long userId = Long.valueOf(principal);
            user = userRepository.findById(userId)
                    .orElseThrow(() -> {
                        System.out.println("[DEBUG-TIER] User ID " + userId + " not found in DB!");
                        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found by ID");
                    });
        } catch (NumberFormatException e) {
            System.out.println("[DEBUG-TIER] Principal is not a number, trying email: " + principal);
            user = userRepository.findByEmail(principal)
                    .orElseThrow(() -> {
                        System.out.println("[DEBUG-TIER] Email " + principal + " not found in DB!");
                        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found by email");
                    });
        }

        String userTier = user.getTier();
        if (userTier == null) {
            userTier = "starter"; // Default fallback
        }
        System.out.println("[DEBUG-TIER] User resolved successfully. Tier is: " + userTier);

        boolean hasRequiredTier = false;
        for (String allowedTier : requireTier.value()) {
            if (allowedTier.equalsIgnoreCase(userTier)) {
                hasRequiredTier = true;
                break;
            }
        }

        if (!hasRequiredTier) {
            System.out.println("[DEBUG-TIER] User tier " + userTier + " is NOT authorized. Requires: " + Arrays.toString(requireTier.value()));
            throw new ResponseStatusException(
                HttpStatus.PAYMENT_REQUIRED,
                "Upgrade required. This feature requires one of the following tiers: " + Arrays.toString(requireTier.value())
            );
        }
        System.out.println("[DEBUG-TIER] User is authorized!");
    }
}
