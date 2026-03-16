package com.cortex.api.repository;

import com.cortex.api.entity.ExtensionToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ExtensionTokenRepository extends JpaRepository<ExtensionToken, Long> {
    
    /**
     * Find a valid extension token by its token string.
     */
    @Query("""
        SELECT et FROM ExtensionToken et
        WHERE et.token = :token
          AND et.expiresAt > CURRENT_TIMESTAMP
    """)
    Optional<ExtensionToken> findValidToken(@Param("token") String token);

    /**
     * Find a token by user ID and ensure it's valid.
     */
    @Query("""
        SELECT et FROM ExtensionToken et
        WHERE et.user.id = :userId
          AND et.expiresAt > CURRENT_TIMESTAMP
        ORDER BY et.createdAt DESC
        LIMIT 1
    """)
    Optional<ExtensionToken> findLatestValidTokenForUser(@Param("userId") Long userId);

    /**
     * Find all expired tokens for cleanup.
     */
    @Query("""
        SELECT et FROM ExtensionToken et
        WHERE et.expiresAt <= CURRENT_TIMESTAMP
    """)
    java.util.List<ExtensionToken> findExpiredTokens();
}
