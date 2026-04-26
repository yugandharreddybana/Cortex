import { rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error("clean.mjs: no targets given");
  process.exit(1);
}

for (const t of targets) {
  rmSync(resolve(root, t), { recursive: true, force: true });
  console.log(`✓ removed ${t}`);
}
