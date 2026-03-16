package com.cortex.api.config;

import com.cortex.api.service.JwtService;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Intercepts STOMP CONNECT frames to authenticate the user via JWT.
 * Sets the principal so that SimpMessagingTemplate.convertAndSendToUser()
 * can route messages to the correct WebSocket session.
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    public WebSocketAuthInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            List<String> authHeaders = accessor.getNativeHeader("Authorization");
            if (authHeaders != null && !authHeaders.isEmpty()) {
                String header = authHeaders.get(0);
                if (header.startsWith("Bearer ")) {
                    String token = header.substring(7);
                    if (jwtService.isValid(token)) {
                        String userId = jwtService.getSubject(token);
                        UsernamePasswordAuthenticationToken auth =
                                new UsernamePasswordAuthenticationToken(userId, null, List.of());
                        accessor.setUser(auth);
                        return message;
                    }
                }
            }
            // No valid JWT → reject the CONNECT frame with an error
            throw new org.springframework.messaging.MessageDeliveryException(
                    message, "Unauthorized: valid Bearer JWT required to connect");
        }
        return message;
    }
}
