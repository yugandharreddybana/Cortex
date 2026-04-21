package com.cortex.api.config;

import com.cortex.api.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

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

            // Iron Session (Next.js) tokens are not JWTs — skip JWT processing
            if (token.startsWith("Fe26.")) {
                filterChain.doFilter(request, response);
                return;
            }

            // A valid JWS JWT must have exactly two periods (header.payload.signature)
            long dotCount = token.chars().filter(ch -> ch == '.').count();

            if (dotCount == 2 && jwtService.isValid(token)) {
                try {
                    String userId = jwtService.getSubject(token);
                    var auth = new UsernamePasswordAuthenticationToken(
                            userId, null, List.of());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                } catch (Exception e) {
                    log.warn("Failed to set authentication context: {}", e.getMessage());
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
