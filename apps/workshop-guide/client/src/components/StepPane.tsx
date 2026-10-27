import { Badge, Button } from '@databricks/appkit-ui/react';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, Loader2, PlayCircle, Target } from 'lucide-react';
import { useState } from 'react';
import type { Guide, Step } from '../../../shared/guide-schema';
import { postCheck, postProgress } from '../lib/api';
import type { ParticipantRow } from '../lib/progress';
import { formatAgo, parseTs, toStatus } from '../lib/status';
import { stepKey, useStoredState } from '../lib/storage';
import { CodeExercise } from './exercises/CodeExercise';
import { FillExercise } from './exercises/FillExercise';
import { MatchExercise } from './exercises/MatchExercise';
import { OrderExercise } from './exercises/OrderExercise';
import { Hints } from './Hints';
import { OPTIONAL_LABEL, TYPE_LABEL } from '../lib/labels';
import { Markdown } from './Markdown';
import { PasteHint } from './PasteHint';
import { StatusDot } from './StatusDot';

interface Props {
  guide: Guide;
  step: Step;
  index: number;
  email: string;
  row: ParticipantRow | undefined;
  progressError: string | null;
  onLocalResult: (row: ParticipantRow) => void;
  onNavigate: (stepId: string) => void;
}

export function StepPane({ guide, step, index, email, row, progressError, onLocalResult, onNavigate }: Props) {
  const key = (what: string) => stepKey(email, guide.id, step.id, what);
  const [hintsUsed, setHintsUsed] = useStoredState<number>(key('hints'), 0);
  const [attempts, setAttempts] = useStoredState<number>(key('attempts'), 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const prev = guide.steps[index - 1];
  const next = guide.steps[index + 1];
  const number = String(index + 1).padStart(2, '0');
  const pasteHint = <PasteHint guide={guide} step={step} number={number} />;

  const recordAppResult = (pass: boolean, message: string) => {
    const attemptNo = attempts + 1;
    setAttempts(attemptNo);
    if (step.check !== 'app') return;
    const body = {
      workshop: guide.id,
      step: step.id,
      status: pass ? ('pass' as const) : ('fail' as const),
      message: message.slice(0, 200),
      hints_used: Math.min(hintsUsed, 20),
      attempts: attemptNo,
    };
    // Show the result immediately; the next poll confirms it from the table.
    onLocalResult({
      step: step.id,
      step_type: step.type,
      status: body.status,
      message: body.message,
      hints_used: body.hints_used,
      attempts: attemptNo,
      source: 'app',
      ts: new Date().toISOString(),
      runs: (row?.runs ?? 0) + 1,
    });
    setSaving(true);
    setSaveError(null);
    postProgress(body)
      .catch((err: unknown) => setSaveError((err as Error).message))
      .finally(() => setSaving(false));
  };

  // Check button (notebook-graded steps): the server runs the step's SQL as the participant.
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [notRecorded, setNotRecorded] = useState(false);
  const runCheck = () => {
    if (checking) return;
    setChecking(true);
    setCheckError(null);
    setNotRecorded(false);
    postCheck({ workshop: guide.id, step: step.id, hints_used: Math.min(hintsUsed, 20) })
      .then((result) => {
        setNotRecorded(!result.recorded);
        // Show the result (and the status dot) immediately; the next poll confirms it.
        onLocalResult({
          step: step.id,
          step_type: step.type,
          status: result.status,
          message: result.message,
          hints_used: Math.min(hintsUsed, 20),
          attempts: null,
          source: 'app',
          ts: new Date().toISOString(),
          runs: (row?.runs ?? 0) + 1,
        });
      })
      .catch((err: unknown) => setCheckError((err as Error).message))
      .finally(() => setChecking(false));
  };

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6" aria-labelledby="step-title">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">Step {number}</span>
          <span aria-hidden>·</span>
          <span>{TYPE_LABEL[step.type]}</span>
          {step.optional && <Badge variant="outline">{OPTIONAL_LABEL}</Badge>}
        </div>
        <h2 id="step-title" className="text-2xl font-semibold tracking-tight text-foreground">
          {step.title}
        </h2>
      </header>

      <Markdown className="text-[15px]">{step.explain}</Markdown>

      {step.expected && (
        <div className="wg-expected">
          <Target className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <span className="font-medium">Expected result: </span>
            <Markdown className="inline-md">{step.expected}</Markdown>
          </div>
        </div>
      )}

      <section aria-labelledby="exercise-heading" className="space-y-3">
        <h3 id="exercise-heading" className="wg-section-title">
          {TYPE_LABEL[step.type]}
        </h3>
        {step.type === 'fill' && <FillExercise key={step.id} step={step} storageKey={key('fill')} pasteHint={pasteHint} />}
        {step.type === 'order' && (
          <OrderExercise
            key={step.id}
            step={step}
            storageKey={key('order')}
            pasteHint={step.check === 'notebook' ? pasteHint : undefined}
            busy={saving}
            onCheck={(r) => recordAppResult(r.pass, r.message)}
          />
        )}
        {step.type === 'match' && (
          <MatchExercise
            key={step.id}
            step={step}
            storageKey={key('match')}
            busy={saving}
            onCheck={(r) => recordAppResult(r.pass, r.message)}
          />
        )}
        {step.type === 'code' && <CodeExercise step={step} />}
      </section>

      <LiveStatus
        step={step}
        number={number}
        row={row}
        error={progressError}
        saveError={saveError}
        check={step.check === 'notebook' ? { busy: checking, error: checkError, notRecorded, onCheck: runCheck } : undefined}
      />

      <Hints hints={step.hints} revealed={hintsUsed} onReveal={setHintsUsed} />

      {step.docs.length > 0 && (
        <section aria-labelledby="docs-heading" className="space-y-2">
          <h3 id="docs-heading" className="wg-section-title">
            Documentation
          </h3>
          <ul className="flex flex-col gap-1.5">
            {step.docs.map((doc) => (
              <li key={doc.url}>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="wg-doclink">
                  <BookOpen className="size-4 shrink-0" aria-hidden />
                  <span>{doc.label}</span>
                  <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="flex items-center justify-between border-t pt-4" aria-label="Step navigation">
        <Button type="button" variant="ghost" disabled={!prev} onClick={() => prev && onNavigate(prev.id)}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Button>
        <Button type="button" variant="outline" disabled={!next} onClick={() => next && onNavigate(next.id)}>
          Next step <ChevronRight className="size-4" aria-hidden />
        </Button>
      </nav>
    </article>
  );
}

interface CheckControl {
  busy: boolean;
  error: string | null;
  notRecorded: boolean;
  onCheck: () => void;
}

interface LiveStatusProps {
  step: Step;
  /** Step number as in the notebook heading, e.g. "03". */
  number: string;
  row: ParticipantRow | undefined;
  error: string | null;
  saveError: string | null;
  /** Present for steps graded with the Check button. */
  check?: CheckControl;
}

/** Latest result for this step from the progress table (or the app's own check). */
function LiveStatus({ step, number, row, error, saveError, check }: LiveStatusProps) {
  const status = toStatus(row?.status);
  const when = parseTs(row?.ts);
  const announcement = useStatusAnnouncement(step, status, row?.message ?? null);

  const title =
    status === 'pass' ? 'Passed' : status === 'fail' ? 'Not yet — see the message' : 'Not checked yet';

  return (
    <section aria-labelledby="status-heading" className={`wg-status wg-status-${status}`}>
      <div className="flex items-start gap-3">
        <StatusDot status={status} className="mt-1" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="status-heading" className="text-sm font-semibold">
            {title}
          </h3>
          {row?.message && <p className="text-sm">{row.message}</p>}
          {check && status !== 'pass' && (
            <p className="text-sm text-muted-foreground">
              Run the Step {number} cell in the notebook to the end (its last line saves your result), then press{' '}
              <strong className="font-medium text-foreground">Check</strong>.
            </p>
          )}
          {check && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" size="sm" onClick={check.onCheck} disabled={check.busy} aria-describedby="status-heading">
                {check.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlayCircle className="size-4" aria-hidden />}
                {check.busy ? 'Checking…' : status === 'none' ? 'Check' : 'Check again'}
              </Button>
              {check.busy && <span className="text-xs text-muted-foreground">Running the check on the SQL warehouse…</span>}
            </div>
          )}
          {check?.error && (
            <p role="alert" className="text-sm text-[var(--destructive)]">
              Check could not run: {check.error}
            </p>
          )}
          {check?.notRecorded && (
            <p className="text-xs text-[var(--destructive)]">The result is shown here but was not saved to your progress. Press Check again.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {when ? `Last check ${formatAgo(when)} · ${row?.runs ?? 1} run${(row?.runs ?? 1) === 1 ? '' : 's'}` : 'No result recorded yet'}
            {row?.source ? ` · from ${row.source}` : ''}
          </p>
          {error && <p className="text-xs text-[var(--destructive)]">Live status unavailable: {error}</p>}
          {/* Announces only a change of status or message on this step, not every poll. */}
          <p role="status" className="sr-only">
            {announcement}
          </p>
          {saveError && <p className="text-xs text-[var(--destructive)]">Your result was not saved: {saveError}</p>}
        </div>
      </div>
    </section>
  );
}

const STATUS_WORD = { pass: 'Passed', fail: 'Failed', none: 'Not checked yet' } as const;

/**
 * Text for the screen-reader status region. Empty on mount and when the participant
 * moves to another step; set only when this step's status or message changes.
 */
function useStatusAnnouncement(step: Step, status: ReturnType<typeof toStatus>, message: string | null): string {
  const [seen, setSeen] = useState({ stepId: step.id, status, message, text: '' });
  // Adjusting state while rendering (no effect): React re-renders before committing.
  if (seen.stepId !== step.id) {
    setSeen({ stepId: step.id, status, message, text: '' });
  } else if (seen.status !== status || seen.message !== message) {
    setSeen({ stepId: step.id, status, message, text: `${step.title}: ${STATUS_WORD[status]}${message ? `. ${message}` : ''}` });
  }
  return seen.text;
}
