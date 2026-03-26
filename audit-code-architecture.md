# Code Quality & Architecture Audit

## 1. Backend Code Architecture (Java API)

### N+1 Query Problems & JPA Optimization
- **Folder Cloning (`FolderService.java`):**
  - **Issue:** The `deepCloneRecursive` method fetches children (`folderRepository.findByParentFolderId`), then iterates over them, calling itself recursively. Inside this, it saves each folder one by one. This causes a massive N+1 issue for deep/wide folder trees.
  - **Recommendation:** Flatten the hierarchy fetch into a single query using a CTE (Common Table Expression) or native query (similar to `findAllDescendantsInclusive`), build the clone graph in memory, and use `saveAll` to batch insert the new folders.

- **Highlight Batch Updates:**
  - **Issue:** In the folder deletion logic, highlights are updated by looping through them and calling `setFolderId(null)` or `setDeleted(true)`, then calling `highlightRepository.saveAll(highlights)`.
  - **Recommendation:** Use a `@Modifying` JPQL query like `UPDATE Highlight h SET h.folderId = null WHERE h.folderId IN :folderIds` to do this directly in the database without loading entities into Hibernate's persistence context.

### Exception Handling & Global Responses
- **Issue:** The backend lacks a centralized `@ControllerAdvice` for consistent error handling. Currently, many controllers manually return `ResponseEntity.status(HttpStatus.BAD_REQUEST).body(...)`.
- **Recommendation:** Implement a Global Exception Handler (`@RestControllerAdvice`) to catch `EntityNotFoundException`, `AccessDeniedException`, and custom business exceptions, returning a standardized JSON error format (e.g., RFC 7807 Problem Details).

### Test Coverage & Isolation
- **Issue:** Tests rely heavily on an H2 in-memory database with `ddl-auto: create-drop` which drifts from the actual PostgreSQL schema managed by Flyway.
- **Recommendation:** Use Testcontainers with a real PostgreSQL image for integration tests to ensure Flyway scripts and database-specific features (like CTEs and JSONB queries) work correctly before production.

## 2. Frontend Code Architecture (Next.js & React)

### API Fetching & State Management
- **Issue:** `apps/web/src/store/dashboard.ts` fires multiple DELETE requests in a loop for recursive folder deletions (`for (const fid of idsToDelete) { void apiFetch(...) }`).
- **Recommendation:** The backend already supports cascade deletions (as seen in `FolderRepository.findAllDescendantsInclusive`). The frontend should only send a single `DELETE` request for the root folder being deleted. Firing concurrent requests for every descendant is redundant, causes race conditions, and overloads the server.

### Error Boundaries & React Suspense
- **Issue:** There's a lack of formal React Error Boundaries in the Next.js `app` directory. Uncaught errors in components will crash the entire route.
- **Recommendation:** Add `error.tsx` files at key route segments (e.g., `/dashboard/error.tsx`) to gracefully catch rendering errors and provide fallback UIs.

### Type Safety & Schema Validation
- **Issue:** Zod is used for login (`loginSchema`), but it's unclear if all API routes strictly validate incoming payloads.
- **Recommendation:** Ensure end-to-end type safety using tRPC or by sharing Zod schemas between the Next.js API routes and the client-side forms (e.g., via `react-hook-form` + `@hookform/resolvers/zod`).

## 3. Extension Architecture

### Message Passing & Background Scripts
- **Issue:** The extension background worker relies on `window.postMessage` to communicate with the Cortex web app for offline queue syncing. This coupling implies the web app must be open for the extension to sync offline mutations.
- **Recommendation:** The extension background script should handle its own API synchronization directly with the backend `/api/v1/highlights/sync` endpoints using the long-lived `ExtensionToken`, rather than delegating entirely to the web app's DOM.

## 4. Package Management & Build Tools

### Offline Monorepo Setup
- **Issue:** The development environment notes indicate missing Maven POMs for Spring Boot offline, and pnpm lockfile resolution errors (`vitest@2.1.9`).
- **Recommendation:** Create a script (`bootstrap-offline.sh`) that strictly defines exact dependency versions and caches them globally. Use `pnpm fetch` and Maven's `dependency:go-offline` in a pre-build step to guarantee reproducibility.
