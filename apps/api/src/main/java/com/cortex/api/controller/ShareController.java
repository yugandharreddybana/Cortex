package com.cortex.api.controller;

import com.cortex.api.entity.SharedLink;
import com.cortex.api.entity.User;
import com.cortex.api.repository.UserRepository;
import com.cortex.api.service.ShareService;
import com.cortex.api.service.SecurityService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/share")
public class ShareController {

    private final ShareService shareService;
    private final SecurityService securityService;
    private final UserRepository userRepo;
    private final com.cortex.api.service.PermissionService permissionService;

    public ShareController(ShareService shareService, 
                           SecurityService securityService, 
                           UserRepository userRepo,
                           com.cortex.api.service.PermissionService permissionService) {
        this.shareService = shareService;
        this.securityService = securityService;
        this.userRepo = userRepo;
        this.permissionService = permissionService;
    }

    /** POST /api/v1/share — create a share link */
    @PostMapping
    public ResponseEntity<Map<String, String>> create(Authentication auth,
                                                       @RequestBody ShareRequest req) {
        User user = resolveUser(auth);
        SharedLink.ResourceType type = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
        SharedLink link = shareService.createShareLink(user, type, req.resourceId);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "hash", link.getUniqueHash(),
                "resourceType", link.getResourceType().name(),
                "resourceId", link.getResourceId().toString()
        ));
    }

    /** GET /api/v1/share/{hash} — resolve a share link (public-ish, but requires auth) */
    @GetMapping("/{hash}")
    public Map<String, Object> resolve(@PathVariable String hash) {
        SharedLink link = shareService.resolveByHash(hash);
        return shareService.buildSharedPayload(link);
    }

    /** POST /api/v1/share/{hash}/view — save a read-only reference */
    @PostMapping("/{hash}/view")
    public ResponseEntity<Map<String, Boolean>> view(Authentication auth,
                                                      @PathVariable String hash) {
        User viewer = resolveUser(auth);
        SharedLink link = shareService.resolveByHash(hash);
        shareService.saveView(viewer, link);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** POST /api/v1/share/{hash}/clone — deep copy to receiver's library */
    @PostMapping("/{hash}/clone")
    public ResponseEntity<Map<String, Boolean>> clone(Authentication auth,
                                                       @PathVariable String hash) {
        User receiver = resolveUser(auth);
        SharedLink link = shareService.resolveByHash(hash);
        shareService.deepCopyToLibrary(receiver, link);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** GET /api/v1/share/shared-with-me — list shares the user has viewed/saved */
    @GetMapping("/shared-with-me")
    public List<Map<String, Object>> sharedWithMe(Authentication auth) {
        User user = resolveUser(auth);
        return shareService.listSharedWithMe(user);
    }

    /** GET /api/v1/share/resource?resourceId=x&type=HIGHLIGHT|FOLDER — fetch resource for collab workspace */
    @GetMapping("/resource")
    public Map<String, Object> getResource(Authentication auth,
                                            @RequestParam Long resourceId,
                                            @RequestParam String type) {
        SharedLink.ResourceType resourceType = SharedLink.ResourceType.valueOf(type.toUpperCase());

        // Verify the user has at least VIEWER access
        var level = securityService.resolveAccessLevel(resourceId, resourceType);
        if (level == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to this resource");
        }

        return shareService.buildResourcePayload(resourceId, resourceType);
    }
 
    /** POST /api/v1/share/invite — bulk invite collaborators */
    @PostMapping("/invite")
    public ResponseEntity<InviteResponse> invite(Authentication auth,
                                                  @RequestBody InviteRequest req) {
        User granter = resolveUser(auth);
        SharedLink.ResourceType type = SharedLink.ResourceType.valueOf(req.resourceType.toUpperCase());
 
        // Security check: Only owners can invite
        if (!securityService.isOwner(req.resourceId, type)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can invite collaborators");
        }
 
        List<com.cortex.api.service.PermissionService.InviteResult> results = 
                permissionService.bulkInvite(granter, req.emails, req.resourceId, type, req.accessLevel);
 
        InviteResponse resp = new InviteResponse();
        resp.results = results;
        return ResponseEntity.ok(resp);
    }

    // ── Helpers ──

    private User resolveUser(Authentication auth) {
        return userRepo.findById(Long.parseLong(auth.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    public static class ShareRequest {
        public String resourceType;
        public Long resourceId;
    }
 
    public static class InviteRequest {
        public List<String> emails;
        public Long resourceId;
        public String resourceType;
        public String accessLevel;
        public String resourceTitle;
    }
 
    public static class InviteResponse {
        public List<com.cortex.api.service.PermissionService.InviteResult> results;
    }
}
