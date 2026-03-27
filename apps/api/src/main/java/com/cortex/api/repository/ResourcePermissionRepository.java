package com.cortex.api.repository;

import com.cortex.api.entity.ResourcePermission;
import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.PermissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.Optional;

public interface ResourcePermissionRepository extends JpaRepository<ResourcePermission, Long> {

    Optional<ResourcePermission> findByUserIdAndResourceIdAndResourceType(
            Long userId, Long resourceId, SharedLink.ResourceType resourceType);

    List<ResourcePermission> findByResourceIdAndResourceType(
            Long resourceId, SharedLink.ResourceType resourceType);

    List<ResourcePermission> findByUserIdAndResourceTypeAndStatus(
            Long userId, SharedLink.ResourceType resourceType, PermissionStatus status);

    void deleteByUserIdAndResourceIdAndResourceType(
            Long userId, Long resourceId, SharedLink.ResourceType resourceType);

    void deleteByResourceIdAndResourceType(
            Long resourceId, SharedLink.ResourceType resourceType);

    @Modifying
    @Transactional
    @Query("DELETE FROM ResourcePermission p WHERE p.resourceId IN :resourceIds AND p.resourceType = :resourceType")
    void deleteByResourceIdInAndResourceType(
            @Param("resourceIds") List<Long> resourceIds, 
            @Param("resourceType") SharedLink.ResourceType resourceType);

    List<ResourcePermission> findByUserId(Long userId);
}
