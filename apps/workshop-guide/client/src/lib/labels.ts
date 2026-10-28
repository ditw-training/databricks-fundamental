import type { Guide, Step } from '../../../shared/guide-schema';
import type { Dict } from '../i18n';
import type { StepStatus } from './status';

/** "Fill in the blanks" / "Uzupełnij luki". */
export function typeLabel(type: Step['type'], m: Dict): string {
  return { fill: m.typeFill, order: m.typeOrder, match: m.typeMatch, code: m.typeCode }[type];
}

export function statusLabel(status: StepStatus, m: Dict): string {
  return { pass: m.statusPass, fail: m.statusFail, none: m.statusNone }[status];
}

/** Notebook name as the workspace shows it: "WORKSHOP_delta" (no folder, no .ipynb). */
export const notebookName = (guide: Guide) => (guide.notebook.split('/').pop() ?? guide.notebook).replace(/\.ipynb$/, '');

/** Folders from the repository root to the notebook, e.g. ["notebooks", "workshops"]. */
export const notebookFolders = (guide: Guide) => guide.notebook.split('/').slice(0, -1);
