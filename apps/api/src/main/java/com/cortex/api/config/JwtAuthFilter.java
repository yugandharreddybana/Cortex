package com.cortex.api.config;

import com.cortex.api.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @org.springframework.lang.NonNull HttpServletRequest request,
            @org.springframework.lang.NonNull HttpServletResponse response,
            @org.springframework.lang.NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (request.getRequestURI().contains("/api/v1/ai/")) {
            System.out.println("[DEBUG-FILTER] AI Request Hit: " + request.getMethod() + " " + request.getRequestURI());
            System.out.println("[DEBUG-FILTER] Received Authorization Header: " + (header != null ? header.substring(0, Math.min(20, header.length())) + "..." : "NULL"));
        }

        // Fallback to cookie if header is still null
        if (header == null && request.getCookies() != null) {
            for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                if ("cortex_session".equals(cookie.getName())) {
                    header = "Bearer " + cookie.getValue();
                    break;
                }
            }
        }

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            
            // Handle optional quotes that browsers or proxies might wrap around the cookie value
            if (token.startsWith("\"") && token.endsWith("\"")) {
                token = token.substring(1, token.length() - 1);
            }

            // Robust check for Iron Session (Next.js) tokens which are NOT JWTs
            if (token.startsWith("Fe26.")) {
                 System.out.println("[DEBUG-JWT] Session Bypass: Detected Iron Session token (Fe26). Skipping JWT processing.");
                 filterChain.doFilter(request, response);
                 return;
            }

            // Structural check: A valid JWS JWT must have exactly two periods (header.payload.signature)
            long dotCount = token.chars().filter(ch -> ch == '.').count();
            
            if (dotCount == 2 && jwtService.isValid(token)) {
                try {
                    String userId = jwtService.getSubject(token);
                    var auth = new UsernamePasswordAuthenticationToken(
                            userId, null, List.of());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } catch (Exception e) {
                    System.err.println("[DEBUG-JWT] Failed to set authentication for token " + 
                        (token.length() > 10 ? token.substring(0, 10) + "..." : token) + 
                        ": " + e.getMessage());
                }
            } else if (dotCount != 2 && !token.isEmpty()) {
                // Log malformation strictly for diagnostics
                System.out.println("[DEBUG-JWT] Structural Rejection: Found " + dotCount + 
                    " dots. Token prefix: " + (token.length() > 20 ? token.substring(0, 20) + "..." : token));
            }
        }

        filterChain.doFilter(request, response);
    }
}
