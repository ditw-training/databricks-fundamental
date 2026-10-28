/**
 * Trainer unlock (SPEC section 10), polled every 5 s from GET /api/unlock like the progress.
 * The server enforces the lock (423); the client only shows it.
 */
import { useMemo } from 'react';
import {
  UNLOCK_ITEMS,
  unlockRowSchema,
  type UnlockItem,
  type UnlockPost,
  type UnlockResponse,
  type UnlockRow,
} from '../../../shared/unlock-schema';
import { usePolledRows } from './progress';

export type { UnlockItem, UnlockRow };
export { UNLOCK_ITEMS };

export interface UnlockView {
  /** Per item; null until the first poll returns. */
  rows: Partial<Record<UnlockItem, UnlockRow>> | null;
  error: string | null;
  /** Items the viewer can open now (trainers: all). */
  open: (item: UnlockItem) => boolean;
  /** Changes whenever the set of unlocked items changes (refetch key for the guides). */
  signature: string;
}

export function useUnlock(isTrainer: boolean): UnlockView {
  const { rows, error } = usePolledRows('/api/unlock', unlockRowSchema);
  return useMemo(() => {
    const byItem = rows ? Object.fromEntries(rows.map((r) => [r.item, r])) : null;
    const open = (item: UnlockItem) => isTrainer || Boolean(byItem?.[item]?.on);
    return {
      rows: byItem,
      error,
      open,
      signature: isTrainer ? 'trainer' : UNLOCK_ITEMS.filter(open).join(','),
    };
  }, [rows, error, isTrainer]);
}

/** POST /api/unlock (trainers only). */
export async function postUnlock(body: UnlockPost): Promise<UnlockResponse> {
  const res = await fetch('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as UnlockResponse;
}
