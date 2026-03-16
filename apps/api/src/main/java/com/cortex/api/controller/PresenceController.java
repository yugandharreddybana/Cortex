package com.cortex.api.controller;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class PresenceController {

    private final SimpMessagingTemplate messaging;
    private final UserRepository userRepository;

    // resourceId → Set of user emails currently viewing
    private final ConcurrentHashMap<String, Set<String>> presence = new ConcurrentHashMap<>();

    public PresenceController(SimpMessagingTemplate messaging, UserRepository userRepository) {
        this.messaging = messaging;
        this.userRepository = userRepository;
    }

    @MessageMapping("/join/{resourceId}")
    public void join(@DestinationVariable String resourceId, @Payload Map<String, String> payload,
                     Principal principal) {
        if (principal == null) return;
        String email = resolveEmail(principal);
        if (email == null || email.isBlank()) return;

        presence.computeIfAbsent(resourceId, k -> ConcurrentHashMap.newKeySet()).add(email);
        broadcastPresence(resourceId);
    }

    @MessageMapping("/leave/{resourceId}")
    public void leave(@DestinationVariable String resourceId, @Payload Map<String, String> payload,
                      Principal principal) {
        if (principal == null) return;
        String email = resolveEmail(principal);
        if (email == null || email.isBlank()) return;

        Set<String> viewers = presence.get(resourceId);
        if (viewers != null) {
            viewers.remove(email);
            if (viewers.isEmpty()) {
                presence.remove(resourceId);
            }
        }
        broadcastPresence(resourceId);
    }

    private String resolveEmail(Principal principal) {
        try {
            Long userId = Long.parseLong(principal.getName());
            return userRepository.findById(userId).map(User::getEmail).orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void broadcastPresence(String resourceId) {
        Set<String> viewers = presence.getOrDefault(resourceId, Collections.emptySet());
        messaging.convertAndSend(
                "/topic/resource/" + resourceId,
                Map.of("viewers", viewers)
        );
    }
}
