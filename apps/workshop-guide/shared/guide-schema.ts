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
  /** Shown only in this track (e.g. PySpark API pages); untagged links are shown in both. */
  track: z.enum(['sql', 'pyspark']).optional(),
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
  /**
   * Set by the server at startup: the step has a data check (server/checks) that the participant can
   * run as an optional bonus ("Check on data", SPEC section 11). Never taken from the guide file.
   */
  data_check: z.boolean().default(false),
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

// ── Two tracks (SPEC section 11): one exercise per track ──

export const TRACKS = ['sql', 'pyspark'] as const;
export const trackSchema = z.enum(TRACKS);
export type Track = z.infer<typeof trackSchema>;

/** Prose that a variant may add on top of the shared step text. */
const variantProse = {
  /** Language of the code (syntax and the notebook cell); default: sql for SQL, python for PySpark. */
  language: z.string().optional(),
  /** Extra Markdown shown under the shared explanation for this track only. */
  explain_extra: z.string().optional(),
  /** Track-specific hints; when present they replace the shared step hints (last = full solution). */
  hints: z.array(z.string().min(1)).max(5).optional(),
  /** One line shown above the exercise (e.g. why both tracks use SQL here). */
  note: z.string().optional(),
  /**
   * Lines that save the result for the optional "Check on data" (the tail of the guide's completed
   * `solution` from its "saves your result" comment). Shown in "Notebook (optional)" after the
   * exercise is solved, because the participant's own completed code does not contain them.
   */
  save: z.string().optional(),
};

export const fillVariantSchema = z.object({
  ...variantProse,
  type: z.literal('fill'),
  template: z.string().min(1),
  blanks: z.record(z.string().regex(/^b\d+$/), blankSchema),
});

export const orderVariantSchema = z.object({
  ...variantProse,
  type: z.literal('order'),
  blocks: z.array(z.object({ id: z.string().min(1), code: z.string().min(1) })).min(2),
  solution: z.array(z.string().min(1)).min(2),
  distractors: z.array(z.string().min(1)).default([]),
});

export const matchVariantSchema = z.object({
  ...variantProse,
  type: z.literal('match'),
  pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).min(2),
});

export const variantSchema = z.discriminatedUnion('type', [fillVariantSchema, orderVariantSchema, matchVariantSchema]);

/** "No own exercise for this track: show the other one" (e.g. Delta Lake steps without a PySpark API). */
export const sameAsSchema = z.object({
  same_as: trackSchema,
  note: z.string().optional(),
});

/**
 * Accepted spellings (the guide files are written by hand and by scripts):
 * - `{ "reuse": "sql", "note": ... }` is the same as `{ "same_as": "sql", ... }`;
 * - order: `"order": [ids]` is the block order and then a string `"solution"` is the completed code;
 *   `"solution": [ids]` (legacy spelling) is the block order.
 */
const normalizeVariant = (raw: unknown) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  let v = raw as Record<string, unknown>;
  if (v.type === undefined && v.same_as === undefined && typeof v.reuse === 'string') return { ...v, same_as: v.reuse };
  if (typeof v.solution === 'string' && v.save === undefined) {
    const save = saveLines(v.solution);
    if (save) v = { ...v, save };
  }
  if (v.type === 'order' && Array.isArray(v.order)) return { ...v, solution: v.order };
  return v;
};

/** Comment that starts the "save your result" lines in a completed solution (SQL `--` or Python `#`). */
const SAVE_MARKER = /^[ \t]*(?:--|#)\s*(?:optional:\s*)?saves your result\b.*$/m;

/** The save lines of a completed solution (from the marker comment to the end), else null. */
export function saveLines(solution: string): string | null {
  const m = SAVE_MARKER.exec(solution);
  if (!m) return null;
  const tail = solution.slice(m.index).trim();
  return tail.includes('\n') ? tail : null;
}

const variantOrSameAs = z.preprocess(normalizeVariant, z.union([variantSchema, sameAsSchema]));

export const variantsSchema = z
  .object({
    sql: variantOrSameAs.nullish(),
    pyspark: variantOrSameAs.nullish(),
  })
  .refine((v) => (v.sql && 'type' in v.sql) || (v.pyspark && 'type' in v.pyspark), {
    message: 'variants need at least one exercise (sql or pyspark with a "type")',
  });

/**
 * A step with one exercise per track. Shared prose stays on the step; the exercise lives in
 * `variants`. Graded in the app for every track.
 */
export const tracksStepSchema = z.object({
  ...baseStep,
  type: z.literal('tracks'),
  variants: variantsSchema,
  check: z.literal('app').default('app'),
});

/**
 * Steps with `variants` are track steps, whatever their top-level `type` says (during the move to
 * tracks a guide may keep the legacy fields next to the variants; the variants win).
 */
const normalizeStep = (raw: unknown) =>
  raw && typeof raw === 'object' && !Array.isArray(raw) && (raw as { variants?: unknown }).variants
    ? { ...raw, type: 'tracks', check: 'app' }
    : raw;

export const stepSchema = z.preprocess(
  normalizeStep,
  z.discriminatedUnion('type', [fillStepSchema, orderStepSchema, matchStepSchema, codeStepSchema, tracksStepSchema]),
);

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

      // Legacy steps: only free `code` steps can be optional. Track steps (SPEC section 11) are all
      // graded in the app, so an optional one is a fill/order/match exercise.
      if (step.optional && step.type !== 'code' && step.type !== 'tracks') {
        ctx.addIssue({ code: 'custom', path, message: `optional step "${step.id}" must be type "code"` });
      }

      if (step.type === 'tracks') {
        for (const track of TRACKS) {
          const v = step.variants[track];
          if (!v) continue;
          const vpath = [...path, 'variants', track];
          if (!('type' in v)) {
            const target = step.variants[v.same_as];
            if (v.same_as === track || !target || !('type' in target)) {
              ctx.addIssue({ code: 'custom', path: vpath, message: `same_as "${v.same_as}" must name the other track's exercise` });
            }
            continue;
          }
          for (const message of exerciseProblems(v)) ctx.addIssue({ code: 'custom', path: vpath, message });
        }
        return;
      }
      if (step.type === 'fill' || step.type === 'order') {
        for (const message of exerciseProblems(step)) ctx.addIssue({ code: 'custom', path, message });
      }
    });
  });

/** Consistency of a fill template and its blanks, or of order blocks, solution and distractors. */
function exerciseProblems(ex: Pick<FillVariant, 'type' | 'template' | 'blanks'> | Pick<OrderVariant, 'type' | 'blocks' | 'solution' | 'distractors'> | MatchVariant): string[] {
  const problems: string[] = [];
  if (ex.type === 'fill') {
    const inTemplate = new Set(Array.from(ex.template.matchAll(BLANK_PATTERN), (m) => m[1]));
    const defined = new Set(Object.keys(ex.blanks));
    for (const b of inTemplate) if (!defined.has(b)) problems.push(`blank {{${b}}} has no answers`);
    for (const b of defined) if (!inTemplate.has(b)) problems.push(`blank "${b}" is not used in template`);
  }
  if (ex.type === 'order') {
    const blockIds = ex.blocks.map((b) => b.id);
    const all = new Set(blockIds);
    if (all.size !== blockIds.length) problems.push('duplicate block ids');
    for (const id of [...ex.solution, ...ex.distractors]) if (!all.has(id)) problems.push(`unknown block id "${id}"`);
    const overlap = ex.solution.filter((id) => ex.distractors.includes(id));
    if (overlap.length > 0) problems.push(`blocks both in solution and distractors: ${overlap.join(', ')}`);
    const covered = new Set([...ex.solution, ...ex.distractors]);
    for (const id of blockIds) if (!covered.has(id)) problems.push(`block "${id}" is neither solution nor distractor`);
  }
  return problems;
}

export type DocLink = z.infer<typeof docLinkSchema>;
export type Blank = z.infer<typeof blankSchema>;
export type FillStep = z.infer<typeof fillStepSchema>;
export type OrderStep = z.infer<typeof orderStepSchema>;
export type MatchStep = z.infer<typeof matchStepSchema>;
export type CodeStep = z.infer<typeof codeStepSchema>;
export type TracksStep = z.infer<typeof tracksStepSchema>;
export type FillVariant = z.infer<typeof fillVariantSchema>;
export type OrderVariant = z.infer<typeof orderVariantSchema>;
export type MatchVariant = z.infer<typeof matchVariantSchema>;
export type Variant = z.infer<typeof variantSchema>;
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

/** Who grades the final result of a step: legacy free `code` steps need the Check button. */
export function gradedBy(step: Step): 'notebook' | 'app' {
  return step.type === 'code' ? 'notebook' : 'app';
}

/** The exercise a participant does in a step for the chosen track (SPEC section 11). */
export interface ResolvedExercise {
  /** Track the participant picked (recorded in the progress message). */
  track: Track;
  /** Track whose exercise is shown (differs when the picked track has none). */
  shownTrack: Track;
  /** Null for a legacy free `code` step (graded with Check, not in the app). */
  exercise: Variant | null;
  /** Language of the code: syntax and the notebook cell. */
  language: string;
  hints: string[];
  explainExtra: string | null;
  /** One line above the exercise, from the guide (`note`). */
  note: string | null;
  /** True when the picked track has no exercise of its own and shows the other track's. */
  fallback: boolean;
}

const defaultLanguage = (track: Track) => (track === 'sql' ? 'sql' : 'python');

/**
 * Exercise for `track`: the step's variant, else the other track's (`same_as` or missing), else the
 * legacy fields of a step without variants (same exercise in both tracks).
 */
export function resolveExercise(step: Step, track: Track): ResolvedExercise {
  if (step.type !== 'tracks') {
    const exercise: Variant | null = step.type === 'code' ? null : step;
    return {
      track,
      shownTrack: track,
      exercise,
      language: step.language,
      hints: step.hints,
      explainExtra: null,
      note: null,
      fallback: false,
    };
  }
  const own = step.variants[track];
  const other: Track = track === 'sql' ? 'pyspark' : 'sql';
  let shownTrack: Track = track;
  let variant: Variant | null = own && 'type' in own ? own : null;
  let note = own && !('type' in own) ? (own.note ?? null) : null;
  if (!variant) {
    const target = own && !('type' in own) ? own.same_as : other;
    const fallback = step.variants[target];
    if (fallback && 'type' in fallback) {
      variant = fallback;
      shownTrack = target;
    }
  }
  if (!variant) throw new Error(`step ${step.id} has no exercise`); // excluded by the schema
  note ??= variant.note ?? null;
  return {
    track,
    shownTrack,
    exercise: variant,
    language: variant.language ?? defaultLanguage(shownTrack),
    hints: variant.hints && variant.hints.length > 0 ? variant.hints : step.hints,
    explainExtra: variant.explain_extra?.trim() ? variant.explain_extra : null,
    note,
    fallback: shownTrack !== track,
  };
}

/**
 * Whether the optional data check can pass in this track. A check that reads a scratch table needs
 * the save lines; when another track has them but the shown exercise has none (e.g. a Delta step
 * whose result only PySpark can save), the participant could never pass it, so the app hides it.
 */
export function dataCheckReachable(step: Step, track: Track): boolean {
  if (step.type !== 'tracks') return true;
  const saves = (t: Track) => {
    const v = step.variants[t];
    return Boolean(v && 'type' in v && v.save);
  };
  if (!TRACKS.some(saves)) return true;
  return saves(resolveExercise(step, track).shownTrack);
}

/** Exercise types a step can show (one per distinct track exercise; legacy: its own type). */
export function exerciseTypes(step: Step): Array<Variant['type'] | 'code'> {
  if (step.type !== 'tracks') return [step.type];
  return [...new Set(TRACKS.map((t) => resolveExercise(step, t).exercise?.type).filter((t) => t !== undefined))];
}

/** Answer of a participant, graded again on the server (POST /api/progress). */
export const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fill'), values: z.record(z.string().regex(/^b\d+$/), z.string().max(500)) }),
  z.object({ type: z.literal('order'), order: z.array(z.string().min(1).max(64)).max(100) }),
  /** assignment[slot] = index of the pair whose term was placed on the description of pair `slot`. */
  z.object({ type: z.literal('match'), assignment: z.array(z.number().int().min(0).max(99).nullable()).max(100) }),
]);
export type Answer = z.infer<typeof answerSchema>;

/**
 * Body of POST /api/progress. The server grades `answer` against the guide and decides pass/fail,
 * the step type and the message itself; a `status` sent by the client is ignored.
 */
export const progressPostSchema = z.object({
  workshop: z.string().regex(idPattern).max(64),
  step: z.string().regex(idPattern).max(64),
  track: trackSchema.default('sql'),
  answer: answerSchema,
  hints_used: z.number().int().min(0).max(20),
  attempts: z.number().int().min(1).max(10_000),
});
export type ProgressPost = z.infer<typeof progressPostSchema>;
export type ProgressPostInput = z.input<typeof progressPostSchema>;

/** Response of POST /api/progress: the server's grade, as written to the progress table. */
export interface ProgressPostResponse {
  status: 'pass' | 'fail';
  message: string;
  step_type: Variant['type'];
  track: Track;
}

/** Response of GET /api/me. */
export interface MeResponse {
  email: string;
  isTrainer: boolean;
}

/** A guide the trainer has not unlocked yet (SPEC section 10): metadata only, no steps. */
export interface LockedGuide {
  id: string;
  number?: number;
  title: string;
  locked: true;
}

/** Response of GET /api/guides. */
export interface GuidesResponse {
  /** English guides the viewer can open, ordered by number. With `?lang=pl` already translated. */
  guides: Guide[];
  /** Guides locked for this participant (always empty for trainers). */
  locked: LockedGuide[];
  /** Translation overlays per language and guide id (empty with `?lang=`). */
  overlays: GuideOverlays;
}
