import { Button } from '@databricks/appkit-ui/react';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/context';
import { copyText } from '../lib/api';

interface CopyButtonProps {
  text: string;
  label?: string;
  compact?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  onCopied?: () => void;
  disabled?: boolean;
  /** Tooltip, e.g. why the button is disabled. */
  title?: string;
}

export function CopyButton({ text, label, compact, className, variant = 'outline', onCopied, disabled, title }: CopyButtonProps) {
  const { m } = useI18n();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const onClick = () => {
    void copyText(text).then((ok) => {
      setState(ok ? 'copied' : 'failed');
      if (ok) onCopied?.();
    });
  };

  const text_ = state === 'copied' ? m.copied : state === 'failed' ? m.copyFailed : (label ?? m.copy);
  return (
    <Button
      type="button"
      size={compact ? 'sm' : 'default'}
      variant={variant}
      className={className}
      disabled={disabled}
      title={title}
      onClick={onClick}
      aria-label={compact ? text_ : undefined}
    >
      {state === 'copied' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {compact ? <span className="sr-only">{text_}</span> : <span>{text_}</span>}
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? m.copiedToClipboard : ''}
      </span>
    </Button>
  );
}
