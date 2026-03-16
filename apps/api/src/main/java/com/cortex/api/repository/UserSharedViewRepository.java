package com.cortex.api.repository;

import com.cortex.api.entity.UserSharedView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserSharedViewRepository extends JpaRepository<UserSharedView, Long> {
    List<UserSharedView> findByUserIdOrderByCreatedAtDesc(Long userId);
    Optional<UserSharedView> findByUserIdAndSharedLinkId(Long userId, Long sharedLinkId);
}
