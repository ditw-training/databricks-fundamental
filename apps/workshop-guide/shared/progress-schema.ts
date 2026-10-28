import { z } from 'zod';

const nullableNumber = z.coerce.number().nullable().optional().transform((v) => v ?? null);
const nullableString = z.string().nullable().optional().transform((v) => v ?? null);

/** One row of server/sql/latest_progress.sql (latest state per user and step). */
export const progressRowSchema = z.object({
  user_email: z.string(),
  step: z.string(),
  step_type: nullableString,
  status: z.string(),
  message: nullableString,
  hints_used: nullableNumber,
  attempts: nullableNumber,
  source: nullableString,
  ts: z.string(),
  runs: z.coerce.number(),
  /** Tracks with a pass for this step, comma separated ("pyspark,sql"); empty or null = none. */
  tracks: nullableString,
});
export type ProgressRow = z.infer<typeof progressRowSchema>;

/** GET /api/progress/me rows: the signed-in user's own state, no email. */
export const participantRowSchema = progressRowSchema.omit({ user_email: true });
export type ParticipantRow = z.infer<typeof participantRowSchema>;

/** GET /api/progress/matrix rows (trainers only). */
export const trainerRowSchema = progressRowSchema.omit({ step_type: true, source: true });
export type TrainerRow = z.infer<typeof trainerRowSchema>;

export interface ProgressResponse<Row> {
  rows: Row[];
  /** ISO time the rows were read from the table (shared server cache). */
  fetchedAt: string;
}
