import { exerciseTypes, resolveExercise, type Guide, type Step, type Track } from '../../../shared/guide-schema';
import type { Dict } from '../i18n';
import type { StepStatus } from './status';

type ExerciseType = 'fill' | 'order' | 'match' | 'code';

/** "Fill in the blanks" / "Uzupełnij luki". */
export function typeLabel(type: ExerciseType, m: Dict): string {
  return { fill: m.typeFill, order: m.typeOrder, match: m.typeMatch, code: m.typeCode }[type];
}

/** Exercise type of a step in a track; without a track every type the step can show ("A / B"). */
export function stepTypeLabel(step: Step, m: Dict, track?: Track): string {
  if (track) {
    const ex = resolveExercise(step, track).exercise;
    return typeLabel(ex ? ex.type : 'code', m);
  }
  return exerciseTypes(step)
    .map((t) => typeLabel(t, m))
    .join(' / ');
}

export function statusLabel(status: StepStatus, m: Dict): string {
  return { pass: m.statusPass, fail: m.statusFail, none: m.statusNone }[status];
}

/** Notebook name as the workspace shows it: "WORKSHOP_delta" (no folder, no .ipynb). */
export const notebookName = (guide: Guide) => (guide.notebook.split('/').pop() ?? guide.notebook).replace(/\.ipynb$/, '');

/** Folders from the repository root to the notebook, e.g. ["notebooks", "workshops"]. */
export const notebookFolders = (guide: Guide) => guide.notebook.split('/').slice(0, -1);
