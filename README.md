<div align="center">
  <h1>🧠 Cortex</h1>
  <p><b>A Unified Knowledge Management & Web-Highlighting Platform</b></p>
  <p>Capture, Organize, Synthesize, and Collaborate on ideas effortlessly.</p>
</div>

---

## 📖 What is Cortex?

**Cortex** is a comprehensive knowledge management ecosystem built to bridge the gap between passive consumption (reading articles, watching videos) and active synthesis (writing, organizing, collaborating).

At its core, Cortex consists of:
1. **A Browser Extension** for seamlessly highlighting text, capturing URLs, and saving context directly from the web or YouTube videos.
2. **A Next.js Web Portal** where you can view, organize (via nested folders and tags), export, and collaborate on your highlights in real-time.
3. **A Java Spring Boot Backend** that powers the entire ecosystem, handling secure data storage, strict hierarchical Role-Based Access Control (RBAC), WebSocket real-time synchronization, Stripe subscription management, and deeply integrated AI capabilities.

### 🎯 Who is it for?
- **Students & Academics**: Capture research citations, highlight important textbook passages online, and use AI to automatically draft study outlines.
- **Researchers & Analysts**: Aggregate data points across hundreds of sources. Utilize the "Connect the Dots" AI feature to find semantic linkages across seemingly unrelated research points.
- **Professionals & Creators**: Highlight inspiration across the web. Export compiled folders into markdown or Word documents directly into your publishing workflow.
- **Teams & Collaborators**: Share deep, nested folder hierarchies with granular access control (Viewer, Editor). Collaborate in real-time on curated knowledge bases with live WebSocket synchronization.

### 🚀 How is Cortex Different?
While tools like **Notion Web Clipper**, **Evernote**, **Raindrop.io**, and **Glasp** exist, Cortex differentiates itself through:
- **True Hierarchical Sharing**: Unlike basic bookmark managers that only share flat lists, Cortex allows you to share entire deeply nested folder trees. Access rights cascade down the hierarchy automatically.
- **Offline-First Sync Engine**: The Next.js web portal employs a sophisticated Sync Queue. You can move folders, update highlights, and tag items entirely offline; changes are broadcast across all your open tabs via `BroadcastChannel` and automatically synced to the server once reconnected.
- **Local Deep-AI Integration**: Instead of generic ChatGPT wrappers, Cortex offers specialized built-in AI tools powered by Ollama. Features like "Devil's Advocate" score your highlights for bias, and "Auto-Draft" synthesizes your research into structured outlines.
- **Real-Time Collaboration**: Through Spring Boot WebSockets, when your team members update a shared highlight or add comments, your UI updates instantly without a page refresh.

---

## 🛠 Tech Stack

Cortex is architected as a modern Monorepo using `pnpm` workspaces.

### 🌐 Frontend Web Application (`apps/web`)
- **Framework**: Next.js 15 (App Router)
- **State Management**: Zustand (offline-first sync store)
- **Styling**: Tailwind CSS & Radix UI (`@cortex/ui` shared workspace package)
- **Real-time**: `@stomp/stompjs` for WebSockets, `BroadcastChannel` for cross-tab sync.
- **Testing**: Vitest, React Testing Library, Playwright.

### 🧩 Browser Extension (`apps/extension`)
- **Framework**: React 18 & Vite
- **Architecture**: Content Scripts (for DOM injection and DOM locators), Background Service Workers, and a Popup UI.
- **Features**: YouTube video timestamp capture, intelligent DOM highlighting locators.

### ⚙️ Backend API (`apps/api`)
- **Framework**: Java 21 & Spring Boot 3.x
- **Database**: PostgreSQL (via Supabase / PgBouncer) with Hibernate JPA.
- **Migrations**: Flyway (versioned SQL scripts).
- **Security**: Spring Security, JWT (JSON Web Tokens), granular RBAC (`PermissionService`).
- **AI Integration**: Custom `OllamaService` for local LLM text processing.
- **Payments**: Stripe Java SDK.

---
## ✨ Core Features & Deep Dives

### 1. Robust Web Highlighting & Capture
- **Text Selection & Anchoring**: The browser extension uses intelligent locators (like XPath and text offsets) to reliably find your highlights on dynamic pages even if the DOM changes slightly.
- **YouTube Timestamps**: When capturing a highlight on YouTube, Cortex automatically records the exact video timestamp.
- **Code Highlights**: Special formatting and detection for code snippets.
- **Offline Sync Queue**: Move folders, edit tags, delete highlights entirely offline. Cortex queues mutations and executes them sequentially or concurrently (based on dependencies) when you reconnect. It also broadcasts changes across all open browser tabs.

### 2. Nested Folder Organization & Tags
- **Deep Hierarchies**: Create folders inside folders recursively. The web app uses a highly optimized parent-to-children ID map to achieve $O(N)$ complexity for recursive deletions and hierarchy traversal instead of the traditional $O(N^2)$.
- **Global & Shared Tags**: Tag your highlights by topic and color. When you share a folder, editors can add their own tags to shared highlights without affecting the owner's tag library.

### 3. Real-Time Collaborative Editing
- **WebSocket Integration**: Changes made to shared folders (like a colleague editing a highlight note, or pinning a resource) are instantly pushed via STOMP/WebSockets.
- **Live Commenting**: Threads on highlights allow teams to discuss research asynchronously or in real-time.
- **Shared Notifications**: Get unread badges and notification alerts when you are invited to a folder or someone mentions you in a comment.

### 4. Strict Hierarchical RBAC Permissions
- **Folder-Level Access**: Grant users `VIEWER` `COMMENTER` or `EDITOR` access to specific folders.
- **Inheritance**: Permissions cascade. Giving someone `EDITOR` access to a root folder automatically grants them access to all nested child folders and highlights.
- **Hidden Shared Highlights**: Users can "hide" a shared highlight locally without deleting it for the original owner.

### 5. Deep AI Integrations (Ollama)
Cortex bypasses generic AI chats for built-in workflow accelerators (available on `Pro` tiers):
- **Auto-Draft**: Select a folder, and the AI synthesizes all highlights within it into a structured outline format.
- **Devil's Advocate**: Click on a highlight to have the AI critique the text, warn you of bias or flaws, and assign a Trust Score (1-10).
- **Connect the Dots**: The AI cross-references a specific highlight with your last 100 recent highlights to find semantic linkages and hidden themes.
- **Suggest Actions**: The AI reads a highlight and generates 3 clear, concise actionable steps (e.g., "Create a Jira ticket to...").

### 6. Universal Export
Export any folder or specific highlight collection directly from the Web App into:
- PDF Documents
- Microsoft Word (`.docx`)
- Markdown (`.md`)
- Microsoft Excel (`.xlsx`) or CSV

### 7. Monetization & Subscriptions
- **Stripe Integration**: Supports tiered plans (`starter`, `pro`, `team`).
- **Checkout & Portal**: Backend seamlessly handles Stripe Checkout sessions, Webhook events for subscription upgrades/cancellations, and the Stripe Customer Portal.

---
## 📡 Core API Documentation (Java Backend)

The primary application logic lives in the Spring Boot backend (`/api/v1/`). All secured endpoints require a `Bearer` token. Below is the comprehensive list of endpoints.

### 🔐 Auth (`AuthController`)
- `POST /api/v1/auth/signup`: Create a new user account.
- `POST /api/v1/auth/login`: Authenticate and return JWT access and refresh tokens.
- `POST /api/v1/auth/refresh-token`: Exchange a refresh token for a new JWT.

### 👤 User Profile (`UserController`)
- `GET /api/v1/user/profile`: Retrieve the authenticated user's profile and tier.
- `PUT /api/v1/user/profile`: Update name, avatar, or settings.
- `POST /api/v1/user/change-password`: Update the user's password.

### 📂 Folders (`FolderController`)
- `GET /api/v1/folders`: Retrieve all folders the user has access to.
- `POST /api/v1/folders`: Create a new folder.
- `PUT /api/v1/folders/{id}`: Update a folder (name, emoji).
- `PATCH /api/v1/folders/{id}`: Partially update folder details.
- `DELETE /api/v1/folders/{id}`: Delete a folder and its contents.
- `POST /api/v1/folders/{id}/duplicate`: Clone a folder hierarchy.
- `PUT /api/v1/folders/sync`: Synchronize an array of offline folder mutations.

### 🖍 Highlights (`HighlightController`)
- `GET /api/v1/highlights`: Retrieve all accessible highlights.
- `POST /api/v1/highlights`: Create a new web highlight or note.
- `PUT /api/v1/highlights/{id}`: Update an existing highlight.
- `PATCH /api/v1/highlights/{id}`: Pin, archive, favorite, or move a highlight.
- `DELETE /api/v1/highlights/{id}`: Delete a highlight (or hide it if shared).
- `PUT /api/v1/highlights/sync`: Synchronize an array of offline highlight mutations.

### 🏷 Tags (`TagController`)
- `GET /api/v1/tags`: Retrieve the user's tags.
- `POST /api/v1/tags`: Create a new tag (color, name).
- `PATCH /api/v1/tags/{id}`: Update tag details.
- `DELETE /api/v1/tags/{id}`: Delete a tag.
- `PUT /api/v1/tags/sync`: Synchronize offline tag mutations.

### 💬 Comments (`CommentController`)
- `GET /api/v1/comments`: Retrieve comments for a highlight.
- `POST /api/v1/comments`: Add a comment to a highlight.
- `DELETE /api/v1/comments/{commentId}`: Delete your comment.

### 🤝 Sharing (`ShareController`)
- `POST /api/v1/shares`: Generate a shareable link for a folder/highlight.
- `GET /api/v1/shares/{hash}`: Resolve a share hash.
- `POST /api/v1/shares/{hash}/view`: Log a view on a shared link.
- `POST /api/v1/shares/{hash}/clone`: Clone a shared resource into your own account.
- `GET /api/v1/shares/shared-with-me`: List resources explicitly shared with the user.
- `GET /api/v1/shares/resource`: Retrieve specific resource share details.

### 🛡 Permissions (`PermissionController`)
- `GET /api/v1/permissions/{resourceId}`: View who has access to a specific folder/highlight.
- `POST /api/v1/permissions`: Grant access to a user (VIEWER/COMMENTER/EDITOR).
- `PUT /api/v1/permissions/{permissionId}`: Update access level.
- `DELETE /api/v1/permissions/{permissionId}`: Revoke access.
- `PUT /api/v1/permissions/link-access`: Update public link accessibility rules.
- `GET /api/v1/permissions/access-level`: Check the active user's current access level for a resource.

### 🔔 Notifications (`NotificationController`)
- `GET /api/v1/notifications`: List all notifications.
- `GET /api/v1/notifications/unread-count`: Get the number of unread alerts.
- `PUT /api/v1/notifications/{id}/read`: Mark a single notification as read.
- `PUT /api/v1/notifications/read-all`: Mark all as read.
- `PUT /api/v1/notifications/{id}/respond`: Accept/Reject an invitation.

### 💳 Subscriptions (`StripeController`)
- `POST /api/v1/stripe/checkout`: Create a Stripe Checkout session.
- `POST /api/v1/stripe/portal`: Create a Stripe Customer Portal session.
- `POST /api/v1/stripe/webhook`: Handle Stripe Webhook events.

### 🤖 AI Utilities (`AiController`)
- `POST /api/v1/ai/auto-draft`: Synthesize folder highlights into an outline.
- `POST /api/v1/ai/devils-advocate`: Critique text and assign a trust score.
- `POST /api/v1/ai/connect-dots`: Cross-reference a highlight with recent history.
- `POST /api/v1/ai/suggest-actions`: Extract 3 actionable steps from a highlight.

### 🧩 Browser Extension (`ExtensionTokenController`)
- `POST /api/v1/extension/extension-token`: Generate a long-lived extension token.
- `POST /api/v1/extension/refresh-token`: Refresh the extension token.

### 📥 Export (`ExportController`)
- `GET /api/v1/export`: Export resources (PDF, Docx, Markdown, Excel, CSV).

---

## 🖥 Frontend Proxy API (Next.js BFF)

To maintain security, the Next.js frontend uses a Backend-For-Frontend (BFF) proxy pattern. The frontend never stores JWTs in `localStorage`. Instead, it stores a secure HTTP-Only cookie and calls local Next.js APIs (e.g., `/api/auth`, `/api/folders`).
The Next.js `proxyToJava` utility translates the session cookie into a Bearer token and forwards the request to the Spring Boot backend (`/api/v1/...`).

- `/api/auth/login` - Proxy login, sets HTTP-only secure cookie.
- `/api/auth/logout` - Clears the HTTP-only cookie.
- `/api/auth/refresh` - Transparently refreshes the token.
- All other `/api/*` routes mirror the Java endpoints above but manage the cookie-to-bearer translation.

---
## 🚧 Under Development / Future Features

Cortex is continuously evolving. Based on our current architecture and user feedback, here are the features currently under development or slated for future releases:

1. **Native Mobile Application (iOS & Android)**
   - *Idea*: A React Native or Flutter application to capture highlights on the go directly from mobile browsers via the Share Sheet extension.
   - *Status*: Planning phase.

2. **Advanced AI Autonomous Agents**
   - *Idea*: Beyond single-prompt features like "Devil's Advocate," we plan to introduce autonomous agents that can periodically crawl your saved URLs to check for updates, summarize entire folders proactively, and generate weekly "Knowledge Digests."
   - *Status*: R&D with larger local LLM models and LangChain integration.

3. **Full-Text Semantic Search (Elasticsearch / Vector DB)**
   - *Idea*: Currently, finding highlights relies on explicit organization (folders/tags). We are integrating a Vector Database (like PgVector or Pinecone) to allow semantic, natural language searches across your entire knowledge base (e.g., "Find the highlight where I read about that new JavaScript framework").
   - *Status*: Under Development (Database schema preparation).

4. **Public Portfolio / Knowledge Base Publishing**
   - *Idea*: Allow users to turn a specific root folder into a customized, public-facing website with custom domains and branding—perfect for digital gardens, class syllabi, or public research repositories.
   - *Status*: UI/UX Design phase.

5. **Advanced Analytics Dashboard**
   - *Idea*: Provide users with visual insights into their learning habits. Charts showing highlights captured over time, most active topics, and a "spaced repetition" module to resurface old, forgotten highlights.
   - *Status*: API endpoints drafted; Frontend components under development.

6. **Browser Extension Refinements**
   - *Idea*: Add support for capturing highlights natively from PDFs viewed in the browser and exporting individual highlights to specialized formats like BibTeX for academics.
   - *Status*: PDF.js integration testing in `apps/extension`.

---
## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and `pnpm` >= 10.0.0
- Java 21 & Maven
- PostgreSQL Database
- Docker (optional for local DB/Ollama)

### Environment Setup
1. Copy the example environment variables file and fill in your secrets:
   ```bash
   cp .env.example .env.local
   # Create a backend env as well
   cp .env.example apps/api/.env
   ```
2. Generate a secure 32-character session password:
   ```bash
   openssl rand -base64 32
   ```

### 1. Start the Java Backend (`apps/api`)
```bash
cd apps/api
mvn spring-boot:run
# API server starts on http://localhost:8080
```

### 2. Start the Next.js Frontend (`apps/web`)
```bash
# Install dependencies from monorepo root
pnpm install

# Start the development server
pnpm dev --filter @cortex/web
# Frontend available at http://localhost:3000
```

### 3. Load the Browser Extension (`apps/extension`)
```bash
# Build the extension
pnpm build --filter @cortex/extension
```
Load the `apps/extension/dist` folder as an unpacked extension in Chrome via `chrome://extensions`.

### Running Tests
- **Frontend/Extension**: `pnpm test` (Runs Vitest suites)
- **Backend API**: `cd apps/api && mvn test`
- **End-to-End**: `./API_TEST_SUITE.sh` or Playwright via `cd e2e && pnpm exec playwright test`

---
## 📂 Project Structure Overview

Cortex is organized using `pnpm` workspaces into a monorepo setup:

```
cortex/
├── apps/
│   ├── api/          # Java Spring Boot backend (Core Business Logic)
│   ├── extension/    # React/Vite Chrome Browser Extension (Capture Tool)
│   └── web/          # Next.js Frontend Application (Portal & Viewer)
├── packages/
│   ├── config-eslint/    # Shared ESLint configuration
│   ├── config-tailwind/  # Shared Tailwind CSS design tokens
│   ├── config-typescript/# Shared tsconfig for Node/React packages
│   └── ui/               # Shared Radix UI component library (Button, Dialog, etc.)
├── pnpm-workspace.yaml
└── package.json
```

---

<div align="center">
  <sub>Built with ❤️ for those who want to remember more and synthesize better.</sub>
</div>
