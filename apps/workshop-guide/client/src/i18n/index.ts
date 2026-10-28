/** UI dictionary (SPEC section 9): one key set, Polish (default) and English. */
import type { Lang } from '../../../shared/guide-i18n';
import { en } from './en';
import { pl, type Dict } from './pl';

export type { Dict, Lang };

const DICTS: Record<Lang, Dict> = { pl, en };

export const DEFAULT_LANG: Lang = 'pl';
/** localStorage key of the chosen language. */
export const LANG_KEY = 'wg:lang';
/** Key the quiz used before the switch moved to the header; read once as a fallback. */
export const LEGACY_QUIZ_LANG_KEY = 'wg:quiz:lang';

export const dict = (lang: Lang): Dict => DICTS[lang];

export const isLang = (v: unknown): v is Lang => v === 'pl' || v === 'en';
