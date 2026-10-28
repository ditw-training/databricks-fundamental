import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@databricks/appkit-ui/react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/context';
import { resetMyProgress } from '../lib/api';

interface Props {
  workshop: string;
  /** "Warsztat I — Ingestion" */
  label: string;
  onReset: () => void;
}

/**
 * "Reset my progress": after confirmation the server deletes only the caller's rows of this
 * workshop (DELETE /api/progress/me). Notebook tables and the code in the notebook stay.
 */
export function ResetProgress({ workshop, label, onReset }: Props) {
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setBusy(true);
    setError(null);
    resetMyProgress(workshop)
      .then(() => {
        onReset();
        setOpen(false);
      })
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setBusy(false));
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          <RotateCcw className="size-4" aria-hidden /> {m.resetButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.resetTitle(label)}</AlertDialogTitle>
          <AlertDialogDescription>{m.resetText}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {m.resetFailed(error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{m.cancel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open until the server answers
              confirm();
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {m.resetConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
