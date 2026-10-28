import { createContext, useContext } from 'react';
import { DEFAULT_LANG, dict, type Dict, type Lang } from './index';

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Texts in the current language. */
  m: Dict;
}

export const I18nContext = createContext<I18n>({ lang: DEFAULT_LANG, setLang: () => undefined, m: dict(DEFAULT_LANG) });

/** Current language, its texts and the setter (LanguageProvider). */
export const useI18n = () => useContext(I18nContext);
