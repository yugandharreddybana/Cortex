# Features & Product Strategy Audit

## 1. Feature Completeness Evaluation

### Stripe Subscription Integration
- **Current Status:** The API has a `StripeController` for Checkout, Webhooks, and Customer Portal. The 'starter' plan bypasses Stripe logic via memory rules.
- **Audit Findings:** The backend needs robust rate-limiting for Stripe webhooks and verification of Stripe event signatures to prevent replay attacks or forged upgrades. Subscriptions should explicitly support prorated upgrades (e.g., from 'pro' to 'team' mid-month) and downgrade grace periods to ensure users retain access until the billing cycle ends.

### AI Integration (Ollama)
- **Current Status:** Supports "Auto-Draft," "Devil's Advocate," "Connect the Dots," and "Suggest Actions."
- **Audit Findings:** The AI currently relies on immediate REST calls (`/api/v1/ai/...`). If the selected folder has hundreds of highlights, "Auto-Draft" could time out.
- **Recommendation:** Implement a background Job Queue (e.g., Redis + BullMQ or Spring Batch) for AI tasks. The frontend should poll or use Server-Sent Events (SSE)/WebSockets to receive the generated outline asynchronously, preventing HTTP timeouts (504 Gateway Timeout).

## 2. Proposals for New Features (Making Cortex Unique)

### AI "Echoes" (Spaced Repetition Engine)
- **Concept:** Highlight management often suffers from the "Read-It-Later" graveyard effect.
- **Implementation:** Introduce a daily "Cortex Echo" view on the Dashboard. The backend curates 5 past highlights, using an algorithm based on the forgetting curve and recent contextual tags. It prompts the user to rate how relevant the highlight still is (Keep, Archive, Synthesize).

### Public Highlight "Collections" (Social/Blogging Feature)
- **Concept:** Take the `ShareController` public links to the next level.
- **Implementation:** Allow users to publish a specific folder as a minimalist, SEO-friendly Next.js web page under a subdomain (e.g., `research.cortex.app/user123/climate-change`). Add a "Remix" button that lets viewers instantly copy the entire public folder structure into their own Cortex account.

### Bidirectional Linking (Network Graph View)
- **Concept:** Move beyond strict hierarchical folders.
- **Implementation:** Introduce an interactive, D3.js or Sigma.js-powered 3D Network Graph in the UI. When the AI runs "Connect the Dots," it visually draws a semantic thread between highlights. Users can manually type `[[Topic Name]]` in a comment to create a permanent, click-through backlink to another folder or highlight, turning Cortex into a true Roam/Obsidian-style knowledge graph.

### "Reader View" Native Web Clipper
- **Concept:** The current extension grabs raw text. The original page might disappear or change (Link Rot).
- **Implementation:** Implement a snapshot capture mechanism. When highlighting, Cortex optionally downloads the entire DOM (using Readability.js) and archives a clean HTML or Markdown version of the full article. This ensures context is never lost even if the source URL goes offline.

### Seamless Tool Integrations (Zapier/Notion/Slack)
- **Concept:** Make Cortex the "capture" layer, but not the final destination.
- **Implementation:** Build Webhooks OUT. When a highlight is tagged "Jira" or "Action Item", the API automatically fires a webhook that creates a ticket in the user's project management tool or posts the highlight into a dedicated Slack channel.

## 3. Production Readiness Checklist

1. **Monitoring & Observability:** Implement Sentry (for frontend/extension error tracking) and Datadog/Prometheus (for backend metric collection).
2. **Database Backups:** Ensure Point-in-Time Recovery (PITR) is active on the Supabase PostgreSQL cluster.
3. **CI/CD Pipelines:** Set up GitHub Actions for automated Vitest, Maven tests, ESLint, and Flyway migration validations on Pull Requests.
4. **Rate Limiting:** Protect public-facing endpoints (`/api/v1/auth/login`, `/api/v1/shares/*`) against DDoS and brute force attacks using API Gateways or Spring Boot Rate Limiter libraries.
