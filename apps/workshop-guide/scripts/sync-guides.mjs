#!/usr/bin/env node
/**
 * Copies the workshop guide files into the app (config/guides/), where the server
 * loads and validates them at startup.
 *
 * Source: ../../notebooks/workshops/guide/*.json (override with GUIDES_SRC), plus the
 * translation overlays in <source>/i18n/<lang>/*.json -> config/guides/i18n/<lang>/.
 *
 * - Source has guide files  -> config/guides/ (guides and overlays) is replaced with them.
 * - No source (e.g. the build running on Databricks Apps after `databricks apps deploy`,
 *   where only this folder is uploaded) -> the guides already in config/guides/ are kept.
 * - Nothing anywhere        -> fixtures/ws_demo.json is copied so the app has content.
 * - GUIDES_INCLUDE_DEMO=1   -> the demo fixture (and its overlays) is copied as well.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(appRoot, process.env.GUIDES_SRC ?? '../../notebooks/workshops/guide');
const dest = path.join(appRoot, 'config', 'guides');
const demo = path.join(appRoot, 'fixtures', 'ws_demo.json');
const demoI18n = path.join(appRoot, 'fixtures', 'i18n');

const jsonFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
const langDirs = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((d) => /^[a-z]{2}$/.test(d) && statSync(path.join(dir, d)).isDirectory()).sort() : [];

/** Copies <from>/<lang>/*.json to config/guides/i18n/<lang>/ (only files named in `only`, if given). */
function copyOverlays(from, only) {
  const copied = [];
  for (const lang of langDirs(from)) {
    const files = jsonFiles(path.join(from, lang)).filter((f) => !only || only.includes(f));
    if (files.length === 0) continue;
    mkdirSync(path.join(dest, 'i18n', lang), { recursive: true });
    for (const f of files) copyFileSync(path.join(from, lang, f), path.join(dest, 'i18n', lang, f));
    copied.push(`${lang}: ${files.join(', ')}`);
  }
  return copied;
}

mkdirSync(dest, { recursive: true });
const sourceFiles = jsonFiles(src);

if (sourceFiles.length > 0) {
  for (const f of jsonFiles(dest)) rmSync(path.join(dest, f));
  rmSync(path.join(dest, 'i18n'), { recursive: true, force: true });
  for (const f of sourceFiles) copyFileSync(path.join(src, f), path.join(dest, f));
  const overlays = copyOverlays(path.join(src, 'i18n'));
  console.log(`[sync-guides] copied ${sourceFiles.length} guide(s) from ${path.relative(appRoot, src)}: ${sourceFiles.join(', ')}`);
  console.log(`[sync-guides] overlays: ${overlays.length ? overlays.join('; ') : 'none'}`);
} else if (jsonFiles(dest).length > 0) {
  console.log(`[sync-guides] no source guides at ${path.relative(appRoot, src)}; keeping config/guides: ${jsonFiles(dest).join(', ')}`);
} else {
  copyFileSync(demo, path.join(dest, 'ws_demo.json'));
  copyOverlays(demoI18n, ['ws_demo.json']);
  console.log('[sync-guides] no guides found; using fixtures/ws_demo.json');
}

if (process.env.GUIDES_INCLUDE_DEMO === '1' && !existsSync(path.join(dest, 'ws_demo.json'))) {
  copyFileSync(demo, path.join(dest, 'ws_demo.json'));
  copyOverlays(demoI18n, ['ws_demo.json']);
  console.log('[sync-guides] GUIDES_INCLUDE_DEMO=1: added fixtures/ws_demo.json');
}
