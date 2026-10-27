/** Pure helpers for progress rows (no React, unit-tested). */

export type StepStatus = 'pass' | 'fail' | 'none';

export function toStatus(value: string | null | undefined): StepStatus {
  return value === 'pass' || value === 'fail' ? value : 'none';
}

/** Parses the warehouse timestamp string ("2026-10-27 10:15:03.123") as UTC. */
export function parseTs(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAgo(date: Date | null, now: Date = new Date()): string {
  if (!date) return '—';
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return date.toLocaleDateString();
}
