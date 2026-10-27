import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
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
