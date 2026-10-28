import type { CodeStep } from '../../../../shared/guide-schema';
import { useI18n } from '../../i18n/context';
import { CopyButton } from '../CopyButton';

/** Free coding step: optional starter skeleton; the result is graded with the Check button. */
export function CodeExercise({ step }: { step: CodeStep }) {
  const { m } = useI18n();
  if (!step.starter) {
    return (
      <p className="text-sm text-muted-foreground">{m.codeNoStarter}</p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{m.codeStarter}</p>
      <div className="wg-codeblock group relative">
        <pre>
          <code>{step.starter}</code>
        </pre>
        <CopyButton text={step.starter} compact className="absolute right-2 top-2 opacity-80 group-hover:opacity-100" />
      </div>
    </div>
  );
}
