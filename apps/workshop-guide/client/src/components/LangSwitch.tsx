import { LANGS } from '../../../shared/guide-i18n';
import { useI18n } from '../i18n/context';

/** PL | EN segmented control in the header; the choice applies to the whole app. */
export function LangSwitch() {
  const { lang, setLang, m } = useI18n();
  return (
    <div role="group" aria-label={m.language} className="wg-langswitch">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
