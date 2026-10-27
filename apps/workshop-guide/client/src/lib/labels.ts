import type { Guide, Step } from '../../../shared/guide-schema';
import type { StepStatus } from './status';

export const TYPE_LABEL: Record<Step['type'], string> = {
  fill: 'Fill in the blanks',
  order: 'Put in order',
  match: 'Match pairs',
  code: 'Write the code',
};

/** Same marker as the notebook headings ("## Step 02 ⭐ OPTIONAL — …"). */
export const OPTIONAL_LABEL = '⭐ Optional';

const STATUS_LABEL: Record<StepStatus, string> = {
  pass: 'Passed',
  fail: 'Failed — try again',
  none: 'Not started',
};

export const statusLabel = (status: StepStatus) => STATUS_LABEL[status];

/** Notebook name as the workspace shows it: "WORKSHOP_delta" (no folder, no .ipynb). */
export const notebookName = (guide: Guide) => (guide.notebook.split('/').pop() ?? guide.notebook).replace(/\.ipynb$/, '');

/** Folders from the repository root to the notebook, e.g. ["notebooks", "workshops"]. */
export const notebookFolders = (guide: Guide) => guide.notebook.split('/').slice(0, -1);
