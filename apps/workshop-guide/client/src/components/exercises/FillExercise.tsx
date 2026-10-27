import { Button } from '@databricks/appkit-ui/react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { FillStep } from '../../../../shared/guide-schema';
import { assembleFill, blankInputWidth, blankState, fillProgress, parseTemplate } from '../../lib/exercise';
import { useStoredState } from '../../lib/storage';
import { CopyButton } from '../CopyButton';

interface Props {
  step: FillStep;
  storageKey: string;
  /** Where to paste the code in the notebook (shown next to Copy). */
  pasteHint?: ReactNode;
}

/** Code with inline inputs; each blank is checked as you type. */
export function FillExercise({ step, storageKey, pasteHint }: Props) {
  const [values, setValues] = useStoredState<Record<string, string>>(storageKey, {});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const segments = useMemo(() => parseTemplate(step.template), [step.template]);
  const { correct, total } = fillProgress(step, values);
  const allCorrect = correct === total;
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
      <div className="wg-code-surface" role="group" aria-label="Code with blanks">
        <pre className="wg-fill-code">
          {segments.map((seg, i) => {
            if (seg.kind === 'text') return <Fragment key={i}>{seg.value}</Fragment>;
            const value = values[seg.id] ?? '';
            const visual = visualOf(seg.id);
            return (
              <input
                key={i}
                type="text"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-label={`Blank ${blankNumbers.get(seg.id) ?? ''}`}
                aria-invalid={visual === 'wrong'}
                className={`wg-blank wg-blank-${visual}`}
                title={visual === 'wrong' ? 'Not the expected answer yet: check the spelling, the keyword and any quotes.' : undefined}
                style={{ width: `calc(${blankInputWidth(value)}ch + 0.8rem)` }}
                value={value}
                placeholder="____"
                onChange={(e) => setValues((prev) => ({ ...prev, [seg.id]: e.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, [seg.id]: true }))}
              />
            );
          })}
        </pre>
      </div>

      {anyWrong && (
        <p className="text-xs text-[var(--destructive)]">
          A red blank is not the expected answer yet. Check the spelling, the exact keyword and any quotes; the hints below help.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {allCorrect ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--success)]">
              <CheckCircle2 className="size-4" aria-hidden /> All {total} blanks correct. Copy the code to your notebook.
            </span>
          ) : (
            <>
              {correct} of {total} blanks correct
            </>
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
            <RotateCcw className="size-4" aria-hidden /> Reset
          </Button>
          <CopyButton
            text={assembleFill(step, values)}
            label="Copy to notebook"
            variant={allCorrect ? 'default' : 'outline'}
          />
        </div>
      </div>
      {pasteHint}
      {!allCorrect && correct > 0 && (
        <p className="text-xs text-muted-foreground">Empty blanks are copied as ____ so you can spot them in the notebook.</p>
      )}
    </div>
  );
}
