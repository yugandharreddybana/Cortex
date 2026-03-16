package com.cortex.api.repository;

import com.cortex.api.entity.SharedLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SharedLinkRepository extends JpaRepository<SharedLink, Long> {
    Optional<SharedLink> findByUniqueHash(String uniqueHash);
    Optional<SharedLink> findByResourceTypeAndResourceIdAndCreatedById(
            SharedLink.ResourceType resourceType, Long resourceId, Long createdById);
}
