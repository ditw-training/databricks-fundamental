/**
 * Grading of the in-app exercises (fill / order / match), shared by the client (instant feedback)
 * and the server (POST /api/progress grades the participant's answer again, SPEC section 11).
 * Pure functions, no i18n: messages stored in the progress table are English (SPEC section 9).
 */
import type { Answer, Blank, FillVariant, MatchVariant, OrderVariant, Track, Variant } from './guide-schema';

type FillExercise = Pick<FillVariant, 'template' | 'blanks'>;
type OrderExercise = Pick<OrderVariant, 'blocks' | 'solution' | 'distractors'>;
type MatchExercise = Pick<MatchVariant, 'pairs'>;

const normalize = (value: string, caseSensitive: boolean) => {
  const collapsed = value.trim().replace(/\s+/g, ' ');
  return caseSensitive ? collapsed : collapsed.toLowerCase();
};

/** True when the typed value matches one of the accepted answers. */
export function isBlankCorrect(value: string, blank: Blank): boolean {
  if (!value.trim()) return false;
  const typed = normalize(value, blank.case_sensitive);
  return blank.answers.some((a) => normalize(a, blank.case_sensitive) === typed);
}

export function fillProgress(ex: FillExercise, values: Record<string, string>) {
  const ids = Object.keys(ex.blanks);
  const correct = ids.filter((id) => isBlankCorrect(values[id] ?? '', ex.blanks[id])).length;
  return { correct, total: ids.length };
}

export const enPlural = (n: number, one: string, other: string) => (n === 1 ? one : other);

export interface FillResult {
  pass: boolean;
  correct: number;
  total: number;
  message: string;
}

export function checkFill(ex: FillExercise, values: Record<string, string>): FillResult {
  const { correct, total } = fillProgress(ex, values);
  const pass = correct === total;
  const message = pass ? `All ${total} ${enPlural(total, 'blank', 'blanks')} correct.` : `${correct} of ${total} blanks correct.`;
  return { pass, correct, total, message };
}

export interface OrderResult {
  pass: boolean;
  correctPositions: number;
  total: number;
  distractorsUsed: number;
  missing: number;
  message: string;
}

export function orderMessage(r: Omit<OrderResult, 'message'>): string {
  if (r.pass) return `Correct order: all ${r.total} blocks in place.`;
  const parts = [`${r.correctPositions} of ${r.total} blocks in the right place.`];
  if (r.distractorsUsed > 0) parts.push(`${r.distractorsUsed} ${enPlural(r.distractorsUsed, 'block does', 'blocks do')} not belong here.`);
  if (r.missing > 0) parts.push(`${r.missing} ${enPlural(r.missing, 'block is', 'blocks are')} missing.`);
  return parts.join(' ');
}

/** Grades an order exercise. Blocks with the same code are interchangeable. */
export function checkOrder(ex: OrderExercise, answer: string[]): OrderResult {
  const total = ex.solution.length;
  const code = new Map(ex.blocks.map((b) => [b.id, b.code.trim()]));
  const same = (a: string | undefined, b: string | undefined) => a !== undefined && b !== undefined && (a === b || (code.has(a) && code.get(a) === code.get(b)));
  const pass = answer.length === total && answer.every((id, i) => same(id, ex.solution[i]));
  const correctPositions = answer.filter((id, i) => same(id, ex.solution[i])).length;
  const distractorsUsed = answer.filter((id) => ex.distractors.includes(id)).length;
  const missing = ex.solution.filter((id) => !answer.includes(id)).length;
  const r = { pass, correctPositions, total, distractorsUsed, missing };
  return { ...r, message: orderMessage(r) };
}

export interface MatchResult {
  pass: boolean;
  correct: number;
  total: number;
  message: string;
  /** slot index -> correct? (only for filled slots) */
  slotCorrect: Record<number, boolean>;
}

export const matchMessage = (pass: boolean, correct: number, total: number) =>
  pass ? `All ${total} pairs matched.` : `${correct} of ${total} pairs matched.`;

/**
 * Grades a match exercise. `assignment` maps a description slot (index into `pairs`, i.e. the pair
 * whose `right` text the slot shows) to the index of the pair whose `left` term was dropped there.
 * Duplicate terms or descriptions are interchangeable.
 */
export function checkMatch(ex: MatchExercise, assignment: Record<number, number | null | undefined>): MatchResult {
  const total = ex.pairs.length;
  const slotCorrect: Record<number, boolean> = {};
  let correct = 0;
  ex.pairs.forEach((pair, slot) => {
    const term = assignment[slot];
    if (term === null || term === undefined || term < 0 || term >= total) return;
    const ok = ex.pairs[term].left === pair.left || ex.pairs[term].right === pair.right;
    slotCorrect[slot] = ok;
    if (ok) correct += 1;
  });
  // A term used on two slots cannot make both right.
  const used = Object.values(assignment).filter((t): t is number => typeof t === 'number');
  const pass = correct === total && new Set(used).size === used.length;
  return { pass, correct, total, message: matchMessage(pass, correct, total), slotCorrect };
}

export interface GradeResult {
  pass: boolean;
  message: string;
}

/** Grades an answer against an exercise; null when the answer is for another exercise type. */
export function gradeAnswer(ex: Variant, answer: Answer): GradeResult | null {
  if (ex.type !== answer.type) return null;
  if (ex.type === 'fill' && answer.type === 'fill') return checkFill(ex, answer.values);
  if (ex.type === 'order' && answer.type === 'order') return checkOrder(ex, answer.order);
  if (ex.type === 'match' && answer.type === 'match') {
    if (answer.assignment.length > ex.pairs.length) return { pass: false, message: matchMessage(false, 0, ex.pairs.length) };
    return checkMatch(ex, Object.fromEntries(answer.assignment.map((t, i) => [i, t])));
  }
  return null;
}

const TRACK_PREFIX = /^track=(sql|pyspark)\b\s*(?:·\s*)?/;

/** Progress message with the track in front: "track=pyspark · Correct order: ..." (max 200 chars). */
export const trackMessage = (track: Track, message: string) => `track=${track} · ${message}`.slice(0, 200);

/** Track named at the start of a progress message, else null (notebook or Check rows). */
export function trackFromMessage(message: string | null | undefined): Track | null {
  const m = TRACK_PREFIX.exec(message ?? '');
  return m ? (m[1] as Track) : null;
}

/** The message without the "track=… · " prefix (for display). */
export const stripTrack = (message: string) => message.replace(TRACK_PREFIX, '');
