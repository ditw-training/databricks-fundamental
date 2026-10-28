import { Badge, Button } from '@databricks/appkit-ui/react';
import { ChevronRight, Database, Loader2, NotebookPen } from 'lucide-react';
import type { CheckResponse } from '../../../shared/check-schema';
import { useI18n } from '../i18n/context';
import { CopyButton } from './CopyButton';
import { notebookCode, placeholders } from '../lib/notebook';

export interface DataCheckControl {
  busy: boolean;
  error: string | null;
  result: CheckResponse | null;
  onCheck: () => void;
}

interface Props {
  /** Code assembled from the participant's answer; null for exercises without code (match). */
  code: string | null;
  /** The exercise is solved, so the code is complete. */
  complete: boolean;
  /** Language of the code: `sql` -> %sql cell or SQL editor, else a Python cell. */
  language: string;
  /** The optional "Check on data" bonus; absent when the step has no data check. */
  dataCheck?: DataCheckControl;
  /** Lines that save the result for "Check on data" (from the guide); added after the code. */
  save?: string | null;
}


/**
 * "Notebook (optional)" (SPEC section 11): collapsed by default. Shows the participant's own
 * completed code for the chosen track (never the guide's solution, so it gives nothing away) and the
 * optional "Check on data", which does not change the step's result.
 */
export function NotebookSection({ code, complete, language, dataCheck, save }: Props) {
  const { m } = useI18n();
  if (code === null && !dataCheck) return null;
  const sql = language === 'sql';
  const full = code === null ? null : notebookCode(code, sql, dataCheck ? save : null);
  const marks = full ? placeholders(full) : [];
  return (
    <details className="wg-notebook group rounded-lg border bg-muted/20">
      <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm font-medium">
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <NotebookPen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">{m.notebookOptional}</span>
        {dataCheck && (
          <Badge variant="outline" className="ml-auto max-w-full whitespace-normal font-normal text-muted-foreground">
            <span className="hidden sm:inline">{m.dataCheckButton} · </span>
            {m.dataCheckBonus}
          </Badge>
        )}
      </summary>
      <div className="space-y-3 border-t px-3 py-3">
        <p className="text-sm text-muted-foreground">{m.notebookOptionalIntro}</p>
        {full === null ? (
          <p className="text-sm text-muted-foreground">{m.notebookNoCode}</p>
        ) : !complete ? (
          <p className="text-sm text-muted-foreground">{m.notebookIncomplete}</p>
        ) : (
          <>
            <div className="wg-codeblock group/code relative">
              <pre>
                <code>{full}</code>
              </pre>
              <CopyButton text={full} compact className="absolute right-2 top-2 opacity-80 group-hover/code:opacity-100" />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>{sql ? m.notebookSqlCell : m.notebookPythonCell}</li>
              {marks.length > 0 && <li>{m.notebookPlaceholders(marks.join(', '))}</li>}
              {full !== notebookCode(code ?? '', sql, null) && <li>{m.notebookSaveNote}</li>}
            </ul>
          </>
        )}
        {dataCheck && <DataCheck control={dataCheck} />}
      </div>
    </details>
  );
}

function DataCheck({ control }: { control: DataCheckControl }) {
  const { m } = useI18n();
  const { busy, error, result, onCheck } = control;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm text-muted-foreground">{m.dataCheckIntro}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCheck} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Database className="size-4" aria-hidden />}
          {busy ? m.checking : m.dataCheckButton}
        </Button>
        <span className="text-xs text-muted-foreground">{busy ? m.checkRunning : m.dataCheckBonus}</span>
      </div>
      <div role="status">
        {result && (
          <div className={`wg-feedback ${result.status === 'pass' ? 'wg-feedback-pass' : 'wg-feedback-fail'}`}>
            <strong className="font-medium">{result.status === 'pass' ? m.dataCheckPass : m.dataCheckFail}</strong>{' '}
            {/* Check messages come from the server and the notebooks: English (SPEC section 9). */}
            <span lang="en">{result.message}</span>
          </div>
        )}
        {error && <p className="text-sm text-[var(--destructive)]">{m.checkFailed(error)}</p>}
      </div>
    </div>
  );
}
