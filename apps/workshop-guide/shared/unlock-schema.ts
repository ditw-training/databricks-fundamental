/**
 * Trainer unlock (apps/SPEC_workshop_guide.md, section 10): which items of the day
 * (Workshop I, Workshop II, the quiz) participants can open. Shared by server and client.
 */
import { z } from 'zod';

/** Items of the day in order: I — Ingestion, II — Delta Lake, III — Quiz. */
export const UNLOCK_ITEMS = ['ws_ingestion', 'ws_delta', 'quiz'] as const;
export type UnlockItem = (typeof UNLOCK_ITEMS)[number];
export const unlockItemSchema = z.enum(UNLOCK_ITEMS);
export const isUnlockItem = (v: unknown): v is UnlockItem => unlockItemSchema.safeParse(v).success;

/** No unlock row for an item: `none` = locked (default), `all` = unlocked. */
export type UnlockDefault = 'none' | 'all';

/** One item in GET /api/unlock. `by` (trainer e-mail) is sent to trainers only. */
export const unlockRowSchema = z.object({
  item: unlockItemSchema,
  on: z.boolean(),
  by: z.string().nullable(),
  /** Time of the latest trainer change (warehouse time as string); null = default applies. */
  at: z.string().nullable(),
});
export type UnlockRow = z.infer<typeof unlockRowSchema>;

export interface UnlockResponse {
  rows: UnlockRow[];
  fetchedAt: string;
}

/** Body of POST /api/unlock (trainers only): one item or `all`. */
export const unlockPostSchema = z.object({
  item: z.union([unlockItemSchema, z.literal('all')]),
  on: z.boolean(),
});
export type UnlockPost = z.infer<typeof unlockPostSchema>;

/** Body of a 423 response: the item is locked for participants. */
export interface LockedResponse {
  error: string;
  locked: true;
  item: UnlockItem;
}
