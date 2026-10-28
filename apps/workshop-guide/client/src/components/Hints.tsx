import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@databricks/appkit-ui/react';
import { Eye, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { Markdown } from './Markdown';

interface Props {
  hints: string[];
  revealed: number;
  onReveal: (count: number) => void;
}

/** Progressive hints; the last one is the full solution and needs a confirmation. */
export function Hints({ hints, revealed, onReveal }: Props) {
  const { m } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (hints.length === 0) return null;

  const shown = Math.min(revealed, hints.length);
  const nextIsSolution = shown === hints.length - 1 && hints.length > 1;
  const done = shown >= hints.length;

  return (
    <section aria-labelledby="hints-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 id="hints-heading" className="wg-section-title">
          {m.hintsHeading}
        </h3>
        <span className="text-xs text-muted-foreground">{m.hintsShown(shown, hints.length)}</span>
      </div>

      {shown > 0 && (
        <ol className="space-y-2">
          {hints.slice(0, shown).map((hint, i) => {
            const isSolution = i === hints.length - 1 && hints.length > 1;
            return (
              <li key={hint} className={`wg-hint ${isSolution ? 'wg-hint-solution' : ''}`}>
                <span className="wg-hint-label">{isSolution ? m.solution : m.hintN(i + 1)}</span>
                <Markdown>{hint}</Markdown>
              </li>
            );
          })}
        </ol>
      )}

      {!done && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (nextIsSolution ? setConfirmOpen(true) : onReveal(shown + 1))}
        >
          {nextIsSolution ? <Eye className="size-4" aria-hidden /> : <Lightbulb className="size-4" aria-hidden />}
          {nextIsSolution ? m.showSolution : shown === 0 ? m.showHint : m.showNextHint}
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.solutionConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{m.solutionConfirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.keepTrying}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onReveal(hints.length)}>{m.solutionConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
