#!/usr/bin/env node
/**
 * Copies the workshop guide files into the app (config/guides/), where the server
 * loads and validates them at startup.
 *
 * Source: ../../notebooks/workshops/guide/*.json (override with GUIDES_SRC).
 *
 * - Source has guide files  -> config/guides/ is replaced with them.
 * - No source (e.g. the build running on Databricks Apps after `databricks apps deploy`,
 *   where only this folder is uploaded) -> the guides already in config/guides/ are kept.
 * - Nothing anywhere        -> fixtures/ws_demo.json is copied so the app has content.
 * - GUIDES_INCLUDE_DEMO=1   -> the demo fixture is copied as well.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(appRoot, process.env.GUIDES_SRC ?? '../../notebooks/workshops/guide');
const dest = path.join(appRoot, 'config', 'guides');
const demo = path.join(appRoot, 'fixtures', 'ws_demo.json');

const jsonFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];

mkdirSync(dest, { recursive: true });
const sourceFiles = jsonFiles(src);

if (sourceFiles.length > 0) {
  for (const f of jsonFiles(dest)) rmSync(path.join(dest, f));
  for (const f of sourceFiles) copyFileSync(path.join(src, f), path.join(dest, f));
  console.log(`[sync-guides] copied ${sourceFiles.length} guide(s) from ${path.relative(appRoot, src)}: ${sourceFiles.join(', ')}`);
} else if (jsonFiles(dest).length > 0) {
  console.log(`[sync-guides] no source guides at ${path.relative(appRoot, src)}; keeping config/guides: ${jsonFiles(dest).join(', ')}`);
} else {
  copyFileSync(demo, path.join(dest, 'ws_demo.json'));
  console.log('[sync-guides] no guides found; using fixtures/ws_demo.json');
}

if (process.env.GUIDES_INCLUDE_DEMO === '1' && !existsSync(path.join(dest, 'ws_demo.json'))) {
  copyFileSync(demo, path.join(dest, 'ws_demo.json'));
  console.log('[sync-guides] GUIDES_INCLUDE_DEMO=1: added fixtures/ws_demo.json');
}
