/**
 * Local HTTP server that serves:
 * - /plugin/*    → Plugin files (manifest, index.html, main.js, icon)
 * - /data/*      → Extracted JSON files
 *
 * Usage: npm run serve
 */

import express from "express";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";

const PORT = 4400;
const ROOT = resolve(import.meta.dirname, "../..");

const app = express();

// CORS headers — required for Penpot to load the plugin
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Serve plugin files
const pluginDir = join(ROOT, "src", "plugin");
app.use("/plugin", express.static(pluginDir));

// Serve manifest.json at root (Penpot expects it there)
app.get("/manifest.json", (_req, res) => {
  res.sendFile(join(pluginDir, "manifest.json"));
});

// Serve extraction JSON files from project root
app.get("/data/:filename", (req, res) => {
  const filePath = join(ROOT, req.params.filename);
  if (!existsSync(filePath)) {
    return res
      .status(404)
      .json({ error: `File not found: ${req.params.filename}` });
  }
  res.sendFile(filePath);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", port: PORT });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║            DOM to Penpot — Server                ║
  ╠══════════════════════════════════════════════════╣
  ║                                                  ║
  ║  Plugin manifest:                                ║
  ║  http://localhost:${PORT}/manifest.json            ║
  ║                                                  ║
  ║  Plugin UI:                                      ║
  ║  http://localhost:${PORT}/plugin/                  ║
  ║                                                  ║
  ║  Extraction data:                                ║
  ║  http://localhost:${PORT}/data/extraction.json     ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
  `);
});
