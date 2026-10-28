import { useEffect, useMemo, type ReactNode } from 'react';
import { readStored, useStoredState } from '../lib/storage';
import { I18nContext } from './context';
import { DEFAULT_LANG, dict, isLang, LANG_KEY, LEGACY_QUIZ_LANG_KEY, type Lang } from './index';

/** Language of the whole app: default Polish, remembered per browser (localStorage, guarded). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [stored, setLang] = useStoredState<Lang | null>(LANG_KEY, null);
  const legacy = readStored<unknown>(LEGACY_QUIZ_LANG_KEY, null);
  const lang: Lang = isLang(stored) ? stored : isLang(legacy) ? legacy : DEFAULT_LANG;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, m: dict(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
