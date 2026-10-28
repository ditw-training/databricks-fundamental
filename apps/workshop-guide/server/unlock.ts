/**
 * Trainer unlock (SPEC section 10). Pure helpers, unit-tested; server.ts wires them to the routes.
 *
 * State lives in the progress table as special rows: workshop = '__unlock', step = item id,
 * step_type = 'unlock', status = 'on' | 'off', user_email = trainer, source = 'trainer'.
 * The latest row per item wins; no row = GUIDE_DEFAULT_UNLOCKED (default `none` = locked).
 */
import { z } from 'zod';
import type { GuideOverlays } from '../shared/guide-i18n';
import type { Guide, LockedGuide } from '../shared/guide-schema';
import {
  UNLOCK_ITEMS,
  unlockPostSchema,
  type LockedResponse,
  type UnlockDefault,
  type UnlockItem,
  type UnlockPost,
  type UnlockRow,
} from '../shared/unlock-schema';
import { resolveProgressTable } from './progress';

/** Value of the `workshop` column for unlock rows. Not a guide id, so matrix/reset never see it. */
export const UNLOCK_WORKSHOP = '__unlock';

export function parseDefaultUnlocked(value: string | undefined = process.env.GUIDE_DEFAULT_UNLOCKED): UnlockDefault {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '' || v === 'none') return 'none';
  if (v === 'all') return 'all';
  throw new Error(`GUIDE_DEFAULT_UNLOCKED must be "none" or "all"; got "${value}"`);
}

/** One row of server/sql/unlock_state.sql. */
export const unlockDbRowSchema = z.object({
  step: z.string(),
  status: z.string(),
  user_email: z.string().nullable().optional().transform((v) => v ?? null),
  ts: z.string(),
});
export type UnlockDbRow = z.infer<typeof unlockDbRowSchema>;

export function unlockRowsFromResult(result: unknown): UnlockDbRow[] {
  const data = (result as { data?: unknown } | null | undefined)?.data ?? [];
  const parsed = z.array(unlockDbRowSchema).safeParse(data);
  if (!parsed.success) throw new Error('Unlock rows have an unexpected shape');
  return parsed.data;
}

/** Warehouse timestamps ("2026-10-28 10:00:00.123") as sortable milliseconds. */
const tsMs = (ts: string) => {
  const t = Date.parse(ts.includes('T') ? ts : ts.replace(' ', 'T') + (/[Z+]/.test(ts) ? '' : 'Z'));
  return Number.isNaN(t) ? 0 : t;
};

export type UnlockState = Record<UnlockItem, UnlockRow>;

/**
 * Reduces unlock rows to the state per item: the latest row per item wins, unknown items and
 * statuses other than on/off are ignored, no row = the default. With `trainers`, rows written by
 * anyone else are ignored too (defense in depth: only the app SP can write to the table).
 */
export function reduceUnlock(rows: UnlockDbRow[], fallback: UnlockDefault, trainers?: ReadonlySet<string>): UnlockState {
  const latest = new Map<UnlockItem, UnlockDbRow>();
  for (const r of rows) {
    const item = UNLOCK_ITEMS.find((i) => i === r.step);
    if (!item || (r.status !== 'on' && r.status !== 'off')) continue;
    if (trainers && !trainers.has((r.user_email ?? '').toLowerCase())) continue;
    const prev = latest.get(item);
    if (!prev || tsMs(r.ts) >= tsMs(prev.ts)) latest.set(item, r);
  }
  const state = {} as UnlockState;
  for (const item of UNLOCK_ITEMS) {
    const r = latest.get(item);
    state[item] = r
      ? { item, on: r.status === 'on', by: r.user_email, at: r.ts }
      : { item, on: fallback === 'all', by: null, at: null };
  }
  return state;
}

/**
 * Last good unlock state, used only when a read fails and only while it is recent (default 60 s).
 * After that the caller answers 502 instead of serving a stale state. An older read that
 * finishes after a newer one does not overwrite it.
 */
export class UnlockFallback {
  private last: { state: UnlockState; fetchedAt: string; at: number } | null = null;

  constructor(
    private readonly maxAgeMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  remember(state: UnlockState, fetchedAt: string): void {
    const at = Date.parse(fetchedAt);
    if (Number.isNaN(at) || (this.last && at < this.last.at)) return;
    this.last = { state, fetchedAt, at };
  }

  recent(): { state: UnlockState; fetchedAt: string } | null {
    if (!this.last || this.now() - this.last.at > this.maxAgeMs) return null;
    return { state: this.last.state, fetchedAt: this.last.fetchedAt };
  }
}

/** Rows for GET /api/unlock; participants do not get the trainer e-mail. */
export const unlockRowsFor = (state: UnlockState, isTrainer: boolean): UnlockRow[] =>
  UNLOCK_ITEMS.map((i) => (isTrainer ? state[i] : { ...state[i], by: null }));

/** Trainers always pass; participants only for unlocked items. */
export const canOpen = (state: UnlockState, item: UnlockItem, isTrainer: boolean): boolean =>
  isTrainer || state[item].on;

export const lockedBody = (item: UnlockItem): LockedResponse => ({
  error: 'Locked: your trainer will unlock this at the right moment.',
  locked: true,
  item,
});

export type UnlockValidation =
  | { ok: true; post: UnlockPost; items: UnlockItem[] }
  | { ok: false; status: number; error: string };

/** POST /api/unlock: trainers only (403), then the body shape (400). */
export function validateUnlockPost(body: unknown, isTrainer: boolean): UnlockValidation {
  if (!isTrainer) return { ok: false, status: 403, error: 'Only emails listed in TRAINER_EMAILS can unlock items' };
  const parsed = unlockPostSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: `Body must be {"item": ${UNLOCK_ITEMS.map((i) => `"${i}"`).join(' | ')} | "all", "on": true | false}` };
  }
  const post = parsed.data;
  return { ok: true, post, items: post.item === 'all' ? [...UNLOCK_ITEMS] : [post.item] };
}

/**
 * One INSERT for one or more items (unlock all / lock all). :items is a comma-separated list of
 * validated item ids, bound as a parameter; the values never reach the SQL text.
 */
export function buildUnlockInsert(table: string): string {
  return `INSERT INTO ${resolveProgressTable(table)}
  (user_email, workshop, step, step_type, status, message, hints_used, attempts, source, ts)
SELECT :user_email, '${UNLOCK_WORKSHOP}', item, 'unlock', :status, NULL, NULL, NULL, 'trainer', current_timestamp()
FROM (SELECT explode(split(:items, ',')) AS item)`;
}

/**
 * GET /api/guides for one viewer: full guides for unlocked items (and for trainers), only
 * metadata for locked ones, and overlays only for the guides the viewer gets in full.
 */
export function guidesFor(
  guides: Guide[],
  overlays: GuideOverlays,
  state: UnlockState,
  isTrainer: boolean,
): { guides: Guide[]; locked: LockedGuide[]; overlays: GuideOverlays } {
  const open = (g: Guide) => {
    const item = UNLOCK_ITEMS.find((i) => i === g.id);
    // A guide that is not an unlock item (e.g. a test fixture) is never locked.
    return item ? canOpen(state, item, isTrainer) : true;
  };
  const visible = guides.filter(open);
  const ids = new Set(visible.map((g) => g.id));
  const filtered: GuideOverlays = {};
  for (const [lang, byId] of Object.entries(overlays) as [keyof GuideOverlays, Record<string, unknown>][]) {
    if (!byId) continue;
    filtered[lang] = Object.fromEntries(Object.entries(byId).filter(([id]) => ids.has(id))) as NonNullable<GuideOverlays[typeof lang]>;
  }
  return {
    guides: visible,
    locked: guides.filter((g) => !open(g)).map((g) => ({ id: g.id, number: g.number, title: g.title, locked: true })),
    overlays: filtered,
  };
}
