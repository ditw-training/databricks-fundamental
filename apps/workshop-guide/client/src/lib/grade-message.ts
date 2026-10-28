/**
 * In-app grading messages (shared/grading.ts) are stored in English in the progress table
 * (SPEC section 9). The app generated them itself, so the client shows them in the UI language.
 * Messages it does not recognise (notebook / data Check rows) stay as they are (English).
 */
import type { Dict } from '../i18n';

const n = (s: string) => Number.parseInt(s, 10);

/** The message in the UI language, or null when it is not an app grading message. */
export function localizeGradeMessage(message: string, m: Dict): string | null {
  const text = message.trim();
  let r: RegExpExecArray | null;
  if ((r = /^All (\d+) blanks? correct\.$/.exec(text))) return m.fillAllCorrect(n(r[1]));
  if ((r = /^(\d+) of (\d+) blanks correct\.$/.exec(text))) return `${m.fillProgress(n(r[1]), n(r[2]))}.`;
  if ((r = /^All (\d+) pairs matched\.$/.exec(text))) return m.matchResult(true, n(r[1]), n(r[1]));
  if ((r = /^(\d+) of (\d+) pairs matched\.$/.exec(text))) return m.matchResult(false, n(r[1]), n(r[2]));
  if ((r = /^Correct order: all (\d+) blocks in place\.$/.exec(text))) {
    const total = n(r[1]);
    return m.orderResult({ pass: true, correctPositions: total, total, distractorsUsed: 0, missing: 0 });
  }
  if ((r = /^(\d+) of (\d+) blocks in the right place\.(?: (\d+) blocks? (?:does|do) not belong here\.)?(?: (\d+) blocks? (?:is|are) missing\.)?$/.exec(text))) {
    return m.orderResult({
      pass: false,
      correctPositions: n(r[1]),
      total: n(r[2]),
      distractorsUsed: r[3] ? n(r[3]) : 0,
      missing: r[4] ? n(r[4]) : 0,
    });
  }
  return null;
}
