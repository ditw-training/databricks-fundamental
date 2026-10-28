import { ClipboardPaste } from 'lucide-react';
import type { Guide, Step } from '../../../shared/guide-schema';
import { useI18n } from '../i18n/context';
import { notebookName } from '../lib/labels';

interface Props {
  guide: Guide;
  step: Step;
  /** Step number as shown in the guide and the notebook heading, e.g. "03". */
  number: string;
}

/** One line under "Copy to notebook": which notebook cell to paste into and what to do next. */
export function PasteHint({ guide, step, number }: Props) {
  const { lang, m } = useI18n();
  // The notebooks are English: in Polish point at the heading by its number only ("Step 03"),
  // because the translated step title is not what the notebook shows.
  const heading = lang === 'en' ? `Step ${number} — ${step.title}` : `Step ${number}`;
  // SQL steps are %sql cells in the notebooks; the copied code does not include the magic line.
  const sqlCell = step.language === 'sql';
  // Most fill templates already end with the save line (`..._ws_<workshop>_<step>`); order blocks do not.
  const copiedSaveLine = (step.type === 'fill' ? step.template : '').includes('._ws_');
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ClipboardPaste className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        {m.pasteInto}{' '}
        <strong className="font-medium text-foreground">
          {heading}
        </strong>{' '}
        {m.pasteIn} <span className="font-mono">{notebookName(guide)}</span>{' '}
        {sqlCell ? (
          <>
            {m.pasteSql} <code className="wg-inline-code">%sql</code>
          </>
        ) : (
          m.pasteReplace
        )}
        {copiedSaveLine ? ')' : m.pasteKeepSaveLine}. {m.pasteRun}
        {step.check === 'notebook' ? m.pasteRunThenCheck : ''}.
      </span>
    </p>
  );
}
