import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

const TARGET_PATHS = [
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/layout.tsx',
  'apps/web/src/app/error.tsx',
  'apps/web/src/app/not-found.tsx',
  'apps/web/src/app/login',
  'apps/web/src/app/signup',
  'apps/web/src/app/dashboard',
  'apps/web/src/app/capture',
  'apps/web/src/app/pricing',
  'apps/web/src/app/share',
  'apps/web/src/app/welcome',
  'apps/web/src/app/api',
  'apps/web/src/middleware.ts',
  'apps/web/src/store',
  'apps/web/src/hooks',
  'apps/web/src/lib',
  'apps/api/src/main/java/com/cortex/api/controller',
  'apps/api/src/main/java/com/cortex/api/service',
];

function readFilesSafe(filePath: string): { file: string; content: string }[] {
  const results: { file: string; content: string }[] = [];
  const abs = path.join(ROOT, filePath);

  if (!fs.existsSync(abs)) return results;

  const stat = fs.statSync(abs);

  if (stat.isFile()) {
    const ext = path.extname(abs);
    if (['.ts', '.tsx', '.js', '.jsx', '.java', '.json', '.md'].includes(ext)) {
      const content = fs.readFileSync(abs, 'utf-8');
      results.push({ file: filePath, content: content.slice(0, 4000) });
    }
  } else if (stat.isDirectory()) {
    const entries = fs.readdirSync(abs);
    for (const entry of entries) {
      if (['node_modules', '.next', 'dist', '__snapshots__', 'target'].includes(entry)) continue;
      results.push(...readFilesSafe(path.join(filePath, entry)));
    }
  }

  return results;
}

export function buildCodeContext(): string {
  const allFiles: { file: string; content: string }[] = [];

  for (const targetPath of TARGET_PATHS) {
    allFiles.push(...readFilesSafe(targetPath));
  }

  const sections = allFiles.map(
    ({ file, content }) => `\n\n### FILE: ${file}\n\`\`\`\n${content}\n\`\`\``
  );

  return `
# CORTEX CODEBASE CONTEXT

## Architecture Summary
- **Frontend**: Next.js 15 App Router — pages: /, /login, /signup, /dashboard, /capture, /pricing, /share, /welcome
- **Auth pattern**: BFF proxy — HTTP-only cookie → Bearer JWT forwarded to Java API
- **State**: Zustand offline-first sync store with BroadcastChannel cross-tab sync
- **Backend**: Java Spring Boot 3 at localhost:8080, PostgreSQL via Supabase
- **AI**: Ollama OllamaService for auto-draft, devils-advocate, connect-dots, suggest-actions
- **Real-time**: STOMP WebSockets for collaboration
- **Payments**: Stripe with webhook handling
- **Extension**: React/Vite Chrome extension with content scripts + background service worker

## Source Files (${allFiles.length} files read)
${sections.join('')}
`.slice(0, 80000);
}

export function getAppRoutes(): string[] {
  return [
    '/',
    '/login',
    '/signup',
    '/dashboard',
    '/capture',
    '/pricing',
    '/share/[hash]',
    '/welcome',
  ];
}

export function getApiRoutes(): { method: string; path: string; auth: boolean; tier?: string }[] {
  return [
    { method: 'POST', path: '/api/v1/auth/signup', auth: false },
    { method: 'POST', path: '/api/v1/auth/login', auth: false },
    { method: 'POST', path: '/api/v1/auth/refresh-token', auth: false },
    { method: 'GET', path: '/api/v1/user/profile', auth: true },
    { method: 'PUT', path: '/api/v1/user/profile', auth: true },
    { method: 'POST', path: '/api/v1/user/change-password', auth: true },
    { method: 'GET', path: '/api/v1/folders', auth: true },
    { method: 'POST', path: '/api/v1/folders', auth: true },
    { method: 'PUT', path: '/api/v1/folders/:id', auth: true },
    { method: 'PATCH', path: '/api/v1/folders/:id', auth: true },
    { method: 'DELETE', path: '/api/v1/folders/:id', auth: true },
    { method: 'POST', path: '/api/v1/folders/:id/duplicate', auth: true },
    { method: 'PUT', path: '/api/v1/folders/sync', auth: true },
    { method: 'GET', path: '/api/v1/highlights', auth: true },
    { method: 'POST', path: '/api/v1/highlights', auth: true },
    { method: 'PUT', path: '/api/v1/highlights/:id', auth: true },
    { method: 'PATCH', path: '/api/v1/highlights/:id', auth: true },
    { method: 'DELETE', path: '/api/v1/highlights/:id', auth: true },
    { method: 'PUT', path: '/api/v1/highlights/sync', auth: true },
    { method: 'GET', path: '/api/v1/tags', auth: true },
    { method: 'POST', path: '/api/v1/tags', auth: true },
    { method: 'PATCH', path: '/api/v1/tags/:id', auth: true },
    { method: 'DELETE', path: '/api/v1/tags/:id', auth: true },
    { method: 'GET', path: '/api/v1/comments', auth: true },
    { method: 'POST', path: '/api/v1/comments', auth: true },
    { method: 'DELETE', path: '/api/v1/comments/:id', auth: true },
    { method: 'POST', path: '/api/v1/shares', auth: true },
    { method: 'GET', path: '/api/v1/shares/:hash', auth: false },
    { method: 'POST', path: '/api/v1/shares/:hash/view', auth: false },
    { method: 'POST', path: '/api/v1/shares/:hash/clone', auth: true },
    { method: 'GET', path: '/api/v1/shares/shared-with-me', auth: true },
    { method: 'GET', path: '/api/v1/permissions/:resourceId', auth: true },
    { method: 'POST', path: '/api/v1/permissions', auth: true },
    { method: 'PUT', path: '/api/v1/permissions/:id', auth: true },
    { method: 'DELETE', path: '/api/v1/permissions/:id', auth: true },
    { method: 'GET', path: '/api/v1/notifications', auth: true },
    { method: 'GET', path: '/api/v1/notifications/unread-count', auth: true },
    { method: 'PUT', path: '/api/v1/notifications/read-all', auth: true },
    { method: 'POST', path: '/api/v1/ai/auto-draft', auth: true, tier: 'pro' },
    { method: 'POST', path: '/api/v1/ai/devils-advocate', auth: true, tier: 'pro' },
    { method: 'POST', path: '/api/v1/ai/connect-dots', auth: true, tier: 'pro' },
    { method: 'POST', path: '/api/v1/ai/suggest-actions', auth: true, tier: 'pro' },
    { method: 'GET', path: '/api/v1/export', auth: true },
    { method: 'POST', path: '/api/v1/stripe/checkout', auth: true },
    { method: 'POST', path: '/api/v1/stripe/portal', auth: true },
  ];
}
