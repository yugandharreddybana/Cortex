package com.cortex.api.repository;

import com.cortex.api.entity.AccessRequest;
import com.cortex.api.entity.AccessRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccessRequestRepository extends JpaRepository<AccessRequest, Long> {

    /** Find all requests for a specific owner, usually to show in their notification/inbox. */
    List<AccessRequest> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    /** Find pending requests for an owner. */
    List<AccessRequest> findByOwnerIdAndStatusOrderByCreatedAtDesc(Long ownerId, AccessRequestStatus status);

    /** Check if a requester already has a pending request for a specific folder. */
    Optional<AccessRequest> findByRequesterIdAndFolderIdAndStatus(
            Long requesterId, Long folderId, AccessRequestStatus status);
}
