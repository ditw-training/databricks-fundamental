import { Button } from '@databricks/appkit-ui/react';
import { CheckCircle2, Loader2, RotateCcw, Save } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
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
  busy?: boolean;
  /** The collapsed "Notebook (optional)" section, given the assembled code. */
  renderNotebook?: (code: string, complete: boolean) => ReactNode;
}

/** Code with inline inputs; each blank is checked as you type and the step passes when all are right. */
export function FillExercise({ exercise, storageKey, onComplete, passed, busy, renderNotebook }: Props) {
  const step = exercise;
  const { m } = useI18n();
  const [values, setValues] = useStoredState<Record<string, string>>(storageKey, {});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const segments = useMemo(() => keyedSegments(step.template), [step.template]);
  const { correct, total } = fillProgress(step, values);
  const allCorrect = correct === total;
  const change = (id: string, value: string) => {
    const next = { ...values, [id]: value };
    setValues(next);
    // Record once, when the last blank turns correct (typing on in a correct blank does not resend).
    if (!allCorrect && fillProgress(step, next).correct === total) onComplete(next);
  };
  // Show "wrong" once the participant left the field or typed at least the answer length.
  const visualOf = (id: string): 'correct' | 'wrong' | 'neutral' => {
    const blank = step.blanks[id];
    const value = values[id] ?? '';
    const state = blankState(value, blank);
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
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> {m.reset}
          </Button>
          {allCorrect && !passed && (
            // The automatic save failed or happened before a reset: send the answer again.
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
