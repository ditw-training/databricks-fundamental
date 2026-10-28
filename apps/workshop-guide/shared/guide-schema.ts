/**
 * Guide file contract (apps/SPEC_workshop_guide.md, section 3).
 *
 * Shared by the server (validates every guide at startup and on POST /api/progress)
 * and the client (types only). Keep it in sync with the spec.
 */
import { z } from 'zod';
import type { GuideOverlays, Lang } from './guide-i18n';

const idPattern = /^[a-z0-9_]+$/;

export const docLinkSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
});

const baseStep = {
  id: z.string().regex(idPattern, 'step id: lowercase letters, digits, underscore'),
  title: z.string().min(1),
  optional: z.boolean().default(false),
  explain: z.string().min(1),
  expected: z.string().default(''),
  language: z.string().default('python'),
  hints: z.array(z.string().min(1)).max(5).default([]),
  docs: z.array(docLinkSchema).max(5).default([]),
};

export const blankSchema = z.object({
  answers: z.array(z.string().min(1)).min(1),
  width: z.number().int().positive().max(80).optional(),
  case_sensitive: z.boolean().default(false),
});

export const fillStepSchema = z.object({
  ...baseStep,
  type: z.literal('fill'),
  template: z.string().min(1),
  blanks: z.record(z.string().regex(/^b\d+$/), blankSchema),
  check: z.literal('notebook').default('notebook'),
});

export const orderStepSchema = z.object({
  ...baseStep,
  type: z.literal('order'),
  blocks: z.array(z.object({ id: z.string().min(1), code: z.string().min(1) })).min(2),
  solution: z.array(z.string().min(1)).min(2),
  distractors: z.array(z.string().min(1)).default([]),
  check: z.enum(['notebook', 'app']).default('app'),
});

export const matchStepSchema = z.object({
  ...baseStep,
  type: z.literal('match'),
  pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).min(2),
  check: z.literal('app').default('app'),
});

export const codeStepSchema = z.object({
  ...baseStep,
  type: z.literal('code'),
  starter: z.string().optional(),
  check: z.literal('notebook').default('notebook'),
});

export const stepSchema = z.discriminatedUnion('type', [
  fillStepSchema,
  orderStepSchema,
  matchStepSchema,
  codeStepSchema,
]);

/** Blank placeholders in a fill template: {{b1}}, {{b2}}, ... */
export const BLANK_PATTERN = /\{\{(b\d+)\}\}/g;

export const guideSchema = z
  .object({
    id: z.string().regex(idPattern),
    /** Order of the day: 1 = Ingestion, 2 = Delta Lake (SPEC section 7). */
    number: z.number().int().min(1).max(99).optional(),
    title: z.string().min(1),
    notebook: z.string().min(1),
    intro: z.string().default(''),
    steps: z.array(stepSchema).min(1),
  })
  .superRefine((guide, ctx) => {
    const seen = new Set<string>();
    guide.steps.forEach((step, i) => {
      const path = ['steps', i];
      if (seen.has(step.id)) {
        ctx.addIssue({ code: 'custom', path, message: `duplicate step id "${step.id}"` });
      }
      seen.add(step.id);

      if (step.optional && step.type !== 'code') {
        ctx.addIssue({ code: 'custom', path, message: `optional step "${step.id}" must be type "code"` });
      }

      if (step.type === 'fill') {
        const inTemplate = new Set(Array.from(step.template.matchAll(BLANK_PATTERN), (m) => m[1]));
        const defined = new Set(Object.keys(step.blanks));
        for (const b of inTemplate) {
          if (!defined.has(b)) ctx.addIssue({ code: 'custom', path, message: `blank {{${b}}} has no answers` });
        }
        for (const b of defined) {
          if (!inTemplate.has(b)) ctx.addIssue({ code: 'custom', path, message: `blank "${b}" is not used in template` });
        }
      }

      if (step.type === 'order') {
        const blockIds = step.blocks.map((b) => b.id);
        const all = new Set(blockIds);
        if (all.size !== blockIds.length) {
          ctx.addIssue({ code: 'custom', path, message: 'duplicate block ids' });
        }
        for (const id of [...step.solution, ...step.distractors]) {
          if (!all.has(id)) ctx.addIssue({ code: 'custom', path, message: `unknown block id "${id}"` });
        }
        const overlap = step.solution.filter((id) => step.distractors.includes(id));
        if (overlap.length > 0) {
          ctx.addIssue({ code: 'custom', path, message: `blocks both in solution and distractors: ${overlap.join(', ')}` });
        }
        const covered = new Set([...step.solution, ...step.distractors]);
        for (const id of blockIds) {
          if (!covered.has(id)) ctx.addIssue({ code: 'custom', path, message: `block "${id}" is neither solution nor distractor` });
        }
      }
    });
  });

export type DocLink = z.infer<typeof docLinkSchema>;
export type Blank = z.infer<typeof blankSchema>;
export type FillStep = z.infer<typeof fillStepSchema>;
export type OrderStep = z.infer<typeof orderStepSchema>;
export type MatchStep = z.infer<typeof matchStepSchema>;
export type CodeStep = z.infer<typeof codeStepSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Guide = z.infer<typeof guideSchema>;
export type StepType = Step['type'];

/** Topic of a workshop without the "Workshop II — " / "Warsztat II — " prefix (also legacy "Workshop 2 — "): "Delta Lake". */
export function workshopTopic(guide: Pick<Guide, 'title'>): string {
  return guide.title.replace(/^(Workshop|Warsztat)(\s+[0-9IVXLC]+)?\s*[—–-]\s*/i, '').trim() || guide.title;
}

/** Roman numeral for the workshop number (1..99): 1 -> "I", 2 -> "II", 4 -> "IV". */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 399) return String(n);
  const table: [number, string][] = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rest = n;
  let out = '';
  for (const [value, numeral] of table) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

const WORKSHOP_WORD: Record<Lang, string> = { pl: 'Warsztat', en: 'Workshop' };

/** "Workshop II" / "Warsztat II" when the guide has a number, else null. */
export function workshopShortLabel(guide: Pick<Guide, 'number'>, lang: Lang = 'en'): string | null {
  return guide.number ? `${WORKSHOP_WORD[lang]} ${roman(guide.number)}` : null;
}

/** "Workshop II — Delta Lake" / "Warsztat II — Delta Lake" when the guide has a number, else its title. */
export function workshopLabel(guide: Pick<Guide, 'title' | 'number'>, lang: Lang = 'en'): string {
  const short = workshopShortLabel(guide, lang);
  return short ? `${short} — ${workshopTopic(guide)}` : guide.title;
}

/** Guides in the order of the day: by number (unnumbered last), then id. */
export function sortGuides<G extends Pick<Guide, 'id' | 'number'>>(guides: G[]): G[] {
  return [...guides].sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.id.localeCompare(b.id));
}

/** Who grades the final result of a step. */
export function gradedBy(step: Step): 'notebook' | 'app' {
  return step.check;
}

/** Body of POST /api/progress (app-graded steps only). */
export const progressPostSchema = z.object({
  workshop: z.string().regex(idPattern).max(64),
  step: z.string().regex(idPattern).max(64),
  status: z.enum(['pass', 'fail']),
  message: z.string().trim().max(200).default(''),
  hints_used: z.number().int().min(0).max(20),
  attempts: z.number().int().min(1).max(10_000),
});
export type ProgressPost = z.infer<typeof progressPostSchema>;

/** Response of GET /api/me. */
export interface MeResponse {
  email: string;
  isTrainer: boolean;
}

/** Response of GET /api/guides. */
export interface GuidesResponse {
  /** English guides, ordered by number. With `?lang=pl` already translated. */
  guides: Guide[];
  /** Translation overlays per language and guide id (empty with `?lang=`). */
  overlays: GuideOverlays;
}
