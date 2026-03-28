# Phase 3 Implementation Plan — 10 Issue Fixes

> **Status:** Awaiting approval before implementation begins.
> Complete root-cause analysis for all 10 issues, with exact file locations, code changes, and implementation order.

---

## Executive Summary

Ten issues were identified across the shared-folder / access-request workflow. They fall into three clusters:

| Cluster | Issues | Impact |
|---|---|---|
| **Critical proxy bug** | #2, #5 | Breaks approve/reject and shared-with-me sidebar entirely |
| **UX polish** | #1, #3, #4, #6, #8, #9 | Noisy toasts, wrong labels, full-page reloads, flashing spinner |
| **Data integrity** | #7, #10 | Stale folder data, incomplete notification-driven refresh |

---

## Root Cause Analysis

### Issue 1 — 502 toast noise on notification polling

**Root cause:**  
`Providers.tsx` installs a module-scope `window.fetch` interceptor that calls `startLoading()` / `stopLoading()` and fires an error toast on every non-ok API response. `NotificationBell` polls `/api/notifications/unread-count` every 15 seconds as a silent background task. When the backend is temporarily unavailable or returns an error, the interceptor fires `premiumToast.serverError()` — showing a modal-level "Server error" toast for each polling cycle. The user sees a cascade of toasts they cannot act on.

**Files involved:**
- `apps/web/src/components/providers/Providers.tsx` (line 17–63)
- `apps/web/src/components/dashboard/NotificationBell.tsx` (line 65–85)

---

### Issue 2 — 400 Bad Request when clicking Approve

**Root cause (confirmed critical):**  
The Next.js catch-all proxy in `apps/web/src/app/api/[...path]/route.ts` passes only `request.nextUrl.pathname` to `proxyToJava()`, which then builds the upstream URL as:

```
${API_BASE}${path}   // e.g. http://localhost:8080/api/v1/access-requests/7/respond
```

**The query string is completely dropped.** So when the frontend calls:

```
PUT /api/access-requests/7/respond?action=APPROVE
```

The Spring Boot controller receives:

```
PUT /api/v1/access-requests/7/respond
```
with no `action` parameter. Spring's `@RequestParam String action` (required by default) triggers a **400 Bad Request**.

This is a systemic proxy bug. It also breaks **every** other endpoint that uses query parameters:

- `GET /api/permissions/access-level?resourceId=X&type=Y` (shared collaboration page — 400)
- `GET /api/share/resource?resourceId=X&type=Y` (shared collaboration page — 400)
- `PUT /api/notifications/{id}/respond?action=accept` (share invite accept/decline — 400)

**Files involved:**
- `apps/web/src/app/api/[...path]/route.ts` (all 5 handler functions)
- `apps/web/src/lib/proxy.ts` (the `fetch(`${API_BASE}${path}`)` call doesn't include `search`)

**Fix:** In every handler in `route.ts`, append `request.nextUrl.search` to the rewritten path:

```ts
// Before
return proxyToJava(request, rewritePath(request.nextUrl.pathname));

// After
return proxyToJava(request, rewritePath(request.nextUrl.pathname) + (request.nextUrl.search ?? ""));
```

---

### Issue 3 — "OWNER" label shown under owned folders in sidebar

**Root cause:**  
`RecursiveFolderNode` in `Sidebar.tsx` renders a role sub-label unconditionally whenever `folder.effectiveRole` is truthy:

```tsx
{folder.effectiveRole && (
  <span className="text-[9px] uppercase tracking-widest text-white/25 font-bold leading-none mt-0.5">
    {folder.effectiveRole}   ← renders "OWNER" for your own folders
  </span>
)}
```

The role sub-label is only meaningful for shared folders (EDITOR, COMMENTER, VIEWER). Owned folders do not need a role badge.

**File:** `apps/web/src/components/dashboard/Sidebar.tsx` (lines 244–247)

**Fix:** Add `folder.effectiveRole !== "OWNER"` to the condition:

```tsx
{folder.effectiveRole && folder.effectiveRole !== "OWNER" && (
  ...
```

---

### Issue 4 — Shared folder page: wrong button position + redundant access text

**Root cause:**  
In `apps/web/src/app/dashboard/folders/[id]/page.tsx`, the `flex items-center justify-between mt-1` container holds **three** children simultaneously for non-owner users:

1. `<p>` — highlight count (left)
2. `<div>` — Request / Remove Access buttons (only for `isViewer`)
3. `<div>` — "You have viewer access to this shared folder." italic text (for all non-owner)

With CSS `justify-between` and three children, the buttons land in the **middle** of the row instead of the right edge. Additionally:

- Buttons are gated by `isViewer` — COMMENTER users (who can also request EDITOR access) cannot see the "Request Higher Access" button.
- The italic access text is redundant: the role badge already in the header communicates this.

**File:** `apps/web/src/app/dashboard/folders/[id]/page.tsx` (lines 201–230)

**Fix:**
1. Delete the entire `{folder && effectiveRole !== "OWNER" && ...}` div (lines 228–231).
2. Broaden button visibility: change `isViewer` → `effectiveRole !== "OWNER"` for the button group so COMMENTER and EDITOR can also remove/request access.

**Note:** An EDITOR can chose to leave a shared folder. Keeping "Remove Access" for all non-owners is consistent with existing Sidebar behaviour.

---

### Issue 5 — GET /api/share → 405 Method Not Allowed

**Root cause — two distinct call sites:**

**5a. Sidebar.tsx (line 348):**
```ts
fetch("/api/share", { credentials: "include" })
```
This maps via the proxy to `GET /api/v1/share`. `ShareController` has NO bare `GET /` mapping — only `GET /shared-with-me`, `GET /resource`, `GET /{hash}`, etc. Spring returns **405 Method Not Allowed**.

The correct endpoint for fetching "shared with me" items is `GET /api/v1/share/shared-with-me`.

**5b. `shared/[id]/page.tsx` (line ~79):**
```ts
fetch(`/api/share?action=resource&resourceId=${id}&type=${resourceType}`)
```
This maps to `GET /api/v1/share` (wrong path) AND the proxy drops the query params (Issue 2). The correct call is:
```ts
fetch(`/api/share/resource?resourceId=${id}&type=${resourceType}`)
```

**Files:**
- `apps/web/src/components/dashboard/Sidebar.tsx` (line 348)
- `apps/web/src/app/dashboard/shared/[id]/page.tsx` (line ~79)

---

### Issue 6 — "Remove Access" causes full page reload

**Root cause:**  
`unshareFolder` in `apps/web/src/store/dashboard.ts` (line 455–463) contains:

```ts
if (window.location.pathname.includes(`/folders/${id}`)) {
  window.location.href = "/dashboard";  // ← hard browser reload
}
```

`window.location.href` assignment triggers a full browser navigation, which:
- Discards the React component tree
- Re-triggers SSR/RSC rendering
- Shows a blank page momentarily (full reload flash)
- Prevents the `toast.success` and `router.push("/dashboard")` in `FolderPage.handleDelete` from ever executing

The `FolderPage` already calls `router.push("/dashboard")` after `unshareFolder` — the store's `window.location.href` is redundant AND harmful.

**Files:**
- `apps/web/src/store/dashboard.ts` (lines 450–464)
- `apps/web/src/components/dashboard/Sidebar.tsx` (line 662) — Sidebar calls `unshareFolder` without subsequent navigation; needs `router.push` if user is viewing that folder

**Fix:**
1. Remove the `window.location.href` block from the store.
2. In `Sidebar.tsx`'s `onConfirm` callback when calling `unshareFolder`, add:
   ```ts
   if (pathname.startsWith(`/dashboard/folders/${deleteTarget.id}`)) {
     router.push("/dashboard");
   }
   ```

---

### Issue 7 — Folder data not cached between navigations

**Root cause:**  
`fetchFolders()` in the store has a `foldersInFlight` module-level guard that prevents concurrent fetches, but not redundant sequential fetches. The function is called after every mutation that might change folder data (approve/reject, bulk permissions, etc.), and also from `useServerSync` on every mount of the dashboard layout. 

Each call hits `GET /api/v1/folders` regardless of how recently it was last fetched.

**File:** `apps/web/src/store/dashboard.ts` (lines 246–295)

**Fix:**  
Add a `lastFoldersFetchAt: number` field to the store (initialised to `0`). In `fetchFolders()`, skip the network call if `Date.now() - lastFoldersFetchAt < 30_000` (30-second window). Expose a `forceFetchFolders()` (or an `invalidateFolders()`) helper for mutations that need a guaranteed refresh. Update `lastFoldersFetchAt` on success.

```ts
// In fetchFolders:
if (Date.now() - get().lastFoldersFetchAt < 30_000) return; // cache hit
// ...after success:
set({ folders: mapped, lastFoldersFetchAt: Date.now() });
```

---

### Issue 8 — Global loader fires on every background fetch

**Root cause:**  
The `window.fetch` interceptor in `Providers.tsx` increments `loadingCount` for **every** call, including:
- `NotificationBell` polling every 15 s → `loadingCount > 0` → spinner visible
- `useServerSync` parallel fetches on mount → spinner for several hundred ms
- Any background store operation

The `GlobalLoader` renders whenever `loadingCount > 0`, blocking pointer events with `pointer-events-auto cursor-wait` and showing the centered spinner island. Silent background fetches should never trigger this.

**File:** `apps/web/src/components/providers/Providers.tsx` (lines 17–22, 57–60)

**Fix:**  
Skip `startLoading()` / `stopLoading()` for background URLs. Add a URL-based exclusion list:

```ts
const SILENT_URL_PATTERNS = ["/api/notifications", "/api/auth/me", "/api/auth/ws-token"];

const isSilent = SILENT_URL_PATTERNS.some(p => url.includes(p));
if (!isSilent) useDashboardStore.getState().startLoading();
// ...
if (!isSilent) useDashboardStore.getState().stopLoading();
```

---

### Issue 9 — Toast messages too generic

**Root cause:**  
The global interceptor's error-handling cascades to either `data.message` (raw backend message) or `premiumToast.serverError()` ("Server error — Our systems are having trouble…") for most failures. This is unhelpful for actionable errors like 405 (wrong endpoint) or 400 (bad parameters).

Additionally, some operations like `handleRespond` in `NotificationBell` fail silently (the `catch {}` block swallows the error with no user feedback for accept/decline share invites).

**Files:**
- `apps/web/src/components/providers/Providers.tsx` (lines 28–56)
- `apps/web/src/components/dashboard/NotificationBell.tsx` (`handleRespond` function, line 158)

**Fix — Providers.tsx interceptor:**  
Expand the status-based handling:

```ts
} else if (response.status === 405) {
  // Silently skip — likely a mis-routed background call
  return response;
} else if (response.status === 400) {
  premiumToast.genericError(data?.message || "Invalid request", "Please refresh and try again.");
} else if (response.status === 404) {
  // Only toast if user navigated to it; skip for background checks
  if (!url.includes('/api/notifications') && !url.includes('/api/auth')) {
    premiumToast.genericError("Not found", "The item may have been deleted.");
  }
}
```

**Fix — NotificationBell `handleRespond`:**  
Replace `catch {}` with:

```ts
} catch {
  toast.error("Failed to respond to invite. Please try again.");
```

---

### Issue 10 — Missing pieces in the access request flow

After fixing the proxy (Issue 2), the core approve/reject cycle is complete. Two remaining gaps:

**10a. Requester's folder list doesn't refresh after owner approves**  
When the owner approves a request:
1. Backend creates the `ResourcePermission` and sends an `ACCESS_REQUEST_RESOLVED` notification to the requester.
2. The requester's `NotificationBell` polls and shows the badge.
3. **Nothing triggers `fetchFolders()` on the requester's client.**
4. The requester must manually navigate away and back (or reload) to see the new folder appear.

**Fix:** In `NotificationBell.fetchNotifications()`, after receiving a new `ACCESS_REQUEST_RESOLVED` notification where it isn't already in the local list, call `fetchFolders()` to hydrate the new shared folder into the store:

```ts
const wasUnknown = !notifications.find(n => n.id === newN.id);
const newly_approved = wasUnknown 
  && newN.type === "ACCESS_REQUEST_RESOLVED"
  && !newN.responded;
if (newly_approved) {
  useDashboardStore.getState().fetchFolders();
}
```

A simpler trigger: if `fetchNotifications()` finds any new `ACCESS_REQUEST_RESOLVED` notifications since last fetch, call `invalidateFolders()` (see Issue 7).

**10b. Owner has no way to view/manage pending access requests outside of notifications**  
`AccessRequestController` only has `PUT /{id}/respond`. If the owner dismisses a notification, the pending request is lost from their view — there is no "pending requests" list anywhere.

**Fix:** Add a `GET /api/v1/access-requests/pending` endpoint to `AccessRequestController` that returns all pending requests for resources the caller owns. This enables a future "Pending Requests" panel.

```java
/** GET /api/v1/access-requests/pending — list all pending requests for resources I own */
@GetMapping("/pending")
public List<Map<String, Object>> listPending(Authentication auth) {
    Long ownerId = Long.parseLong(auth.getName());
    return accessRequestService.listPendingForOwner(ownerId);
}
```

And `AccessRequestService.listPendingForOwner(Long ownerId)`:

```java
public List<Map<String, Object>> listPendingForOwner(Long ownerId) {
    return requestRepo.findByOwnerIdAndStatus(ownerId, AccessRequestStatus.PENDING)
        .stream().map(r -> Map.of(
            "id", r.getId().toString(),
            "folderId", r.getFolderId().toString(),
            "requestedLevel", r.getRequestedLevel().name(),
            "requesterName", NotificationService.resolveDisplayName(r.getRequester()),
            "requesterEmail", r.getRequester().getEmail(),
            "createdAt", r.getCreatedAt().toString()
        )).toList();
}
```

And add to `AccessRequestRepository`:
```java
List<AccessRequest> findByOwnerIdAndStatus(Long ownerId, AccessRequestStatus status);
```

---

## Files Changed Summary

| File | Issues Fixed |
|---|---|
| `apps/web/src/app/api/[...path]/route.ts` | #2, #5 (proxy query params — affects all endpoints) |
| `apps/web/src/components/providers/Providers.tsx` | #1, #8, #9 (silent errors, loader exclusions, better toasts) |
| `apps/web/src/components/dashboard/Sidebar.tsx` | #3, #5a, #6 (Owner label, /api/share fix, post-unshare navigate) |
| `apps/web/src/app/dashboard/folders/[id]/page.tsx` | #4 (remove access text, fix button group) |
| `apps/web/src/app/dashboard/shared/[id]/page.tsx` | #5b (fix /api/share?action=resource) |
| `apps/web/src/store/dashboard.ts` | #6, #7 (remove window.location.href, add cache) |
| `apps/web/src/components/dashboard/NotificationBell.tsx` | #9, #10a (silent catch, auto-refresh on resolved) |
| `apps/api/.../controller/AccessRequestController.java` | #10b (add GET /pending endpoint) |
| `apps/api/.../service/AccessRequestService.java` | #10b (listPendingForOwner method) |
| `apps/api/.../repository/AccessRequestRepository.java` | #10b (findByOwnerIdAndStatus query) |

---

## Implementation Order

Issues must be implemented in this order due to dependencies:

```
1. route.ts proxy fix (#2 + #5 prerequisite)
   ↳ Unblocks: approve/reject, shared page API calls, share/resource endpoint

2. Sidebar.tsx: /api/share/shared-with-me fix (#5a)
   ↳ Fixes: 405 toast noise from sidebar mount

3. shared/[id]/page.tsx: /api/share/resource fix (#5b)
   ↳ Fixes: shared collaboration page broken API call

4. Sidebar.tsx: remove OWNER label (#3)
   ↳ Independent — trivial 2-character change

5. folders/[id]/page.tsx: UI fixes (#4)
   ↳ Independent — remove access text, fix button group

6. dashboard.ts: remove window.location.href (#6)
   + Sidebar.tsx: add router.push after unshare (#6)
   ↳ Fixes: hard reload on Remove Access

7. dashboard.ts: add folder fetch cache (#7)
   ↳ Independent — additive change

8. Providers.tsx: silent patterns + loader exclusion (#1, #8, #9)
   ↳ Can be done independently but highest usability impact after proxy fix

9. NotificationBell.tsx: silent catch + auto-refresh (#9, #10a)
   ↳ Depends on: Issue 7 cache (so fetchFolders has minimal cost)

10. Java: GET /pending endpoint (#10b)
    ↳ Independent backend addition
```

---

## Edge Cases & Risk Notes

| Issue | Edge Case | Note |
|---|---|---|
| #2 proxy | Other routes may already set `?search` themselves — double `?` | `request.nextUrl.search` returns `""` when no params, so `path + ""` is safe |
| #6 store | Sidebar calls `unshareFolder` without awaiting — router.push timing | Add the navigate check after the `await unshareFolder()` resolves in the Sidebar confirm |
| #7 cache | Aggressive 30 s cache may show stale folder counts after rename/delete | Explicit cache invalidation calls (`set({ lastFoldersFetchAt: 0 })`) in all mutations that change folders |
| #8 loader | Removing notification URLs from loading counter — what if a notification action IS user-initiated? | Only suppress the polling URLS (`/api/notifications/unread-count`), not all notification URLs (e.g. `PUT /api/notifications/{id}/read` should still show loading) |
| #10b | `findByOwnerIdAndStatus` on AccessRequest — need to ensure `owner` field is mapped | AccessRequest entity already has `@ManyToOne private User owner` — Spring Data query is straightforward |

---

## Testing Checklist (post-implementation)

- [ ] `PUT /api/access-requests/{id}/respond?action=APPROVE` returns 200, not 400
- [ ] `GET /api/share/shared-with-me` returns list, no 405 toast on Sidebar mount
- [ ] `GET /api/share/resource?resourceId=X&type=FOLDER` returns resource payload
- [ ] `GET /api/permissions/access-level?resourceId=X&type=FOLDER` returns accessLevel
- [ ] Notification polling scrolling doesn't show spinner or error toasts
- [ ] "OWNER" role badge absent from owned sidebar folders
- [ ] COMMENTER user sees "Request Higher Access" + "Remove Access" on folder page
- [ ] "You have X access" italic text absent from folder header
- [ ] Remove Access (non-owner) navigates to /dashboard without full page reload
- [ ] Folder data not re-fetched within 30 s unless invalidated
- [ ] After owner approves access request, requester's sidebar refreshes
- [ ] `GET /api/v1/access-requests/pending` returns pending list for owner
