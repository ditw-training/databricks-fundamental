import { statusLabel } from '../lib/labels';
import type { StepStatus } from '../lib/status';


/** Step state: filled green (pass), filled red ring (fail), hollow (not started). */
export function StatusDot({ status, className = '' }: { status: StepStatus; className?: string }) {
  return (
    <span
      role="img"
      aria-label={statusLabel(status)}
      title={statusLabel(status)}
      className={`wg-dot wg-dot-${status} inline-block shrink-0 ${className}`}
    />
  );
}
