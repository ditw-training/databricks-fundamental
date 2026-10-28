import { NotebookPen } from 'lucide-react';
import { Fragment } from 'react';
import type { Guide } from '../../../shared/guide-schema';
import { useI18n } from '../i18n/context';
import { notebookFolders, notebookName } from '../lib/labels';

/**
 * Where the workshop notebook is in the workspace. Participants clone the training repository
 * as a Git folder in their Home folder (README, "Clone the repository as a Git folder"), so the
 * path below the Git folder is the path in the repository.
 */
export function NotebookLocation({ guide, className = '' }: { guide: Guide; className?: string }) {
  const { m } = useI18n();
  // "Workspace" and "Home" are the workspace UI names; they are not translated.
  const parts = ['Workspace', 'Home', m.yourGitFolder, ...notebookFolders(guide)];
  return (
    <p className={`flex items-start gap-1.5 text-xs text-muted-foreground ${className}`}>
      <NotebookPen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="sr-only">{m.notebookLocation}</span>
        {parts.map((p) => (
          <Fragment key={p}>
            {p}
            <span aria-hidden> › </span>
          </Fragment>
        ))}
        <strong className="font-mono font-medium text-foreground">{notebookName(guide)}</strong>
      </span>
    </p>
  );
}
