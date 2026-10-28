import { TRACKS, type Guide, type Track } from '../../../shared/guide-schema';
import { trackFromMessage } from '../../../shared/grading';
import type { TrainerRow } from './progress';
import { parseTs, toStatus } from './status';
import { parseTracks } from './track';

export interface ParticipantSummary {
  email: string;
  cells: Map<string, TrainerRow>;
  passedRequired: number;
  failing: number;
  hintsTotal: number;
  lastActivity: Date | null;
  /** Tracks this participant works in (passed steps, else the latest answers), SQL first. */
  tracks: Track[];
}

/** Tracks of one cell: those with a pass, else the track of the latest app answer. */
export function cellTracks(row: Pick<TrainerRow, 'tracks' | 'message'> | undefined): Track[] {
  if (!row) return [];
  const passed = parseTracks(row.tracks);
  if (passed.length > 0) return passed;
  const latest = trackFromMessage(row.message);
  return latest ? [latest] : [];
}

export interface StepSummary {
  stepId: string;
  passed: number;
  attempted: number;
  /** passed / participants in the matrix (0..1), null when nobody is in the matrix */
  passRate: number | null;
}

export interface Matrix {
  participants: ParticipantSummary[];
  steps: StepSummary[];
  requiredCount: number;
  finishedRequired: number;
  lastActivity: Date | null;
}

/** Pivots the latest-state rows into participant × step, plus per-step pass rates. */
export function buildMatrix(guide: Guide, rows: TrainerRow[]): Matrix {
  const stepIds = new Set(guide.steps.map((s) => s.id));
  const required = guide.steps.filter((s) => !s.optional).map((s) => s.id);
  const byUser = new Map<string, ParticipantSummary>();

  for (const row of rows) {
    if (!stepIds.has(row.step)) continue; // rows for steps no longer in the guide
    let p = byUser.get(row.user_email);
    if (!p) {
      p = { email: row.user_email, cells: new Map(), passedRequired: 0, failing: 0, hintsTotal: 0, lastActivity: null, tracks: [] };
      byUser.set(row.user_email, p);
    }
    p.cells.set(row.step, row);
    const ts = parseTs(row.ts);
    if (ts && (!p.lastActivity || ts > p.lastActivity)) p.lastActivity = ts;
  }

  const participants = [...byUser.values()].sort((a, b) => a.email.localeCompare(b.email));
  for (const p of participants) {
    p.passedRequired = required.filter((id) => toStatus(p.cells.get(id)?.status) === 'pass').length;
    p.failing = [...p.cells.values()].filter((r) => toStatus(r.status) === 'fail').length;
    p.hintsTotal = [...p.cells.values()].reduce((sum, r) => sum + (r.hints_used ?? 0), 0);
    const used = new Set([...p.cells.values()].flatMap((r) => cellTracks(r)));
    p.tracks = TRACKS.filter((t) => used.has(t));
  }

  const steps = guide.steps.map((s) => {
    const cells = participants.map((p) => p.cells.get(s.id)).filter((c): c is TrainerRow => c !== undefined);
    const passed = cells.filter((c) => toStatus(c.status) === 'pass').length;
    return {
      stepId: s.id,
      passed,
      attempted: cells.length,
      passRate: participants.length ? passed / participants.length : null,
    };
  });

  const lastActivity = participants.reduce<Date | null>(
    (acc, p) => (p.lastActivity && (!acc || p.lastActivity > acc) ? p.lastActivity : acc),
    null,
  );

  return {
    participants,
    steps,
    requiredCount: required.length,
    finishedRequired: participants.filter((p) => required.length > 0 && p.passedRequired === required.length).length,
    lastActivity,
  };
}
