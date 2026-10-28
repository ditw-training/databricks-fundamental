/** Pure grading and assembly logic for the interactive exercises (unit-tested). */
import type { Blank, FillStep, MatchStep, OrderStep } from '../../../shared/guide-schema';
import { en } from '../i18n/en';

export type TemplateSegment = { kind: 'text'; value: string } | { kind: 'blank'; id: string };

/** Splits a fill template into text and {{bN}} blank segments. */
export function parseTemplate(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  const pattern = /\{\{(b\d+)\}\}/g;
  let last = 0;
  for (const match of template.matchAll(pattern)) {
    const start = match.index;
    if (start > last) segments.push({ kind: 'text', value: template.slice(last, start) });
    segments.push({ kind: 'blank', id: match[1] });
    last = start + match[0].length;
  }
  if (last < template.length) segments.push({ kind: 'text', value: template.slice(last) });
  return segments;
}

/** Segments with a stable React key: the kind plus the segment's offset in the template. */
export function keyedSegments(template: string): (TemplateSegment & { key: string })[] {
  let at = 0;
  return parseTemplate(template).map((seg) => {
    const key = `${seg.kind}@${at}`;
    at += seg.kind === 'text' ? seg.value.length : seg.id.length + 4; // "{{" + id + "}}"
    return { ...seg, key };
  });
}

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

export type BlankState = 'empty' | 'correct' | 'wrong';

export function blankState(value: string, blank: Blank): BlankState {
  if (!value.trim()) return 'empty';
  return isBlankCorrect(value, blank) ? 'correct' : 'wrong';
}

/** Narrowest blank, in characters. Every blank starts this wide, whatever its answer. */
export const MIN_BLANK_CH = 8;

/**
 * Input width in characters: a fixed minimum that grows with what was typed. It does not
 * depend on the answer (the guide's `width` is ignored), so the box does not give away the
 * answer length and longer wrong input stays visible.
 */
export function blankInputWidth(value: string): number {
  return Math.max(MIN_BLANK_CH, value.length + 1);
}

/** Final code for the notebook; empty blanks stay as ____ so the gap is visible. */
export function assembleFill(step: FillStep, values: Record<string, string>): string {
  return parseTemplate(step.template)
    .map((seg) => (seg.kind === 'text' ? seg.value : values[seg.id]?.trim() || '____'))
    .join('');
}

export function fillProgress(step: FillStep, values: Record<string, string>) {
  const ids = Object.keys(step.blanks);
  const correct = ids.filter((id) => isBlankCorrect(values[id] ?? '', step.blanks[id])).length;
  return { correct, total: ids.length };
}

export interface OrderResult {
  pass: boolean;
  correctPositions: number;
  total: number;
  distractorsUsed: number;
  missing: number;
  message: string;
}

/** Grades an order exercise and builds a short message (max 200 chars). */
export function checkOrder(step: OrderStep, answer: string[]): OrderResult {
  const total = step.solution.length;
  const pass = answer.length === total && answer.every((id, i) => id === step.solution[i]);
  const correctPositions = answer.filter((id, i) => step.solution[i] === id).length;
  const distractorsUsed = answer.filter((id) => step.distractors.includes(id)).length;
  const missing = step.solution.filter((id) => !answer.includes(id)).length;

  // Stored in the progress table and shown to the trainer: always English (SPEC section 9).
  const message = en.orderResult({ pass, total, correctPositions, distractorsUsed, missing });
  return { pass, correctPositions, total, distractorsUsed, missing, message };
}

export function assembleOrder(step: OrderStep, answer: string[]): string {
  const byId = new Map(step.blocks.map((b) => [b.id, b.code]));
  return answer.map((id) => byId.get(id) ?? '').join('\n');
}

export interface MatchResult {
  pass: boolean;
  correct: number;
  total: number;
  message: string;
  /** slot index -> correct? (only for filled slots) */
  slotCorrect: Record<number, boolean>;
}

/**
 * Grades a match exercise. `assignment` maps a description slot (index into
 * step.pairs, i.e. the pair whose `right` text the slot shows) to the index of
 * the pair whose `left` term was dropped there.
 */
export function checkMatch(step: MatchStep, assignment: Record<number, number | null>): MatchResult {
  const total = step.pairs.length;
  const slotCorrect: Record<number, boolean> = {};
  let correct = 0;
  step.pairs.forEach((pair, slot) => {
    const term = assignment[slot];
    if (term === null || term === undefined) return;
    const ok = step.pairs[term].left === pair.left || step.pairs[term].right === pair.right;
    slotCorrect[slot] = ok;
    if (ok) correct += 1;
  });
  const pass = correct === total;
  const message = en.matchResult(pass, correct, total);
  return { pass, correct, total, message, slotCorrect };
}

/** Deterministic shuffle (stable per seed) so the layout does not jump between renders. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
