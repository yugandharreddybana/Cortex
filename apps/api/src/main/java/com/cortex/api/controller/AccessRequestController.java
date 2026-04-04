package com.cortex.api.controller;

import com.cortex.api.entity.AccessRequestStatus;
import com.cortex.api.service.AccessRequestService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/access-requests")
public class AccessRequestController {

    private static final Logger log = LoggerFactory.getLogger(AccessRequestController.class);

    private final AccessRequestService accessRequestService;

    public AccessRequestController(AccessRequestService accessRequestService) {
        this.accessRequestService = accessRequestService;
    }

    /**
     * Returns all PENDING access requests for the authenticated owner.
     * Path: GET /api/v1/access-requests/pending
     */
    @GetMapping("/pending")
    public ResponseEntity<List<Map<String, Object>>> getPending(Authentication auth) {
        Long ownerId = Long.parseLong(auth.getName());
        return ResponseEntity.ok(accessRequestService.listPendingForOwner(ownerId));
    }

    /**
     * Responds to an access request (Approve/Reject).
     * Path: PUT /api/v1/access-requests/{id}/respond?action=APPROVE|REJECT
     */
    @PutMapping("/{id}/respond")
    public ResponseEntity<Map<String, Object>> respond(
            Authentication auth,
            @PathVariable Long id,
            @RequestParam String action) {
        Long ownerId = Long.parseLong(auth.getName());
        
        AccessRequestStatus status;
        String upperAction = action.toUpperCase();
        if ("APPROVE".equals(upperAction) || "APPROVED".equals(upperAction)) {
            status = AccessRequestStatus.APPROVED;
        } else if ("REJECT".equals(upperAction) || "REJECTED".equals(upperAction)) {
            status = AccessRequestStatus.REJECTED;
        } else {
            log.warn("[Access Request] Invalid action '{}' from user {}", action, ownerId);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                "Invalid action. Must be APPROVE or REJECT.");
        }

        accessRequestService.respondToRequest(ownerId, id, status);
        return ResponseEntity.ok(Map.of("ok", true, "status", status.name()));
    }
}
