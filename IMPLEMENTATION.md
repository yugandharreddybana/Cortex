# IMPLEMENTATION

> Read CLAUDE.md first. Then execute every unchecked item below in order.
> No stubs. No TODOs. No placeholders. Every feature wired front-to-back with tests.
> Check off items as completed. Report blockers at end of session.

---

## 1. SECURITY
- [x] Remove from git + add to .gitignore: apps/api/.env, cookies.txt, api_verification_results.txt, .claude/mcp_servers.json
- [x] Create: apps/api/.env.example, apps/web/.env.example (all keys, empty values)
- [x] @Profile("dev") on TestEmailController
- [x] Bucket4j rate limit: 5 req/min/IP on AuthController login + register
- [x] JWT: audit generation, validation, expiry, refresh — fix gaps
- [x] CORS: whitelist FRONTEND_URL only, no wildcard
- [x] Every route requires JWT unless explicitly public

## 2. GEMINI + MCP
- [ ] Create .claude/mcp_servers.example.json: npx @google/generative-ai-mcp with GOOGLE_GEMINI_API_KEY env
- [ ] Add to application.yml: gemini.api.key, gemini.api.model=gemini-2.0-flash, gemini.api.base-url
- [ ] Add spring-boot-starter-webflux to pom.xml
- [ ] Delete OllamaService.java
- [ ] Create GeminiService.java:
  - @Value key/model/baseUrl, @PostConstruct fail-fast if key blank
  - WebClient 30s timeout, exponential backoff on 429, graceful fallback on 500
  - All methods @Async returning CompletableFuture<T>, typed DTOs only
  - analyzeHighlight(String) → AiInsightDTO
  - generateSummary(List<String>) → SummaryDTO
  - chatWithContext(String, List<String>) → ChatResponseDTO
  - suggestTags(String) → List<String>
  - scoreHighlight(String) → Integer 1-5
  - generateEmbedding(String) → float[1536]
  - socraticChallenge(List<String>, String) → SocraticResponseDTO
  - getTopicEvolution(List<String>, String) → EvolutionDTO

## 3. API COMPLETION
- [ ] Move FolderDTO + TagDTO: controller/ → dto/, fix all imports
- [ ] Replace all Map<String,Object> in controllers with typed DTOs
- [ ] Add @Valid + validation annotations to all request DTOs
- [ ] All controllers return consistent ApiResponse<T> + correct HTTP codes
- [ ] Create ExportService: CSV (OpenCSV) + PDF (PDFBox), wire into ExportController, add pom.xml deps
- [ ] Audit ResourceType enum — add all missing values
- [ ] Replace all Optional.get() → orElseThrow(ResourceNotFoundException::new)
- [ ] Add missing @Query methods to repositories
- [ ] Flyway migration for every new/changed DB column or table
- [ ] GlobalExceptionHandler: add handlers for ResourceNotFound(404), AccessDenied(403), Validation(400), AiService(503), Stripe(402), WebSocket errors, generic(500 no stack trace)

## 4. AI FEATURES
- [ ] Flyway: CREATE EXTENSION IF NOT EXISTS vector
- [ ] Flyway: highlight_embeddings table (id, highlight_id FK, embedding vector(1536), created_at)
- [ ] Flyway: IVFFLAT index on embedding column
- [ ] Create EmbeddingService: generateAndStore(Long highlightId) @Async, re-generate on update, delete on highlight delete
- [ ] Create GraphService: getRelated(id,limit), getFullGraph(userId)→GraphDTO, detectClusters(userId) — pgvector <-> operator
- [ ] Add endpoints: GET /api/graph/full, /api/graph/clusters, /api/graph/related/{id}
- [ ] Create AutopilotService:
  - @Scheduled 2am: detectContradictions + surfaceForgottenGems + findCrossTimeConnections per user → persist AutopilotReport
  - @Scheduled 7am: generate Morning Brief HTML → send via EmailService
  - Both wrapped in try/catch + log.error
- [ ] AutopilotReport entity + repository + Flyway migration
- [ ] Add autopilot_enabled boolean to User (default true)
- [ ] Add GET /api/autopilot/latest
- [ ] On highlight save: @Async suggestTags → save tags, @Async scoreHighlight → save ai_quality_score
- [ ] GET /api/folders/{id}/ai-summary (10+ highlights only)
- [ ] GET /api/ai/evolution?topic=
- [ ] POST /api/ai/socratic
- [ ] POST /api/highlights/search — pgvector similarity + Gemini re-rank top 20
- [ ] POST /api/highlights/context-check — top 5 related by embedding for extension sidebar
- [ ] All AI endpoints: fallback response when Gemini unavailable

## 5. WEBSOCKET + NOTIFICATIONS
- [ ] Complete WebSocketService: broadcastToTopic, sendToUser, handleDisconnect
- [ ] Wire WebSocketService into PresenceController
- [ ] WebSocketExceptionHandler: catch + log all STOMP handler exceptions
- [ ] WebSocketAuthInterceptor: validate JWT on handshake, reject unauthenticated
- [ ] Wrap ALL @Scheduled tasks in try/catch + log.error
- [ ] Verify NotificationCleanupTask + EmailBatchProcessor logic complete

## 6. WEB APP
- [ ] Audit all API calls — verify URL matches real @RequestMapping, fix mismatches
- [ ] All calls via src/lib/api.ts, all Gemini calls via src/lib/gemini.ts
- [ ] src/lib/gemini.ts: analyzeHighlight(id), summarizeHighlights(ids[]), chatWithHighlights(msg,ids[]), all with JWT + error handling
- [ ] AI UI: Insights button on cards, Summarise Selected bulk action, AiChatPanel, Challenge Me button, Folder Summary button, auto-tag chips, quality score indicator
- [ ] /graph: D3 force graph, nodes=highlights sized by score, edges=similarity, clusters colored, click→detail, zoom/pan, Share PNG button
- [ ] /stats: highlights over time, top topics, streaks, AI count — D3 charts
- [ ] /u/[username]: public brain profile (opt-in)
- [ ] Settings: autopilot toggle, digest opt-in
- [ ] Dashboard: Morning Brief card
- [ ] Onboarding wizard (3 steps) for users with 0 highlights
- [ ] Every async op: loading skeleton + error state + retry
- [ ] Every list/folder/search: empty state with illustration + CTA
- [ ] Error boundaries on all src/app/ page components
- [ ] Mobile responsive: 375px, 768px, 1280px
- [ ] Dark mode first + light mode toggle
- [ ] Cmd+K global search, Cmd+J AI panel
- [ ] Open Graph meta on all pages
- [ ] Branded loading animation replacing all spinners

## 7. EXTENSION
- [ ] Extension token → JWT auth flow complete
- [ ] Save highlight: capture text+URL+metadata → POST API → success feedback
- [ ] Context sidebar: extract URL+title+500chars → POST /api/highlights/context-check → show related highlights + "New to you" badge + "Worth saving?" score
- [ ] Minimal manifest permissions, Chrome + Firefox up to date

## 8. REFACTOR (no behaviour change)
- [ ] FolderService → extract FolderPermissionService + FolderTreeService, FolderService = facade
- [ ] NotificationService → extract NotificationDispatchService, NotificationService = facade
- [ ] Constructor injection everywhere, remove all @Autowired field injection
- [ ] Every public service method has interface
- [ ] No orphan DTOs, dead routes, unused config, unreferenced beans

## 9. TESTS
- [ ] JUnit: AuthController, GeminiService (mock WebClient, all 8 methods + timeout/429/500), ExportService, GraphService, AutopilotService, PermissionService, WebSocketService, FolderPermissionService, FolderTreeService
- [ ] Vitest: src/lib/api.ts, src/lib/gemini.ts, AiChatPanel, KnowledgeGraph
- [ ] Vitest extension: save highlight flow, context check render
- [ ] Playwright e2e: signup→login→save highlight, create folder→move→view, AI insight, summarize, export CSV, share folder, real-time notification

## 10. DELIVERY
- [ ] pnpm turbo build — zero errors
- [ ] pnpm turbo lint — zero errors
- [ ] pnpm turbo test — all pass
- [ ] tsc --noEmit — zero errors
- [ ] No Spring bean conflicts or circular deps
- [ ] ./start.sh runs cleanly
- [ ] No .env/cookies/secrets in git
- [ ] Zero TODO/FIXME/stub remaining
- [ ] CHANGELOG.md created
- [ ] Flag blockers needing external credentials/infra