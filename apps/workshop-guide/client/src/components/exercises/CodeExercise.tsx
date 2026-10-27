import type { CodeStep } from '../../../../shared/guide-schema';
import { CopyButton } from '../CopyButton';

/** Free coding step: optional starter skeleton; the result is graded with the Check button. */
export function CodeExercise({ step }: { step: CodeStep }) {
  if (!step.starter) {
    return (
      <p className="text-sm text-muted-foreground">
        Write the code in the empty cell of this step in your notebook. Use the hints below if you get stuck.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Start from this skeleton in your notebook:</p>
      <div className="wg-codeblock group relative">
        <pre>
          <code>{step.starter}</code>
        </pre>
        <CopyButton text={step.starter} compact className="absolute right-2 top-2 opacity-80 group-hover:opacity-100" />
      </div>
    </div>
  );
}
