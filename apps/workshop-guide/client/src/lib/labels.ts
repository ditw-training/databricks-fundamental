import type { Step } from '../../../shared/guide-schema';
import type { StepStatus } from './status';

export const TYPE_LABEL: Record<Step['type'], string> = {
  fill: 'Fill in the blanks',
  order: 'Put in order',
  match: 'Match pairs',
  code: 'Write the code',
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pass: 'Passed',
  fail: 'Failed — try again',
  none: 'Not started',
};

export const statusLabel = (status: StepStatus) => STATUS_LABEL[status];
