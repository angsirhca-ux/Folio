#!/usr/bin/env node
/**
 * After `next build`, copy static + public into the standalone folder
 * so Electron can run the packaged Next server.
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`copied ${src} → ${dest}`);
}

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No .next/standalone/server.js — run `next build` first.");
  process.exit(1);
}

copyDir(staticSrc, path.join(standalone, ".next", "static"));
copyDir(publicSrc, path.join(standalone, "public"));
console.log("Standalone server is ready for Electron.");
