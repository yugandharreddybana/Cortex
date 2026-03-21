package com.cortex.api.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;
    private final long extensionExpirationMs;

    public JwtService(
            @Value("${cortex.jwt.secret}") String secret,
            @Value("${cortex.jwt.expiration-ms}") long expirationMs,
            @Value("${cortex.jwt.extension-expiration-ms}") long extensionExpirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
        this.extensionExpirationMs = extensionExpirationMs;
    }

    public String generateToken(String subject, Map<String, Object> claims) {
        return buildToken(subject, claims, expirationMs);
    }

    public String generateExtensionToken(String subject, Map<String, Object> claims) {
        return buildToken(subject, claims, extensionExpirationMs);
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            Claims claims = parseToken(token);
            return claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            System.err.println("[DEBUG-JWT] Token validation failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    public String getSubject(String token) {
        return parseToken(token).getSubject();
    }

    private String buildToken(String subject, Map<String, Object> claims, long expMs) {
        Date now = new Date();
        return Jwts.builder()
                .subject(subject)
                .claims(claims)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expMs))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }
}
