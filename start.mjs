#!/usr/bin/env node
/**
 * Cortex — cross-platform dev launcher (Windows / macOS / Linux).
 * - Builds & boots the Spring Boot API on :8080
 * - Boots the Next.js web app on :3001
 * - Builds the extension in watch mode (dist/ for Chromium, dist-firefox/ for FF)
 *
 * Usage:  node start.mjs            (all three)
 * node start.mjs api        (api only)
 * node start.mjs web        (web only)
 * node start.mjs ext        (extension watch only)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === "win32";

// FIX 1: Windows requires a shell to run .cmd files. Mac/Linux do not.
const useShell = isWin;
const pnpm = isWin ? "pnpm.cmd" : "pnpm";
const mvn = isWin ? "mvn.cmd" : "mvn";

const want = new Set(process.argv.slice(2));
const all = want.size === 0;

const procs = [];

function run(name, cmd, args, cwd) {
  const p = spawn(cmd, args, { cwd, stdio: "inherit", shell: useShell });
  p.on("exit", (code) => console.log(`[${name}] exited with code ${code}`));
  procs.push({ name, p });
  return p; // Return the process so we can chain them if needed
}

process.on("SIGINT", () => {
  console.log("\n[cortex] Shutting down all processes...");
  for (const { p } of procs) p.kill("SIGTERM");
  process.exit(0);
});

if (!existsSync(resolve(root, "node_modules"))) {
  console.log("[setup] node_modules missing. Running pnpm install …");
  spawn(pnpm, ["install"], { cwd: root, stdio: "inherit", shell: useShell }).on("exit", boot);
} else {
  boot();
}

function boot() {
  if (all || want.has("api")) {
    // FIX 2: Prevent the race condition by waiting for the build to finish BEFORE booting.
    console.log("[api] Building Spring Boot application...");
    const build = run("api:build", mvn, ["clean", "package", "-DskipTests", "-q"], resolve(root, "apps/api"));

    build.on("exit", (code) => {
      if (code === 0) {
        console.log("[api] Build successful. Booting API...");
        run("api", mvn, ["spring-boot:run"], resolve(root, "apps/api"));
      } else {
        console.error("[api] Build failed! Skipping API boot.");
      }
    });
  }

  if (all || want.has("web")) {
    run("web", pnpm, ["--filter", "@cortex/web", "dev"], root);
  }

  if (all || want.has("ext")) {
    run("ext", pnpm, ["--filter", "@cortex/extension", "dev"], root);
  }
}