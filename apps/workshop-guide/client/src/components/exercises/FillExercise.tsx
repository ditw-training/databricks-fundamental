import { Button } from '@databricks/appkit-ui/react';
import { CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FillVariant } from '../../../../shared/guide-schema';
import { assembleFill, blankInputWidth, blankState, fillProgress, keyedSegments } from '../../lib/exercise';
import { useI18n } from '../../i18n/context';
import { useStoredState } from '../../lib/storage';

interface Props {
  exercise: Pick<FillVariant, 'template' | 'blanks'>;
  storageKey: string;
  /** Called when the last blank becomes correct (and on "save again"); the parent records the result. */
  onComplete: (values: Record<string, string>) => void;
  /** The step is already passed (no "save again" button). */
  passed: boolean;
  /**
   * The participant's rows are loaded (and newer than a reset). Until then `passed` may still turn
   * true, so answers restored from this browser are neither shown as solved nor cleared.
   */
  progressReady: boolean;
  busy?: boolean;
  /** The collapsed "Notebook (optional)" section, given the assembled code. */
  renderNotebook?: (code: string, complete: boolean) => ReactNode;
}

/** Code with inline inputs; each blank is checked as you type and the step passes when all are right. */
export function FillExercise({ exercise, storageKey, onComplete, passed, progressReady, busy, renderNotebook }: Props) {
  const step = exercise;
  const { m } = useI18n();
  const [values, setValues] = useStoredState<Record<string, string>>(storageKey, {});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const segments = useMemo(() => keyedSegments(step.template), [step.template]);
  // Completed by typing in this view (not restored from localStorage). Only then, or when the
  // server has a pass, does a full set of correct answers show as solved.
  const [completedHere, setCompletedHere] = useState(false);
  const { correct: correctRaw, total } = fillProgress(step, values);
  const allCorrectRaw = correctRaw === total;
  // A complete answer from an earlier session without a pass on the server (progress reset, rows
  // deleted, failed save before a reload) must not look solved: the step starts again.
  const unverified = allCorrectRaw && !passed && !completedHere;
  const correct = unverified ? 0 : correctRaw;
  const allCorrect = allCorrectRaw && !unverified;
  useEffect(() => {
    if (unverified && progressReady) setValues({});
  }, [unverified, progressReady, setValues]);
  const change = (id: string, value: string) => {
    const next = { ...values, [id]: value };
    setValues(next);
    // Record once, when the last blank turns correct (typing on in a correct blank does not resend).
    if (!allCorrect && fillProgress(step, next).correct === total) {
      setCompletedHere(true);
      onComplete(next);
    }
  };
  // Show "wrong" once the participant left the field or typed at least the answer length.
  const visualOf = (id: string): 'correct' | 'wrong' | 'neutral' => {
    const blank = step.blanks[id];
    const value = values[id] ?? '';
    const state = blankState(value, blank);
    if (unverified) return 'neutral';
    if (state === 'correct') return 'correct';
    const showWrong =
      state === 'wrong' && (touched[id] || value.trim().length >= Math.min(...blank.answers.map((a) => a.length)));
    return showWrong ? 'wrong' : 'neutral';
  };
  const anyWrong = Object.keys(step.blanks).some((id) => visualOf(id) === 'wrong');
  const blankNumbers = useMemo(() => {
    const ids = segments.flatMap((seg) => (seg.kind === 'blank' ? [seg.id] : []));
    return new Map(ids.map((id, i) => [id, i + 1]));
  }, [segments]);

  return (
    <div className="space-y-3">
      <div className="wg-code-surface" role="group" aria-label={m.fillGroup}>
        <pre className="wg-fill-code">
          {segments.map((seg) => {
            if (seg.kind === 'text') return <Fragment key={seg.key}>{seg.value}</Fragment>;
            const value = values[seg.id] ?? '';
            const visual = visualOf(seg.id);
            return (
              <input
                key={seg.key}
                type="text"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-label={m.blankN(blankNumbers.get(seg.id) ?? 0)}
                aria-invalid={visual === 'wrong'}
                className={`wg-blank wg-blank-${visual}`}
                title={visual === 'wrong' ? m.blankWrongTitle : undefined}
                style={{ width: `calc(${blankInputWidth(value)}ch + 0.8rem)` }}
                value={value}
                placeholder="____"
                onChange={(e) => change(seg.id, e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, [seg.id]: true }))}
              />
            );
          })}
        </pre>
      </div>

      {anyWrong && (
        <p className="text-xs text-[var(--destructive)]">{m.fillAnyWrong}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {allCorrect ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--success)]">
              <CheckCircle2 className="size-4" aria-hidden /> {m.fillAllCorrect(total)}
            </span>
          ) : (
            m.fillProgress(correct, total)
          )}
        </p>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValues({});
              setTouched({});
              setCompletedHere(false);
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> {m.reset}
          </Button>
          {allCorrect && !passed && (
            // The automatic save in this view failed: send the same answer again.
            <Button type="button" size="sm" onClick={() => onComplete(values)} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              {busy ? m.saving : m.saveRetry}
            </Button>
          )}
        </div>
      </div>
      {renderNotebook?.(assembleFill(step, values), allCorrect)}
    </div>
  );
}
