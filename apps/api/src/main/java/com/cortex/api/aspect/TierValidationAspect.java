package com.cortex.api.aspect;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Arrays;

@Aspect
@Component
public class TierValidationAspect {

    private static final Logger log = LoggerFactory.getLogger(TierValidationAspect.class);

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
        User user;
        try {
            Long userId = Long.valueOf(principal);
            user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        } catch (NumberFormatException e) {
            user = userRepository.findByEmail(principal)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        }

        String userTier = user.getTier();
        if (userTier == null) {
            userTier = "starter";
        }

        boolean hasRequiredTier = false;
        for (String allowedTier : requireTier.value()) {
            if (allowedTier.equalsIgnoreCase(userTier)) {
                hasRequiredTier = true;
                break;
            }
        }

        if (!hasRequiredTier) {
            log.warn("Tier check failed for user {}. Required: {}, has: {}", principal, Arrays.toString(requireTier.value()), userTier);
            throw new ResponseStatusException(
                HttpStatus.PAYMENT_REQUIRED,
                "Upgrade required. This feature requires one of the following tiers: " + Arrays.toString(requireTier.value())
            );
        }
    }
}
