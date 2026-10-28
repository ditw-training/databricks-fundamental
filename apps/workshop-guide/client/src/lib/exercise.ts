/** Pure grading and assembly logic for the interactive exercises (unit-tested). */
import type { Blank, FillVariant, OrderVariant } from '../../../shared/guide-schema';
import { isBlankCorrect } from '../../../shared/grading';

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

export { checkFill, checkMatch, checkOrder, fillProgress, isBlankCorrect } from '../../../shared/grading';
export type { FillResult, MatchResult, OrderResult } from '../../../shared/grading';

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
export function assembleFill(ex: Pick<FillVariant, 'template'>, values: Record<string, string>): string {
  return parseTemplate(ex.template)
    .map((seg) => (seg.kind === 'text' ? seg.value : values[seg.id]?.trim() || '____'))
    .join('');
}

export function assembleOrder(ex: Pick<OrderVariant, 'blocks'>, answer: string[]): string {
  const byId = new Map(ex.blocks.map((b) => [b.id, b.code]));
  return answer.map((id) => byId.get(id) ?? '').join('\n');
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
