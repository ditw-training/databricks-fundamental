/**
 * Translations of the guide files (apps/SPEC_workshop_guide.md, section 9).
 *
 * The English guide (notebooks/workshops/guide/ws_*.json) is the source of truth. A language
 * overlay (notebooks/workshops/guide/i18n/<lang>/ws_*.json) carries only translatable text, keyed
 * by step id. Code (`template`, `blocks`, `starter`, `blanks`) is never taken from an overlay.
 * A missing or empty field falls back to English; a list (hints, pairs, docs) is used only when it
 * has the same length as the English one.
 */
import { z } from 'zod';
import { TRACKS, workshopLabel, type Guide, type Step } from './guide-schema';
import { quizLangSchema, type QuizLang } from './quiz-schema';

/** UI and guide languages. Same set as the quiz. */
export const langSchema = quizLangSchema;
export type Lang = QuizLang;
export const LANGS: readonly Lang[] = ['pl', 'en'];
/** Languages that come from overlays (English is the guide itself). */
export const OVERLAY_LANGS = ['pl'] as const;
export type OverlayLang = (typeof OVERLAY_LANGS)[number];

const idPattern = /^[a-z0-9_]+$/;

const overlayPairsSchema = z.array(z.object({ left: z.string().optional(), right: z.string().optional() }));

/** Prose of one track's exercise (SPEC section 11). Code (template, blocks) is never translated. */
const overlayVariantSchema = z.object({
  explain_extra: z.string().optional(),
  note: z.string().optional(),
  hints: z.array(z.string()).optional(),
  pairs: overlayPairsSchema.optional(),
});

const overlayStepSchema = z.object({
  id: z.string().regex(idPattern),
  title: z.string().optional(),
  explain: z.string().optional(),
  expected: z.string().optional(),
  hints: z.array(z.string()).optional(),
  /** Match steps: prose of a pair; leave a side out to keep the English (e.g. code). */
  pairs: overlayPairsSchema.optional(),
  /** Track steps: prose of each track's exercise. */
  variants: z.object({ sql: overlayVariantSchema.optional(), pyspark: overlayVariantSchema.optional() }).optional(),
  /** Doc links: only the label is translated; a url here is ignored. */
  docs: z.array(z.object({ label: z.string().optional(), url: z.string().optional() })).optional(),
});

/** Steps as a list (`[{ "id": "t01", ... }]`) or keyed by step id (`{ "t01": { ... } }`). */
const overlayStepsSchema = z.preprocess(
  (v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.entries(v as Record<string, unknown>).map(([id, s]) => (s && typeof s === 'object' ? { id, ...s } : s))
      : v,
  z.array(overlayStepSchema)
);

export const guideOverlaySchema = z
  .object({
    id: z.string().regex(idPattern),
    lang: langSchema.optional(),
    title: z.string().optional(),
    intro: z.string().optional(),
    steps: overlayStepsSchema.default([]),
  })
  .superRefine((o, ctx) => {
    const seen = new Set<string>();
    o.steps.forEach((s, i) => {
      if (seen.has(s.id)) ctx.addIssue({ code: 'custom', path: ['steps', i], message: `duplicate step id "${s.id}"` });
      seen.add(s.id);
    });
  });

export type GuideOverlay = z.infer<typeof guideOverlaySchema>;
type OverlayStep = GuideOverlay['steps'][number];

/** Overlays per language and guide id, as sent by GET /api/guides. */
export type GuideOverlays = Partial<Record<OverlayLang, Record<string, GuideOverlay>>>;

const pick = (translated: string | undefined, english: string) =>
  translated !== undefined && translated.trim() !== '' ? translated : english;

function pickList<E, O>(english: E[], translated: O[] | undefined, merge: (e: E, o: O) => E): E[] {
  if (!translated || translated.length !== english.length) return english;
  return english.map((e, i) => merge(e, translated[i]));
}

function localizeStep<S extends Step>(step: S, o: OverlayStep | undefined): S {
  if (!o) return step;
  const merged = {
    ...step,
    title: pick(o.title, step.title),
    explain: pick(o.explain, step.explain),
    expected: pick(o.expected, step.expected),
    hints: pickList(step.hints, o.hints, (e, t) => pick(t, e)),
    docs: pickList(step.docs, o.docs, (e, t) => ({ ...e, label: pick(t.label, e.label) })),
  };
  if (step.type === 'match') {
    return {
      ...merged,
      pairs: pickList(step.pairs, o.pairs, (e, t) => ({ left: pick(t.left, e.left), right: pick(t.right, e.right) })),
    } as S;
  }
  if (step.type === 'tracks') {
    const variants = { ...step.variants };
    for (const track of TRACKS) {
      const v = step.variants[track];
      const ov = o.variants?.[track];
      if (!v || !ov) continue;
      if (!('type' in v)) {
        variants[track] = { ...v, note: v.note === undefined ? undefined : pick(ov.note, v.note) };
        continue;
      }
      const optional = (en: string | undefined, tr: string | undefined) => (en === undefined ? undefined : pick(tr, en));
      const prose = {
        explain_extra: optional(v.explain_extra, ov.explain_extra),
        note: optional(v.note, ov.note),
        hints: v.hints ? pickList(v.hints, ov.hints, (e, t) => pick(t, e)) : undefined,
      };
      variants[track] =
        v.type === 'match'
          ? { ...v, ...prose, pairs: pickList(v.pairs, ov.pairs, (e, t) => ({ left: pick(t.left, e.left), right: pick(t.right, e.right) })) }
          : { ...v, ...prose };
    }
    return { ...merged, variants } as S;
  }
  return merged;
}

/**
 * The guide with the overlay's text. Ids, order, code and grading stay English, so progress,
 * stored answers and the Check button work the same in every language. A numbered guide gets
 * the label built from its number and topic in `lang` ("Warsztat I — Ingestion"), so the title
 * always matches the numbering; the UI rebuilds the same label with workshopLabel().
 */
export function localizeGuide(guide: Guide, overlay: GuideOverlay | undefined, lang: Lang = 'pl'): Guide {
  if (!overlay || overlay.id !== guide.id) return guide;
  const byId = new Map(overlay.steps.map((s) => [s.id, s]));
  return {
    ...guide,
    title: guide.number ? workshopLabel(guide, lang) : pick(overlay.title, guide.title),
    intro: pick(overlay.intro, guide.intro),
    steps: guide.steps.map((s) => localizeStep(s, byId.get(s.id))),
  };
}

/** Guides in `lang`; English or a language without overlays returns them unchanged. */
export function localizeGuides(guides: Guide[], overlays: GuideOverlays | undefined, lang: Lang): Guide[] {
  if (lang === 'en') return guides;
  const forLang = overlays?.[lang];
  return forLang ? guides.map((g) => localizeGuide(g, forLang[g.id], lang)) : guides;
}

/** Fenced code blocks of a Markdown text, with their language tag. */
export const codeFences = (md: string) => md.match(/```[\s\S]*?```/g) ?? [];

/** Inline `code` spans outside fences, sorted: a translation may move them, never change them. */
export const inlineCode = (md: string) =>
  (md.replace(/```[\s\S]*?```/g, '').match(/`[^`\n]+`/g) ?? []).sort();

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Everything in an overlay that would be ignored or would change code: unknown step ids,
 * lists of a different length, fenced code or inline `code` that differs from the English text
 * (intro, title, explain, expected, hints). Same rules as build_static.py validate_overlay.
 */
export function overlayProblems(guide: Guide, overlay: GuideOverlay): string[] {
  const problems: string[] = [];
  if (overlay.id !== guide.id) problems.push(`overlay id "${overlay.id}" is not guide "${guide.id}"`);
  const compare = (where: string, translated: string | undefined, english: string) => {
    if (translated === undefined) return;
    if (!sameList(codeFences(translated), codeFences(english))) problems.push(`${where}: code fences differ from English`);
    if (!sameList(inlineCode(translated), inlineCode(english))) problems.push(`${where}: inline code differs from English`);
  };
  compare(`${guide.id}/title`, overlay.title, guide.title);
  compare(`${guide.id}/intro`, overlay.intro, guide.intro);
  const steps = new Map(guide.steps.map((s) => [s.id, s]));
  for (const o of overlay.steps) {
    const step = steps.get(o.id);
    if (!step) {
      problems.push(`step "${o.id}" does not exist in ${guide.id}`);
      continue;
    }
    const where = `${guide.id}/${o.id}`;
    if (o.hints && o.hints.length !== step.hints.length) {
      problems.push(`${where}: ${o.hints.length} hints, English has ${step.hints.length}`);
    }
    if (o.docs && o.docs.length !== step.docs.length) {
      problems.push(`${where}: ${o.docs.length} docs, English has ${step.docs.length}`);
    }
    if (o.variants) {
      if (step.type !== 'tracks') problems.push(`${where}: variants on a step without variants`);
      else {
        for (const track of TRACKS) {
          const ov = o.variants[track];
          if (!ov) continue;
          const v = step.variants[track];
          const vwhere = `${where}/${track}`;
          if (!v) {
            problems.push(`${vwhere}: no ${track} variant in English`);
            continue;
          }
          const ex = 'type' in v ? v : null;
          if (ov.hints && ov.hints.length !== (ex?.hints?.length ?? -1)) {
            problems.push(`${vwhere}: ${ov.hints.length} hints, English has ${ex?.hints?.length ?? 0}`);
          }
          if (ov.pairs && (ex?.type !== 'match' || ov.pairs.length !== ex.pairs.length)) {
            problems.push(`${vwhere}: pairs do not fit the English exercise`);
          }
          compare(`${vwhere}/explain_extra`, ov.explain_extra, ex?.explain_extra ?? '');
          compare(`${vwhere}/note`, ov.note, ex ? (ex.note ?? '') : ('note' in v ? (v.note ?? '') : ''));
          ov.hints?.forEach((hint, i) => {
            const english = ex?.hints?.[i];
            if (english === undefined) return;
            if (!sameList(codeFences(hint), codeFences(english))) problems.push(`${vwhere}: code in hint ${i + 1} differs from English`);
            if (!sameList(inlineCode(hint), inlineCode(english))) problems.push(`${vwhere}: inline code in hint ${i + 1} differs from English`);
          });
        }
      }
    }
    // Track steps take pairs from `variants.*.pairs`; legacy top-level pairs next to them are ignored.
    if (o.pairs && step.type !== 'tracks') {
      if (step.type !== 'match') problems.push(`${where}: pairs on a ${step.type} step`);
      else if (o.pairs.length !== step.pairs.length) {
        problems.push(`${where}: ${o.pairs.length} pairs, English has ${step.pairs.length}`);
      }
    }
    compare(`${where}/title`, o.title, step.title);
    compare(`${where}/explain`, o.explain, step.explain);
    compare(`${where}/expected`, o.expected, step.expected);
    o.hints?.forEach((hint, i) => {
      const english = step.hints[i];
      if (english === undefined) return;
      if (!sameList(codeFences(hint), codeFences(english))) {
        problems.push(`${where}: code in hint ${i + 1} differs from English`);
      }
      if (!sameList(inlineCode(hint), inlineCode(english))) {
        problems.push(`${where}: inline code in hint ${i + 1} differs from English`);
      }
    });
  }
  return problems;
}
