import { useI18n } from '../i18n/context';
import { statusLabel } from '../lib/labels';
import type { StepStatus } from '../lib/status';

/** Step state: filled green (pass), filled red ring (fail), hollow (not started). */
export function StatusDot({ status, className = '' }: { status: StepStatus; className?: string }) {
  const { m } = useI18n();
  return (
    <span
      role="img"
      aria-label={statusLabel(status, m)}
      title={statusLabel(status, m)}
      className={`wg-dot wg-dot-${status} inline-block shrink-0 ${className}`}
    />
  );
}
