import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { Lock, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Guide } from '../../../shared/guide-schema';
import { StatusDot } from '../components/StatusDot';
import { statusLabel, TYPE_LABEL } from '../lib/labels';
import { useTrainerMatrix, type TrainerRow } from '../lib/progress';
import { formatAgo, parseTs, toStatus } from '../lib/status';
import { buildMatrix } from '../lib/trainer';

export function TrainerPage({ guides, isTrainer }: { guides: Guide[]; isTrainer: boolean }) {
  const [params, setParams] = useSearchParams();

  if (!isTrainer) {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Trainer view</EmptyTitle>
          <EmptyDescription>
            This page is for trainers. Ask the trainer to add your email to <code>TRAINER_EMAILS</code> in the app configuration.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const guide = guides.find((g) => g.id === params.get('ws')) ?? guides[0];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Group progress</h2>
          <p className="text-sm text-muted-foreground">Latest result per participant and step. Refreshes every 5 seconds.</p>
        </div>
        <Select value={guide.id} onValueChange={(id) => setParams({ ws: id })}>
          <SelectTrigger className="w-72" aria-label="Workshop">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {guides.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TrainerMatrix key={guide.id} guide={guide} />
    </div>
  );
}

function TrainerMatrix({ guide }: { guide: Guide }) {
  const { rows, error, updatedAt } = useTrainerMatrix(guide.id);
  const matrix = useMemo(() => buildMatrix(guide, rows ?? []), [guide, rows]);
  const loading = rows === null && !error;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Participants" value={loading ? null : String(matrix.participants.length)} note="with at least one result" />
        <Kpi
          label="Finished all required"
          value={loading ? null : `${matrix.finishedRequired}`}
          note={`of ${matrix.participants.length} · ${matrix.requiredCount} required steps`}
        />
        <Kpi
          label="Stuck right now"
          value={loading ? null : String(matrix.participants.filter((p) => p.failing > 0).length)}
          note="latest result on a step is a fail"
        />
        <Kpi label="Last activity" value={loading ? null : formatAgo(matrix.lastActivity)} note="any participant" />
      </div>

      {/* No aria-live on the timestamp: it changes on every poll. Only errors are announced. */}
      <p className="text-xs text-muted-foreground">
        {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · source: progress table` : error ? '' : 'Loading…'}
      </p>
      <p role="status" className={error ? 'text-xs text-[var(--destructive)]' : 'sr-only'}>
        {error
          ? rows === null
            ? `Could not load the matrix: ${error}`
            : `Could not refresh: ${error}. Showing the last data received; retrying.`
          : ''}
      </p>

      {rows === null && error ? null : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : matrix.participants.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No results yet</EmptyTitle>
            <EmptyDescription>
              Participants appear here after their first <code>check()</code> in the notebook or their first checked exercise in the
              guide.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="wg-matrix">
                <caption className="sr-only">
                  {guide.title}: result per participant and step
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="wg-matrix-sticky text-left">
                      Participant
                    </th>
                    {guide.steps.map((s, i) => (
                      <th key={s.id} scope="col" title={`${s.title} — ${TYPE_LABEL[s.type]}${s.optional ? ' (optional)' : ''}`}>
                        <span className={s.optional ? 'text-muted-foreground' : undefined}>{String(i + 1).padStart(2, '0')}</span>
                        {s.optional && <span className="block text-[10px] font-normal text-muted-foreground">opt</span>}
                      </th>
                    ))}
                    <th scope="col">Done</th>
                    <th scope="col">Hints</th>
                    <th scope="col" className="text-right">
                      Last activity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.participants.map((p) => (
                    <tr key={p.email}>
                      <th scope="row" className="wg-matrix-sticky max-w-56 truncate text-left font-normal" title={p.email}>
                        {p.email}
                      </th>
                      {guide.steps.map((s) => (
                        <td key={s.id} className="text-center">
                          <Cell row={p.cells.get(s.id)} stepTitle={s.title} />
                        </td>
                      ))}
                      <td className="text-center tabular-nums">
                        {p.passedRequired}/{matrix.requiredCount}
                      </td>
                      <td className="text-center tabular-nums">{p.hintsTotal || '—'}</td>
                      <td className="whitespace-nowrap text-right text-muted-foreground">{formatAgo(p.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="wg-matrix-sticky text-left">
                      Pass rate
                    </th>
                    {matrix.steps.map((s) => (
                      <td key={s.stepId} className="text-center tabular-nums" title={`${s.passed} passed, ${s.attempted} tried`}>
                        {s.passRate === null ? '—' : `${Math.round(s.passRate * 100)}%`}
                      </td>
                    ))}
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Legend />
    </>
  );
}

function Cell({ row, stepTitle }: { row: TrainerRow | undefined; stepTitle: string }) {
  const status = toStatus(row?.status);
  const ts = parseTs(row?.ts);
  const details = row
    ? [
        `${stepTitle}: ${statusLabel(status)}`,
        row.message ?? '',
        `${row.runs} run${row.runs === 1 ? '' : 's'}`,
        row.hints_used !== null ? `hints: ${row.hints_used}` : '',
        row.attempts !== null ? `attempts: ${row.attempts}` : '',
        ts ? ts.toLocaleTimeString() : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : `${stepTitle}: not started`;
  return (
    <span className="inline-flex items-center justify-center" title={details}>
      <StatusDot status={status} />
      {row?.hints_used ? <span className="wg-hint-count" aria-label={`${row.hints_used} hints`}>{row.hints_used}</span> : null}
      <span className="sr-only">{details}</span>
    </span>
  );
}

function Kpi({ label, value, note }: { label: string; value: string | null; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {value === null ? <Skeleton className="mt-2 h-7 w-16" /> : <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>}
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="pass" /> passed
      </li>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="fail" /> latest check failed
      </li>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="none" /> not started
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="wg-hint-count">2</span> hints used (app-graded steps)
      </li>
    </ul>
  );
}
