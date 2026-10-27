import { Button } from '@databricks/appkit-ui/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useStoredState } from '../lib/storage';

type Theme = 'system' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

/** Cycles system → light → dark. AppKit UI themes via the .light / .dark class on <html>. */
export function ThemeToggle() {
  const [theme, setTheme] = useStoredState<Theme>('wg:theme', 'system');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme !== 'system') root.classList.add(theme);
  }, [theme]);

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
      title={`Theme: ${theme}`}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
