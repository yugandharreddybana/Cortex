package com.cortex.api.controller;

import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Principal;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class PresenceController {

    private static final Logger log = LoggerFactory.getLogger(PresenceController.class);
    private final SimpMessagingTemplate messaging;
    private final UserRepository userRepository;

    // resourceId → Set of user emails currently viewing
    private final ConcurrentHashMap<String, Set<String>> resourcePresence = new ConcurrentHashMap<>();
    
    // sessionId → Set of resourceIds this session is "joined" to
    private final ConcurrentHashMap<String, Set<String>> sessionSubscriptions = new ConcurrentHashMap<>();
    
    // sessionId → User Email (to avoid multiple DB lookups on disconnect)
    private final ConcurrentHashMap<String, String> sessionEmails = new ConcurrentHashMap<>();

    public PresenceController(SimpMessagingTemplate messaging, UserRepository userRepository) {
        this.messaging = messaging;
        this.userRepository = userRepository;
    }

    @MessageMapping("/join/{resourceId}")
    public void join(@DestinationVariable String resourceId, 
                     @Payload Map<String, String> payload,
                     @Header("simpSessionId") String sessionId,
                     Principal principal) {
        if (principal == null) return;
        String email = resolveEmail(principal);
        if (email == null || email.isBlank()) return;

        log.debug("[PRESENCE] Session {} joined resource {}", sessionId, resourceId);
        
        resourcePresence.computeIfAbsent(resourceId, k -> ConcurrentHashMap.newKeySet()).add(email);
        sessionSubscriptions.computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet()).add(resourceId);
        sessionEmails.put(sessionId, email);
        
        broadcastPresence(resourceId);
    }

    @MessageMapping("/leave/{resourceId}")
    public void leave(@DestinationVariable String resourceId, 
                      @Payload Map<String, String> payload,
                      @Header("simpSessionId") String sessionId,
                      Principal principal) {
        if (principal == null) return;
        String email = sessionEmails.getOrDefault(sessionId, resolveEmail(principal));
        if (email == null) return;

        log.debug("[PRESENCE] Session {} left resource {}", sessionId, resourceId);
        
        removeUserFromResource(resourceId, email);
        
        Set<String> subbed = sessionSubscriptions.get(sessionId);
        if (subbed != null) {
            subbed.remove(resourceId);
            if (subbed.isEmpty()) sessionSubscriptions.remove(sessionId);
        }
        
        broadcastPresence(resourceId);
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String email = sessionEmails.remove(sessionId);
        Set<String> resourceIds = sessionSubscriptions.remove(sessionId);

        if (email != null && resourceIds != null) {
            log.info("[PRESENCE] Session {} disconnected. Cleaning up presence for user {} in {} resources", 
                    sessionId, email, resourceIds.size());
            
            for (String rid : resourceIds) {
                removeUserFromResource(rid, email);
                broadcastPresence(rid);
            }
        }
    }

    private void removeUserFromResource(String resourceId, String email) {
        Set<String> viewers = resourcePresence.get(resourceId);
        if (viewers != null) {
            viewers.remove(email);
            if (viewers.isEmpty()) {
                resourcePresence.remove(resourceId);
            }
        }
    }

    private String resolveEmail(Principal principal) {
        if (principal == null || principal.getName() == null) return null;
        try {
            Long userId = Long.parseLong(principal.getName());
            return userRepository.findById(java.util.Objects.requireNonNull(userId))
                    .map(User::getEmail)
                    .orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void broadcastPresence(String resourceId) {
        Set<String> viewers = resourcePresence.getOrDefault(resourceId, Collections.emptySet());
        messaging.convertAndSend(
                "/topic/resource/" + resourceId,
                Map.of("viewers", viewers)
        );
    }
}
