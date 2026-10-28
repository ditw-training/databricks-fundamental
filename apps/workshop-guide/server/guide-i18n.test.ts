import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  codeFences,
  guideOverlaySchema,
  localizeGuide,
  localizeGuides,
  OVERLAY_LANGS,
  overlayProblems,
  type GuideOverlay,
} from '../shared/guide-i18n';
import type { Guide } from '../shared/guide-schema';
import { loadGuides, loadOverlays, parseGuide } from './guides';

const fixtures = path.resolve(__dirname, '../fixtures');
const demo: Guide = parseGuide(JSON.parse(readFileSync(path.join(fixtures, 'ws_demo.json'), 'utf8')), 'ws_demo.json');
const demoPl: GuideOverlay = guideOverlaySchema.parse(
  JSON.parse(readFileSync(path.join(fixtures, 'i18n/pl/ws_demo.json'), 'utf8'))
);

describe('guide overlays', () => {
  it('demo overlay fits the demo guide', () => {
    expect(overlayProblems(demo, demoPl)).toEqual([]);
  });

  it('translates text and keeps ids, code and grading', () => {
    const pl = localizeGuide(demo, demoPl);
    const t01 = pl.steps[0];
    expect(t01.title).toBe('Utwórz tabelę Delta');
    expect(t01.type === 'fill' && t01.template).toBe(demo.steps[0].type === 'fill' && demo.steps[0].template);
    expect(t01.hints[2]).toBe(demo.steps[0].hints[2]);
    expect(t01.docs[0].url).toBe(demo.steps[0].docs[0].url);
    expect(pl.steps.map((s) => s.id)).toEqual(demo.steps.map((s) => s.id));
    expect(pl.steps.map((s) => s.check)).toEqual(demo.steps.map((s) => s.check));
    // Untranslated step and fields fall back to English.
    expect(pl.steps[1]).toEqual(demo.steps[1]);
    const match = pl.steps.find((s) => s.id === 't03');
    const english = demo.steps.find((s) => s.id === 't03');
    if (match?.type !== 'match' || english?.type !== 'match') throw new Error('t03 is a match step');
    expect(match.pairs.map((p) => p.left)).toEqual(english.pairs.map((p) => p.left));
    expect(match.pairs[0].right).toMatch(/commitami JSON/);
    expect(match.explain).toBe(english.explain);
  });

  it('keeps the English list when the overlay has another length, and empty text falls back', () => {
    const o = guideOverlaySchema.parse({ id: 'ws_demo', steps: { t01: { title: ' ', hints: ['only one'] } } });
    const pl = localizeGuide(demo, o);
    expect(pl.steps[0].title).toBe(demo.steps[0].title);
    expect(pl.steps[0].hints).toEqual(demo.steps[0].hints);
    expect(overlayProblems(demo, o)).toEqual(['ws_demo/t01: 1 hints, English has 3']);
  });

  it('reports unknown steps and changed code in hints', () => {
    const hints = [...demo.steps[0].hints];
    hints[2] = hints[2].replace('USING DELTA', 'USING PARQUET');
    const o = guideOverlaySchema.parse({ id: 'ws_demo', steps: [{ id: 'nope' }, { id: 't01', hints }] });
    expect(overlayProblems(demo, o)).toEqual([
      'step "nope" does not exist in ws_demo',
      'ws_demo/t01: code in hint 3 differs from English',
    ]);
  });

  it('English and languages without overlays return the guides unchanged', () => {
    expect(localizeGuides([demo], { pl: { ws_demo: demoPl } }, 'en')[0]).toBe(demo);
    expect(localizeGuides([demo], {}, 'pl')[0]).toBe(demo);
  });

  it('a numbered guide gets the label built from its number in the requested language', () => {
    const numbered = { ...demo, number: 2, title: 'Workshop II — Delta Lake' };
    expect(localizeGuide(numbered, demoPl).title).toBe('Warsztat II — Delta Lake');
    expect(localizeGuides([numbered], { pl: { ws_demo: demoPl } }, 'pl')[0].title).toBe('Warsztat II — Delta Lake');
    expect(localizeGuide(demo, demoPl).title).toBe(demoPl.title);
  });

  it('flags inline code and fences changed in intro, explain and expected', () => {
    const t01 = demoPl.steps[0];
    const english = demo.steps.find((s) => s.id === t01.id)!;
    const broken: GuideOverlay = {
      ...demoPl,
      steps: [{ ...t01, expected: `${english.expected} \`renamed_column\`` }, ...demoPl.steps.slice(1)],
    };
    expect(overlayProblems(demo, broken)).toContain(`ws_demo/${t01.id}/expected: inline code differs from English`);
  });

  it('loadOverlays skips overlays of unknown guides', () => {
    const warnings: string[] = [];
    const overlays = loadOverlays(new Map(), fixtures, (m) => warnings.push(m));
    expect(overlays).toEqual({});
    expect(warnings.join('\n')).toMatch(/no guide "ws_demo"/);
    expect(loadOverlays(new Map([[demo.id, demo]]), fixtures).pl?.ws_demo?.steps).toHaveLength(2);
  });
});

/** SPEC section 9: every overlay in the source and in config/guides matches its English guide. */
describe('synced overlays', () => {
  const roots = [
    path.resolve(__dirname, '../config/guides'),
    path.resolve(__dirname, '../../../notebooks/workshops/guide'),
  ].filter((d) => existsSync(d));
  for (const root of roots) {
    const guides = loadGuides(root);
    for (const lang of OVERLAY_LANGS) {
      const dir = path.join(root, 'i18n', lang);
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
      for (const file of files) {
        it(`${path.relative(path.resolve(__dirname, '../../..'), dir)}/${file}: ids exist, lists match, code unchanged`, () => {
          const overlay = guideOverlaySchema.parse(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
          const guide = guides.get(overlay.id);
          expect(guide, `guide ${overlay.id}`).toBeDefined();
          expect(overlayProblems(guide!, overlay)).toEqual([]);
          // Code fences of the localized guide equal the English ones in every hint.
          const pl = localizeGuide(guide!, overlay);
          pl.steps.forEach((s, i) =>
            s.hints.forEach((h, j) => expect(codeFences(h)).toEqual(codeFences(guide!.steps[i].hints[j])))
          );
        });
      }
    }
  }
});
