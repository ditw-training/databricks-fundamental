/** POST /api/check and DELETE /api/progress/me (SPEC section 7). */
import { z } from 'zod';

const idPattern = /^[a-z0-9_]+$/;

export const checkPostSchema = z.object({
  workshop: z.string().regex(idPattern).max(64),
  step: z.string().regex(idPattern).max(64),
  /** Hints the participant opened for this step (stored for the trainer view). */
  hints_used: z.number().int().min(0).max(20).default(0),
});
export type CheckPost = z.infer<typeof checkPostSchema>;

/** Result of a check: PASS / FAIL and the message also written to the progress table. */
export interface CheckResponse {
  status: 'pass' | 'fail';
  message: string;
  /** False when the progress row could not be written (the result is still shown). */
  recorded: boolean;
  /**
   * True for the optional "Check on data" of an app-graded step (SPEC section 11): stored for the
   * record, but it never changes the step's status.
   */
  bonus: boolean;
}

/** Query of DELETE /api/progress/me?workshop= (reset my progress in one workshop). */
export const resetQuerySchema = z.object({
  workshop: z.string().regex(idPattern).max(64),
});

export interface ResetResponse {
  ok: true;
}
