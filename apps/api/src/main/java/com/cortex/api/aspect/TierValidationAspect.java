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

        String email = auth.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String userTier = user.getTier();
        if (userTier == null) {
            userTier = "starter"; // Default fallback
        }

        boolean hasRequiredTier = false;
        for (String allowedTier : requireTier.value()) {
            if (allowedTier.equalsIgnoreCase(userTier)) {
                hasRequiredTier = true;
                break;
            }
        }

        if (!hasRequiredTier) {
            throw new ResponseStatusException(
                HttpStatus.PAYMENT_REQUIRED,
                "Upgrade required. This feature requires one of the following tiers: " + Arrays.toString(requireTier.value())
            );
        }
    }
}
