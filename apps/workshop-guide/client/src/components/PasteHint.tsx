import { ClipboardPaste } from 'lucide-react';
import type { Guide, Step } from '../../../shared/guide-schema';
import { notebookName } from '../lib/labels';

interface Props {
  guide: Guide;
  step: Step;
  /** Step number as shown in the guide and the notebook heading, e.g. "03". */
  number: string;
}

/** One line under "Copy to notebook": which notebook cell to paste into and what to do next. */
export function PasteHint({ guide, step, number }: Props) {
  // SQL steps are %sql cells in the notebooks; the copied code does not include the magic line.
  const sqlCell = step.language === 'sql';
  // Most fill templates already end with the save line (`..._ws_<workshop>_<step>`); order blocks do not.
  const copiedSaveLine = (step.type === 'fill' ? step.template : '').includes('._ws_');
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ClipboardPaste className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Paste into the code cell under <strong className="font-medium text-foreground">Step {number} — {step.title}</strong> in{' '}
        <span className="font-mono">{notebookName(guide)}</span>
        {sqlCell ? (
          <>
            {' '}
            (replace the code, keep the first line <code className="wg-inline-code">%sql</code>
          </>
        ) : (
          ' (replace the code that is there'
        )}
        {copiedSaveLine ? ')' : '; if the cell ends with a line that saves your result, keep it as the last line)'}
        . Run the cell to the end{step.check === 'notebook' ? ', then press Check below' : ''}.
      </span>
    </p>
  );
}
