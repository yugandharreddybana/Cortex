import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
type Endpoint = { method: HttpMethod; path: string };

const APP_ROOT = path.resolve(__dirname, '../../web/src/app');
const API_CONTROLLER_ROOT = path.resolve(__dirname, '../../api/src/main/java/com/cortex/api/controller');
const API_BASE = 'http://127.0.0.1:8080';

const BASELINE_PUBLIC_ROUTES = ['/', '/login', '/signup', '/pricing', '/welcome', '/capture'];

function isServerError(status: number) {
  return status >= 500;
}

function walkFiles(dir: string, matcher: (p: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, matcher));
    if (entry.isFile() && matcher(full)) out.push(full);
  }
  return out;
}

function toRouteFromPageFile(file: string) {
  const rel = path.relative(APP_ROOT, path.dirname(file)).replace(/\\/g, '/');
  return rel === '' ? '/' : `/${rel}`;
}

function materializeDynamicRoute(route: string) {
  return route
    .replace(/\[hash\]/g, 'test-hash')
    .replace(/\[id\]/g, '1')
    .replace(/\[\.\.\.path\]/g, 'health')
    .replace(/\{[^}]+\}/g, '1');
}

function discoverAllAppRoutes() {
  const pageFiles = walkFiles(APP_ROOT, (p) => p.endsWith(`${path.sep}page.tsx`));
  const all = pageFiles.map(toRouteFromPageFile).map(materializeDynamicRoute);
  return Array.from(new Set([...BASELINE_PUBLIC_ROUTES, ...all])).sort();
}

function extractMethodsFromNextRoute(file: string): HttpMethod[] {
  const src = fs.readFileSync(file, 'utf-8');
  const methods: HttpMethod[] = [];
  const tokens: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
  for (const token of tokens) {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${token}\\b`).test(src)) methods.push(token);
  }
  return methods.length ? methods : ['GET'];
}

function discoverNextApiEndpoints(): Endpoint[] {
  const routeFiles = walkFiles(path.join(APP_ROOT, 'api'), (p) => p.endsWith(`${path.sep}route.ts`) || p.endsWith(`${path.sep}route.tsx`));
  const out: Endpoint[] = [];
  for (const file of routeFiles) {
    const relDir = path.relative(path.join(APP_ROOT, 'api'), path.dirname(file)).replace(/\\/g, '/');
    const rawPath = relDir ? `/api/${relDir}` : '/api';
    const apiPath = materializeDynamicRoute(rawPath);
    const methods = extractMethodsFromNextRoute(file);
    for (const method of methods) out.push({ method, path: apiPath });
  }
  return dedupeEndpoints(out).sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function discoverBackendApiEndpoints(): Endpoint[] {
  const files = walkFiles(API_CONTROLLER_ROOT, (p) => p.endsWith('.java'));
  const out: Endpoint[] = [{ method: 'GET', path: `${API_BASE}/actuator/health` }];

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const baseMatch = src.match(/@RequestMapping\("([^"]+)"\)/);
    const base = baseMatch ? baseMatch[1] : '';
    const annotationRegex =
      /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\((?:"([^"]*)")?\)/g;
    let match: RegExpExecArray | null;
    while ((match = annotationRegex.exec(src))) {
      const ann = match[1];
      const suffix = match[2] ?? '';
      const method = ann.replace('Mapping', '').toUpperCase() as HttpMethod;
      const composed = `${base}${suffix}` || '/';
      const safePath = materializeDynamicRoute(composed);
      out.push({ method, path: `${API_BASE}${safePath}` });
    }
  }

  return dedupeEndpoints(out).sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function dedupeEndpoints(endpoints: Endpoint[]) {
  const seen = new Set<string>();
  return endpoints.filter((ep) => {
    const key = `${ep.method} ${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function payloadFor(endpoint: Endpoint) {
  const p = endpoint.path;
  if (p.includes('/auth/login')) return { email: `smoke_${Date.now()}@example.com`, password: 'Password123!' };
  if (p.includes('/auth/signup')) return { email: `smoke_${Date.now()}@example.com`, password: 'Password123!', fullName: 'Smoke User' };
  if (p.includes('/auth/refresh') || p.includes('/refresh-token')) return { refreshToken: 'invalid' };
  if (p.includes('/forgot-password')) return { email: 'smoke@example.com' };
  if (p.includes('/stripe/checkout') || p.includes('/stripe/portal')) return {};
  return {};
}

async function probeInteractions(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const pageErrors: string[] = [];
  const onPageError = (e: Error) => pageErrors.push(e.message);
  page.on('pageerror', onPageError);

  const summary = await page.evaluate(() => {
    const qs = <T extends Element>(s: string) => Array.from(document.querySelectorAll<T>(s));
    return {
      title: document.title,
      url: location.pathname,
      forms: qs('form').length,
      inputs: qs('input').length,
      buttons: qs('button').length,
      selects: qs('select').length,
      links: qs('a[href]').length,
      dialogTriggers: qs('[aria-haspopup="menu"], [aria-haspopup="listbox"], [role="combobox"]').length,
    };
  });

  const clickables = page.locator('button, [role="button"], a[href], [aria-haspopup="menu"], [aria-haspopup="listbox"]');
  const count = await clickables.count();
  const max = Math.min(count, 40);
  for (let i = 0; i < max; i++) {
    const el = clickables.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ trial: true }).catch(() => {});
  }

  const selects = page.locator('select');
  for (let i = 0; i < Math.min(await selects.count(), 20); i++) {
    const sel = selects.nth(i);
    if (!(await sel.isVisible().catch(() => false))) continue;
    await sel.focus().catch(() => {});
    const options = await sel.locator('option').count();
    if (options > 1) await sel.selectOption({ index: 1 }).catch(() => {});
  }

  console.log(`PAGE_COVERAGE ${route}`, JSON.stringify(summary));
  page.off('pageerror', onPageError);
  expect(pageErrors, `Uncaught page errors on route ${route}: ${pageErrors.join(' | ')}`).toEqual([]);
}

test.describe('Full application smoke audit', () => {
  test('all discovered pages load without 5xx', async ({ page }) => {
    const routes = discoverAllAppRoutes();
    console.log('DISCOVERED_APP_ROUTES', JSON.stringify(routes, null, 2));

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response, `No response for ${route}`).toBeTruthy();
      expect(isServerError(response!.status()), `5xx on ${route}`).toBeFalsy();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('broad interaction probe across discovered pages', async ({ page }) => {
    const routes = discoverAllAppRoutes();
    const failures: string[] = [];
    for (const route of routes) {
      try {
        await probeInteractions(page, route);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${route}: ${message}`);
      }
    }
    expect(failures, `Interaction probe failures:\n${failures.join('\n')}`).toEqual([]);
  });

  test('all discovered Next API handlers respond without 5xx', async ({ request }) => {
    const endpoints = discoverNextApiEndpoints();
    console.log('DISCOVERED_NEXT_API_ENDPOINTS', JSON.stringify(endpoints, null, 2));

    for (const ep of endpoints) {
      const response = await request.fetch(ep.path, {
        method: ep.method,
        data: payloadFor(ep),
        failOnStatusCode: false,
      });
      expect(
        isServerError(response.status()),
        `Next API ${ep.method} ${ep.path} returned ${response.status()}`,
      ).toBeFalsy();
    }
  });

  test('all discovered backend controller endpoints respond without 5xx', async ({ request }) => {
    const endpoints = discoverBackendApiEndpoints();
    console.log('DISCOVERED_BACKEND_API_ENDPOINTS', JSON.stringify(endpoints, null, 2));

    for (const ep of endpoints) {
      const response = await request.fetch(ep.path, {
        method: ep.method,
        data: payloadFor(ep),
        failOnStatusCode: false,
      });
      expect(
        isServerError(response.status()),
        `Backend API ${ep.method} ${ep.path} returned ${response.status()}`,
      ).toBeFalsy();
    }
  });
});
