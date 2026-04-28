import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

const ROOT = path.resolve(__dirname, '..');
const AGENT_SCRIPT = path.join(__dirname, 'agent.ts');

let isRunning = false;
let runCount = 0;

function runAgent(trigger: string): Promise<void> {
  if (isRunning) {
    console.log(`⏳ Agent already running, skipping trigger: ${trigger}`);
    return Promise.resolve();
  }

  isRunning = true;
  runCount++;
  console.log(`\n🚀 [Run #${runCount}] Triggered by: ${trigger}`);
  console.log(`⏰ ${new Date().toLocaleTimeString()}\n`);

  return new Promise((resolve) => {
    const proc = exec(`npx ts-node ${AGENT_SCRIPT}`, { cwd: ROOT });
    proc.stdout?.pipe(process.stdout);
    proc.stderr?.pipe(process.stderr);
    proc.on('close', (code) => {
      isRunning = false;
      console.log(`\n✅ Agent run #${runCount} completed (exit code: ${code})`);
      resolve();
    });
  });
}

function startScheduler(): void {
  console.log('🕐 Cortex Auto-QA Scheduler started');
  console.log('   • Runs every 30 minutes automatically');
  console.log('   • Watches apps/ for file changes');
  console.log('   • Press Ctrl+C to stop\n');

  // Run immediately on start
  runAgent('startup');

  // Run every 30 minutes
  setInterval(() => runAgent('scheduled-30min'), 30 * 60 * 1000);

  // Watch for file changes with 10s debounce
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch([
    path.join(ROOT, 'apps/web/src'),
    path.join(ROOT, 'apps/api/src'),
    path.join(ROOT, 'apps/extension/src'),
  ], {
    ignored: [/node_modules/, /\.next/, /dist/, /target/, /\.class$/],
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', (changedFile) => {
    const relative = path.relative(ROOT, changedFile);
    console.log(`\n📁 File changed: ${relative}`);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runAgent(`file-change:${relative}`), 10000);
  });

  // Watch for Spring Boot restart
  const apiLogPath = path.join(ROOT, 'apps/api/spring.log');
  if (fs.existsSync(apiLogPath)) {
    fs.watch(apiLogPath, () => {
      const log = fs.readFileSync(apiLogPath, 'utf-8');
      if (log.includes('Started CortexApiApplication')) {
        console.log('\n🌱 Spring Boot restarted — triggering QA run...');
        setTimeout(() => runAgent('api-restart'), 3000);
      }
    });
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋 Cortex QA Scheduler stopped.');
  process.exit(0);
});

startScheduler();
