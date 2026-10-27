/**
 * Live progress, polled every 5 s from the server routes
 * GET /api/progress/me and GET /api/progress/matrix (trainers only).
 *
 * The next poll is scheduled only after the previous one settled, so a cold
 * warehouse never piles up requests. The server shares one warehouse statement
 * per workshop every few seconds between all participants.
 */
import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  participantRowSchema,
  trainerRowSchema,
  type ParticipantRow,
  type TrainerRow,
} from '../../../shared/progress-schema';

export type { ParticipantRow, TrainerRow };

export const POLL_MS = 5000;
const HIDDEN_POLL_MS = 30000;
const REQUEST_TIMEOUT_MS = 60000;

export interface PolledState<Row> {
  rows: Row[] | null;
  error: string | null;
  /** When the server read the rows from the progress table. */
  updatedAt: Date | null;
}

async function fetchRows<Row>(url: string, schema: z.ZodType<Row>, signal: AbortSignal) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  const parsed = z.object({ rows: z.array(schema), fetchedAt: z.string() }).safeParse(await res.json());
  if (!parsed.success) throw new Error('Progress data has an unexpected shape.');
  return parsed.data;
}

function usePolledRows<Row>(url: string, schema: z.ZodType<Row>): PolledState<Row> {
  const [state, setState] = useState<PolledState<Row>>({ rows: null, error: null, updatedAt: null });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    setState({ rows: null, error: null, updatedAt: null });

    const poll = async () => {
      timer = undefined; // in flight: a visibility change must not start a second poll
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);
      try {
        const { rows, fetchedAt } = await fetchRows(url, schema, controller.signal);
        if (!stopped) setState({ rows, error: null, updatedAt: new Date(fetchedAt) });
      } catch (err) {
        if (!stopped) {
          const message = (err as Error).name === 'AbortError' ? 'Request timed out' : (err as Error).message;
          setState((prev) => ({ ...prev, error: message }));
        }
      } finally {
        clearTimeout(timeout);
        if (!stopped) {
          const delay = document.hidden ? HIDDEN_POLL_MS : POLL_MS;
          timer = setTimeout(() => void poll(), delay);
        }
      }
    };

    // Poll right away when the tab becomes visible again.
    const onVisible = () => {
      if (!document.hidden && timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        void poll();
      }
    };

    void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, schema]);

  return state;
}

/** Latest state per step for the signed-in participant (identity resolved on the server). */
export function useParticipantProgress(workshop: string): PolledState<ParticipantRow> {
  return usePolledRows(`/api/progress/me?workshop=${encodeURIComponent(workshop)}`, participantRowSchema);
}

/** Latest state per participant and step (trainer view; the server returns 403 for others). */
export function useTrainerMatrix(workshop: string): PolledState<TrainerRow> {
  return usePolledRows(`/api/progress/matrix?workshop=${encodeURIComponent(workshop)}`, trainerRowSchema);
}
