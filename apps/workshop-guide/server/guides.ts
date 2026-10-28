import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { guideOverlaySchema, OVERLAY_LANGS, overlayProblems, type GuideOverlays } from '../shared/guide-i18n';
import { guideSchema, type Guide } from '../shared/guide-schema';

/** Directory filled by scripts/sync-guides.mjs. */
export const GUIDES_DIR = path.resolve(process.cwd(), 'config', 'guides');

/** Parses one guide file; throws an error that names the file and every problem. */
export function parseGuide(raw: unknown, source: string): Guide {
  const parsed = guideSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid guide ${source}:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Loads and validates every *.json guide in `dir`. Fails fast: a broken guide
 * stops the app at startup instead of showing participants half a workshop.
 */
export function loadGuides(dir: string = GUIDES_DIR): Map<string, Guide> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(`No guide files in ${dir}. Run "npm run sync-guides".`);
  }
  const guides = new Map<string, Guide>();
  for (const file of files) {
    const fullPath = path.join(dir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (err) {
      throw new Error(`Guide ${file} is not valid JSON: ${(err as Error).message}`);
    }
    const guide = parseGuide(raw, file);
    if (guides.has(guide.id)) {
      throw new Error(`Duplicate guide id "${guide.id}" in ${file}`);
    }
    guides.set(guide.id, guide);
  }
  return guides;
}

/**
 * Loads the translation overlays in `<dir>/i18n/<lang>/*.json` (SPEC section 9). A file that is not
 * valid JSON or does not match the schema stops the app (like a broken guide); an overlay for an
 * unknown guide is skipped and the other problems (unknown step, list of another length, changed
 * code in a hint) are logged: those fields fall back to English.
 */
export function loadOverlays(
  guides: Map<string, Guide>,
  dir: string = GUIDES_DIR,
  warn: (msg: string) => void = (m) => console.warn(m)
): GuideOverlays {
  const result: GuideOverlays = {};
  for (const lang of OVERLAY_LANGS) {
    const langDir = path.join(dir, 'i18n', lang);
    if (!existsSync(langDir)) continue;
    const files = readdirSync(langDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    const byId: Record<string, z.infer<typeof guideOverlaySchema>> = {};
    for (const file of files) {
      const source = `i18n/${lang}/${file}`;
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path.join(langDir, file), 'utf8'));
      } catch (err) {
        throw new Error(`Overlay ${source} is not valid JSON: ${(err as Error).message}`);
      }
      const parsed = guideOverlaySchema.safeParse(raw);
      if (!parsed.success) throw new Error(`Invalid overlay ${source}:\n${z.prettifyError(parsed.error)}`);
      const guide = guides.get(parsed.data.id);
      if (!guide) {
        warn(`[workshop-guide] overlay ${source}: no guide "${parsed.data.id}", skipped`);
        continue;
      }
      for (const p of overlayProblems(guide, parsed.data)) warn(`[workshop-guide] overlay ${source}: ${p}`);
      byId[parsed.data.id] = parsed.data;
    }
    if (Object.keys(byId).length > 0) result[lang] = byId;
  }
  return result;
}
