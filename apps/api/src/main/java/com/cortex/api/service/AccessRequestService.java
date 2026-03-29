package com.cortex.api.service;

import com.cortex.api.entity.*;
import com.cortex.api.repository.AccessRequestRepository;
import com.cortex.api.repository.FolderRepository;
import com.cortex.api.repository.NotificationRepository;
import com.cortex.api.repository.ResourcePermissionRepository;
import com.cortex.api.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class AccessRequestService {

    private static final Logger log = LoggerFactory.getLogger(AccessRequestService.class);

    private final AccessRequestRepository requestRepo;
    private final FolderRepository folderRepo;
    private final UserRepository userRepo;
    private final ResourcePermissionRepository permissionRepo;
    private final PermissionService permissionService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final NotificationRepository notificationRepo;

    public AccessRequestService(AccessRequestRepository requestRepo,
                                FolderRepository folderRepo,
                                UserRepository userRepo,
                                ResourcePermissionRepository permissionRepo,
                                PermissionService permissionService,
                                NotificationService notificationService,
                                EmailService emailService,
                                NotificationRepository notificationRepo) {
        this.requestRepo = requestRepo;
        this.folderRepo = folderRepo;
        this.userRepo = userRepo;
        this.permissionRepo = permissionRepo;
        this.permissionService = permissionService;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.notificationRepo = notificationRepo;
    }

    /**
     * Returns all PENDING access requests addressed to the given owner.
     * Used by GET /api/v1/access-requests/pending.
     */
    public List<Map<String, Object>> listPendingForOwner(Long ownerId) {
        List<AccessRequest> requests = requestRepo.findByOwnerIdAndStatusOrderByCreatedAtDesc(
                ownerId, AccessRequestStatus.PENDING);

        return requests.stream().map(r -> {
            String folderName = folderRepo.findById(r.getFolderId())
                    .map(Folder::getName)
                    .orElse("Unknown");
            String requesterName = (r.getRequester().getFullName() != null && !r.getRequester().getFullName().isBlank())
                    ? r.getRequester().getFullName()
                    : r.getRequester().getEmail();
            Map<String, Object> dto = new java.util.LinkedHashMap<>();
            dto.put("id",             r.getId());
            dto.put("folderId",       r.getFolderId());
            dto.put("folderName",     folderName);
            dto.put("requesterId",    r.getRequester().getId());
            dto.put("requesterName",  requesterName);
            dto.put("requesterEmail", r.getRequester().getEmail());
            dto.put("requestedLevel", r.getRequestedLevel().name());
            dto.put("status",         r.getStatus().name());
            dto.put("createdAt",      r.getCreatedAt().toString());
            return dto;
        }).toList();
    }

    /**
     * Creates a new access request for a folder.
     */
    @Transactional
    public AccessRequest createRequest(Long requesterId, Long folderId, AccessLevel requestedLevel) {
        User requester = userRepo.findById(requesterId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Folder folder = folderRepo.findById(folderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder not found"));

        // 1. Validate requester is NOT the owner
        if (folder.getUser().getId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You are already the owner of this folder");
        }

        // 2. Validate current access (must be at least VIEWER)
        AccessLevel currentLevel = permissionService.getEffectiveRole(requesterId, folderId);
        if (currentLevel == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this folder");
        }

        // 3. Validate requested level is higher than current
        if (currentLevel.atLeast(requestedLevel)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already have " + currentLevel + " access; cannot request " + requestedLevel);
        }

        // 4. Check for existing pending request
        Optional<AccessRequest> existing = requestRepo.findByRequesterIdAndFolderIdAndStatus(
                requesterId, folderId, AccessRequestStatus.PENDING);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You already have a pending request for this folder");
        }

        // 5. Create request
        AccessRequest request = new AccessRequest();
        request.setRequester(requester);
        request.setOwner(folder.getUser());
        request.setFolderId(folderId);
        request.setRequestedLevel(requestedLevel);
        request = requestRepo.save(request);

        // 6. Trigger Notifications (In-App + Email)
        String requesterName = NotificationService.resolveDisplayName(requester);
        notificationService.emitAccessRequestNotification(
                folder.getUser(), requester, folder, requestedLevel, request.getId());
        
        emailService.sendAccessRequestToOwner(
                folder.getUser().getEmail(),
                requesterName,
                folder.getName(),
                requestedLevel.toString(),
                request.getId()
        );

        log.info("[Access Request] Created id={} requester={} folder={} requested={}",
                request.getId(), requesterId, folderId, requestedLevel);

        return request;
    }

    /**
     * Checks if the requester has a pending request for the given folder.
     */
    public boolean hasPendingRequest(Long requesterId, Long folderId) {
        return requestRepo.findByRequesterIdAndFolderIdAndStatus(
                requesterId, folderId, AccessRequestStatus.PENDING).isPresent();
    }

    /**
     * Responds to an access request.
     */
    @Transactional
    public void respondToRequest(Long ownerId, Long requestId, AccessRequestStatus status) {
        AccessRequest request = requestRepo.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!request.getOwner().getId().equals(ownerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this request");
        }

        if (request.getStatus() != AccessRequestStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is already " + request.getStatus());
        }

        request.setStatus(status);
        requestRepo.save(request);

        // Mark the original ACCESS_REQUEST notification as responded so it shows
        // the correct badge even after a page reload, then delete it immediately
        // (both isRead + responded are set) and broadcast removal to all open tabs.
        String requestIdFragment = "\"requestId\":\"" + requestId + "\"";
        notificationRepo.findPendingAccessRequestNotification(ownerId, requestIdFragment)
                .ifPresent(n -> {
                    n.setResponded(status == AccessRequestStatus.APPROVED ? "approve" : "reject");
                    n.setRead(true);
                    notificationRepo.save(n);
                    // Both conditions met — delete immediately + broadcast to all owner sessions
                    notificationService.deleteAndBroadcastDeletion(n, request.getOwner());
                });

        Folder folder = folderRepo.findById(request.getFolderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Folder no longer exists"));

        if (status == AccessRequestStatus.APPROVED) {
            // Update or Create ResourcePermission
            ResourcePermission perm = permissionRepo.findByUserIdAndResourceIdAndResourceType(
                    request.getRequester().getId(),
                    request.getFolderId(),
                    SharedLink.ResourceType.FOLDER
            ).orElseGet(() -> {
                ResourcePermission p = new ResourcePermission();
                p.setUser(request.getRequester());
                p.setResourceId(request.getFolderId());
                p.setResourceType(SharedLink.ResourceType.FOLDER);
                return p;
            });

            perm.setAccessLevel(request.getRequestedLevel());
            perm.setStatus(PermissionStatus.ACCEPTED);
            permissionRepo.save(perm);
        }

        // Trigger resolution notifications & emails
        notificationService.emitAccessRequestResolvedNotification(
                request.getRequester(), request.getOwner(), folder, status.toString(), request.getRequestedLevel());

        emailService.sendAccessRequestResolutionToRequester(
                request.getRequester().getEmail(),
                NotificationService.resolveDisplayName(request.getOwner()),
                folder.getName(),
                status.toString(),
                request.getRequestedLevel().toString()
        );
    }
}
