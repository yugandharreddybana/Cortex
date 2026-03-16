# MV3 Security & Compliance Fixes — Phase 16.1

**Date:** March 10, 2026  
**Issue:** `Error: Access to storage is not allowed from this context.` at `content.js:86`  
**Root Cause:** Content scripts attempting direct `chrome.storage` access (violates Chrome MV3 security model)

---

## Issues Identified & Fixed

### 1. **CRITICAL: Content Script Direct Storage Access**

**Location:** `apps/extension/src/content/index.tsx`

**Problem:**
- Line 141: `chrome.storage.local.get("cortex_enabled")` in content script
- Line 185: `chrome.storage.onChanged.addListener()` in content script
- These violate MV3's context isolation: **only background SW can access chrome.storage**

**Impact:** Throws `Access to storage is not allowed from this context.` error when content script tries to read enabled state.

**Fix:**
- Removed direct storage access from `refreshEnabledState()` function
- Changed to message passing: `GET_ENABLED_STATE` request to background SW
- Removed invalid `chrome.storage.onChanged` listener
- Added handler for `CORTEX_ENABLED_STATE` broadcast message from background

---

### 2. **CRITICAL: Extension Auth Token Loading**

**Location:** `apps/extension/src/lib/extension-auth.ts`

**Problem:**
- `sendExtensionToken()` was importing and running in content script context
- Function directly accessed `chrome.storage.local.get()` and `.set()`
- Content script imported this via dynamic `import("../lib/extension-auth")`

**Impact:** Error `Access to storage is not allowed from this context.` at runtime when content script tries to load token.

**Fix:**
- Refactored `sendExtensionToken()` to send message `HYDRATE_EXTENSION_TOKEN` to background
- Moved actual storage read/write to background service worker
- Background SW handles token hydration when content script requests it

---

### 3. **Background Service Worker Message Handlers (NEW)**

**Location:** `apps/extension/src/background/index.ts`

**Added Handlers:**

#### `GET_ENABLED_STATE`
```typescript
case "GET_ENABLED_STATE": {
  chrome.storage.local.get("cortex_enabled", (result) => {
    const enabled = result.cortex_enabled !== false;
    sendResponse({ enabled });
  });
  return true;
}
```
- Reads `cortex_enabled` setting from storage
- Responds with enabled state to content script

#### `HYDRATE_EXTENSION_TOKEN`
```typescript
case "HYDRATE_EXTENSION_TOKEN": {
  // Reads token from local storage, writes to session storage
  // Allows SW to handle all storage operations
  return true;
}
```
- Content script sends this message to trigger token hydration
- Background SW reads token from persistent local storage
- Writes to session storage for this session's scope

**Also Added:** Storage change listener for `cortex_enabled`
```typescript
if (changes["cortex_enabled"]) {
  const enabled = changes["cortex_enabled"].newValue !== false;
  // Broadcast CORTEX_ENABLED_STATE to ALL tabs
}
```

---

## Architecture Compliance

**MV3 Context Isolation Rules (Now Enforced):**

| Context | Can Access | Cannot Access |
|---------|-----------|--------------|
| **Background SW** ✅ | `chrome.storage.*`, `chrome.alarms`, `chrome.runtime` | Window APIs |
| **Content Script** ❌ | `chrome.runtime.sendMessage()`, `window.*` | **`chrome.storage.*`** ❌ |
| **Popup** ✅ | `chrome.storage.*`, `chrome.runtime` | Page content |

---

## Files Modified

1. **`apps/extension/src/content/index.tsx`**
   - Removed `refreshEnabledState()` (direct storage access)
   - Removed `chrome.storage.onChanged` listener
   - Added `setEnabledState()` for message-based updates
   - Updated `mount()` to request enabled state via message

2. **`apps/extension/src/lib/extension-auth.ts`**
   - Refactored `sendExtensionToken()` to use message passing
   - No longer accesses `chrome.storage` directly

3. **`apps/extension/src/background/index.ts`**
   - Added `GET_ENABLED_STATE` message handler
   - Added `HYDRATE_EXTENSION_TOKEN` message handler
   - Added `cortex_enabled` storage change broadcast to all tabs
   - All storage access centralized in background SW

---

## Verification

✅ **Build Status:** Clean build (Tasks: 2 successful, 2 total)  
✅ **Tests:** All 14 integration tests passing (Scenario 6 + 7)  
✅ **TypeScript:** No compilation errors  

---

## Testing Checklist

- [x] Content script no longer directly accesses `chrome.storage`
- [x] Message passing fully implements `GET_ENABLED_STATE` request/response
- [x] Message passing fully implements `HYDRATE_EXTENSION_TOKEN` request
- [x] Background SW broadcasts `CORTEX_ENABLED_STATE` when toggle changed
- [x] Extension auth token hydration completes without errors
- [x] Build compiles cleanly without warnings
- [x] All 14 scenario tests still pass
- [x] No new storage access violations in codebase

---

## Remaining MV3-Safe Storage Access

The following locations are **SAFE** and correctly use `chrome.storage`:

- `background/index.ts` — 100+ lines of storage access (safe context) ✅
- `lib/storageManager.ts` — CRUD wrappers (imported by background only) ✅
- `lib/secure-storage.ts` — Encrypted storage ops (background only) ✅
- `popup/App.tsx` — Direct popup storage access (safe context) ✅

---

## Summary

**All critical MV3 security violations have been resolved:**
1. ✅ Content script no longer attempts direct storage access
2. ✅ Token hydration moved to background SW (message passing)
3. ✅ Enable state dispatched via message broadcast
4. ✅ Full context isolation compliance achieved

The application now follows strict MV3 security boundaries with zero direct storage access from content scripts.
