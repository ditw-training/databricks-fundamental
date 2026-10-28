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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import { Lock, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { workshopLabel, type Guide } from '../../../shared/guide-schema';
import { Kpi } from '../components/Kpi';
import { StatusDot } from '../components/StatusDot';
import { useI18n } from '../i18n/context';
import { statusLabel, typeLabel } from '../lib/labels';
import { useTrainerMatrix, type TrainerRow } from '../lib/progress';
import { formatAgo, locale, parseTs, toStatus } from '../lib/status';
import { buildMatrix } from '../lib/trainer';
import { QuizStatsView } from './QuizStatsView';

export function TrainerPage({ guides, isTrainer }: { guides: Guide[]; isTrainer: boolean }) {
  const { lang, m } = useI18n();
  const [params, setParams] = useSearchParams();

  if (!isTrainer) {
    return (
      <Empty className="mt-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Lock aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{m.trainerTitle}</EmptyTitle>
          <EmptyDescription>
            {m.trainerOnly} <code>TRAINER_EMAILS</code> {m.trainerOnlyAfter}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const tab = params.get('tab') === 'quiz' ? 'quiz' : 'workshops';
  const guide = guides.find((g) => g.id === params.get('ws')) ?? guides[0];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{m.groupProgress}</h2>
          <p className="text-sm text-muted-foreground">
            {tab === 'quiz' ? m.trainerIntroQuiz : m.trainerIntroWorkshops}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setParams(v === 'quiz' ? { tab: 'quiz' } : { ws: guide.id })}>
            <TabsList aria-label={m.trainerTitle}>
              <TabsTrigger value="workshops">{m.tabWorkshops}</TabsTrigger>
              <TabsTrigger value="quiz">{m.tabQuiz}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'workshops' && (
            <Select value={guide.id} onValueChange={(id) => setParams({ ws: id })}>
              <SelectTrigger className="w-72" aria-label={m.workshop}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {guides.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {workshopLabel(g, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {tab === 'quiz' ? <QuizStatsView /> : <TrainerMatrix key={guide.id} guide={guide} />}
    </div>
  );
}

function TrainerMatrix({ guide }: { guide: Guide }) {
  const { lang, m } = useI18n();
  const { rows, error, updatedAt } = useTrainerMatrix(guide.id);
  const matrix = useMemo(() => buildMatrix(guide, rows ?? []), [guide, rows]);
  const loading = rows === null && !error;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={m.kpiParticipants} value={loading ? null : String(matrix.participants.length)} note={m.kpiParticipantsNote} />
        <Kpi
          label={m.kpiFinished}
          value={loading ? null : `${matrix.finishedRequired}`}
          note={m.kpiFinishedNote(matrix.participants.length, matrix.requiredCount)}
        />
        <Kpi
          label={m.kpiStuck}
          value={loading ? null : String(matrix.participants.filter((p) => p.failing > 0).length)}
          note={m.kpiStuckNote}
        />
        <Kpi
          label={m.kpiLastActivity}
          value={loading ? null : formatAgo(matrix.lastActivity, undefined, lang)}
          note={m.kpiLastActivityNote}
        />
      </div>

      {/* No aria-live on the timestamp: it changes on every poll. Only errors are announced. */}
      <p className="text-xs text-muted-foreground">
        {updatedAt ? m.updatedAt(updatedAt.toLocaleTimeString(locale(lang)), m.sourceProgress) : error ? '' : `${m.loading}…`}
      </p>
      <p role="status" className={error ? 'text-xs text-[var(--destructive)]' : 'sr-only'}>
        {error
          ? rows === null
            ? m.matrixLoadFailed(error)
            : m.refreshFailed(error)
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
            <EmptyTitle>{m.noResultsTitle}</EmptyTitle>
            <EmptyDescription>{m.noResultsText}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            {/* relative: the cells' sr-only text is absolutely positioned and would otherwise widen the page. */}
            <div className="relative max-w-full overflow-x-auto">
              <table className="wg-matrix">
                <caption className="sr-only">
                  {m.matrixCaption(workshopLabel(guide, lang))}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="wg-matrix-sticky text-left">
                      {m.colParticipant}
                    </th>
                    {guide.steps.map((s, i) => (
                      <th key={s.id} scope="col" title={`${s.title} — ${typeLabel(s.type, m)}${s.optional ? m.optionalSuffix : ''}`}>
                        <span className={s.optional ? 'text-muted-foreground' : undefined}>{String(i + 1).padStart(2, '0')}</span>
                        {s.optional && <span className="block text-[10px] font-normal text-muted-foreground">{m.optionalShort}</span>}
                      </th>
                    ))}
                    <th scope="col">{m.colDone}</th>
                    <th scope="col">{m.colHints}</th>
                    <th scope="col" className="text-right">
                      {m.colLastActivity}
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
                      <td className="whitespace-nowrap text-right text-muted-foreground">{formatAgo(p.lastActivity, undefined, lang)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="wg-matrix-sticky text-left">
                      {m.rowPassed}
                    </th>
                    {matrix.steps.map((s) => (
                      <td
                        key={s.stepId}
                        className="whitespace-nowrap text-center tabular-nums"
                        title={m.stepTotals(s.passed, s.attempted - s.passed, matrix.participants.length - s.attempted)}
                      >
                        {s.passed}/{matrix.participants.length}
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
  const { lang, m } = useI18n();
  const status = toStatus(row?.status);
  const ts = parseTs(row?.ts);
  const details = row
    ? [
        `${stepTitle}: ${statusLabel(status, m)}`,
        row.message ?? '',
        m.cellRuns(row.runs),
        row.hints_used !== null ? m.cellHints(row.hints_used) : '',
        row.attempts !== null ? m.cellAttempts(row.attempts) : '',
        ts ? ts.toLocaleTimeString(locale(lang)) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : `${stepTitle}: ${m.cellNotStarted}`;
  return (
    <span className="inline-flex items-center justify-center" title={details}>
      <StatusDot status={status} />
      {row?.hints_used ? <span className="wg-hint-count" aria-label={m.hintsCount(row.hints_used)}>{row.hints_used}</span> : null}
      <span className="sr-only">{details}</span>
    </span>
  );
}

function Legend() {
  const { m } = useI18n();
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label={m.legend}>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="pass" /> {m.legendPass}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="fail" /> {m.legendFail}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <StatusDot status="none" /> {m.legendNone}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="wg-hint-count">2</span> {m.legendHints}
      </li>
    </ul>
  );
}
