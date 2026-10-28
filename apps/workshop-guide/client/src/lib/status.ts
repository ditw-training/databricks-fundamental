/** Pure helpers for progress rows (no React, unit-tested). */

import { dict, type Lang } from '../i18n';

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

export function formatAgo(date: Date | null, now: Date = new Date(), lang: Lang = 'en'): string {
  if (!date) return '—';
  const t = dict(lang);
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 10) return t.agoJustNow;
  if (s < 60) return t.agoSeconds(s);
  const m = Math.round(s / 60);
  if (m < 60) return t.agoMinutes(m);
  const h = Math.round(m / 60);
  if (h < 24) return t.agoHours(h);
  return date.toLocaleDateString(locale(lang));
}

/** BCP 47 locale for dates and times in the UI language. */
export const locale = (lang: Lang) => (lang === 'pl' ? 'pl-PL' : 'en-GB');
