/**
 * Post-build script — copies manifest.json, popup.html, and icons into dist/.
 * Updates popup.html script/css references to point at built files.
 */
import { cpSync, readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const isFirefox = process.env.VITE_FIREFOX === "1";
const dist = isFirefox ? resolve(root, "dist-firefox") : resolve(root, "dist");

// 1. Copy manifest.json (Firefox variant if building for Firefox)
const manifestSrc = isFirefox ? "manifest.firefox.json" : "manifest.json";
cpSync(resolve(root, manifestSrc), resolve(dist, "manifest.json"));

// 2. Generate placeholder icons if they don't exist in source
const iconsDir = resolve(dist, "icons");
if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

// Copy source icons if they exist, otherwise leave generated ones
const srcIcons = resolve(root, "icons");
if (existsSync(srcIcons)) {
  cpSync(srcIcons, iconsDir, { recursive: true });
}

// 3. Find the CSS file name in assets/
const assetsDir = resolve(dist, "assets");
let cssFile = "";
if (existsSync(assetsDir)) {
  const files = readdirSync(assetsDir);
  cssFile = files.find((f) => f.endsWith(".css")) ?? "";
}

// 4. Write popup.html with correct references
const popupHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cortex</title>
  ${cssFile ? `<link rel="stylesheet" href="assets/${cssFile}" />` : ""}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>`;

writeFileSync(resolve(dist, "popup.html"), popupHtml);

console.log("✓ Post-build: manifest.json, popup.html, icons copied to dist/");
