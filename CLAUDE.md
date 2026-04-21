
## Purpose
Minimal persistent context. Read this first; open referenced files only when directly needed.

## Global Rules
- TypeScript strict mode in all TS packages; no `any` without justification.
- Java: follow Spring Boot conventions; use constructor injection, not field injection.
- Write tests for every new feature or bug fix:
  - Web: vitest (`apps/web/vitest.config.ts`)
  - Extension: vitest (`apps/extension/src/__tests__/`)
  - API: JUnit in `apps/api/src/test/`
  - E2E: `apps/e2e/`
- Never commit `.env` files, cookies, session tokens, or debug dumps.
- Never force-push to `main`; use feature branches and PRs.
- Follow existing naming and folder conventions; don't invent new patterns.
- Validate all external API responses; never trust unvalidated shapes.

## Architecture
pnpm + Turborepo monorepo. Four independently deployable apps.
Cortex/
├── apps/
│ ├── web/ # Next.js + TypeScript + Tailwind (App Router)
│ │ └── src/
│ │ ├── app/ # Next.js routes and pages
│ │ ├── components/ # UI components
│ │ ├── hooks/ # Custom React hooks
│ │ ├── lib/ # Utilities
│ │ ├── store/ # State management
│ │ └── middleware.ts # Auth/route middleware
│ ├── api/ # Java Spring Boot REST API + PostgreSQL
│ │ └── src/main/java/com/cortex/api/
│ │ ├── controller/ # REST controllers
│ │ ├── service/ # Business logic
│ │ ├── repository/ # JPA repositories
│ │ ├── entity/ # JPA entities
│ │ ├── dto/ # Data transfer objects
│ │ ├── config/ # Spring config (CORS, Security, etc.)
│ │ └── aspect/ # AOP aspects
│ ├── extension/ # Browser extension (Chrome + Firefox)
│ │ └── src/
│ │ ├── background/ # Service worker
│ │ ├── content/ # Content scripts
│ │ ├── popup/ # Extension popup UI
│ │ ├── lib/ # Shared extension utilities
│ │ ├── utils/ # Helper functions
│ │ ├── locator.ts # DOM element locator logic
│ │ └── youtube.ts # YouTube-specific logic
│ └── e2e/ # End-to-end tests
├── packages/ # Shared packages (if any)
├── turbo.json # Turborepo pipeline config
├── pnpm-workspace.yaml # pnpm workspace config
└── tsconfig.base.json # Shared TS base config

text

## Key Reference Files (load on demand)
- `apps/api/src/main/resources/` — Spring Boot config (application.yml/properties)
- `apps/api/pom.xml` — Java dependencies
- `apps/api/database_queries.sql` — DB query reference
- `live_schema.txt` — Database schema reference
- `apps/web/next.config.ts` — Next.js config
- `apps/extension/manifest.json` — Chrome extension manifest
- `apps/extension/manifest.firefox.json` — Firefox extension manifest
- `tsconfig.base.json` — Shared TypeScript config

## Session & Compaction Guidance
- On `/compact`: keep open TODOs, unresolved bugs, active feature context, design decisions.
- Drop: verbose reasoning, resolved debug logs, old experiment notes.
- Use separate sessions for unrelated apps (e.g. don't mix extension work with API work).
- Ask clarifying questions before scanning entire directories.