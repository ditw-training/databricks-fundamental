/** Course quiz: API calls, UI texts (PL/EN) and pure helpers (unit-tested). */
import type {
  Localized,
  QuizAnswerPost,
  QuizAnswerResponse,
  QuizLang,
  QuizParticipantRow,
  QuizProgressRow,
  QuizQuestions,
  QuizResponse,
  QuizReviewResponse,
} from '../../../shared/quiz-schema';
import {
  quizAnswerResponseSchema,
  quizParticipantRowSchema,
  quizProgressRowSchema,
  quizReviewResponseSchema,
} from '../../../shared/quiz-schema';
import { parseTs } from './status';

export type { QuizLang, QuizParticipantRow, QuizProgressRow, QuizQuestions };
export { quizParticipantRowSchema, quizProgressRowSchema };

export const LANG_KEY = 'wg:quiz:lang';

export const loc = (text: Localized, lang: QuizLang) => text[lang];

const T = {
  title: { pl: 'Quiz', en: 'Quiz' },
  intro: {
    pl: 'Sprawdź, co zostało z dzisiejszych modułów. Po każdej odpowiedzi zobaczysz wyjaśnienie i miejsce w notebooku, gdzie temat był omawiany. Możesz próbować do skutku; do wyniku liczy się pierwsza próba.',
    en: 'Check what stayed with you from today’s modules. After each answer you see an explanation and the notebook section that covers it. Retry until you get it right; your score counts first attempts.',
  },
  allModules: { pl: 'Wszystkie moduły', en: 'All modules' },
  module: { pl: 'Moduł', en: 'Module' },
  question: { pl: 'Pytanie', en: 'Question' },
  of: { pl: 'z', en: 'of' },
  correct: { pl: 'Dobrze!', en: 'Correct!' },
  incorrect: { pl: 'Nie tym razem. Spróbuj ponownie.', en: 'Not this time. Try again.' },
  whereToLearn: { pl: 'Gdzie się tego nauczyć', en: 'Where to learn' },
  next: { pl: 'Następne pytanie', en: 'Next question' },
  prev: { pl: 'Poprzednie', en: 'Previous' },
  skip: { pl: 'Pomiń', en: 'Skip' },
  summary: { pl: 'Podsumowanie', en: 'Summary' },
  answered: { pl: 'rozwiązane', en: 'solved' },
  firstAttempt: { pl: 'Wynik za pierwszą próbę', en: 'First-attempt score' },
  toReview: { pl: 'Do powtórki', en: 'To review' },
  toReviewNote: {
    pl: 'Pytania, w których pierwsza odpowiedź była błędna.',
    en: 'Questions where your first answer was wrong.',
  },
  nothingToReview: { pl: 'Wszystko dobrze za pierwszym razem. Brawo!', en: 'All correct on the first try. Well done!' },
  notAnswered: { pl: 'Bez odpowiedzi', en: 'Not answered yet' },
  backToWorkshops: { pl: 'Wróć do warsztatów', en: 'Back to the workshops' },
  restartView: { pl: 'Wróć do pytań', en: 'Back to the questions' },
  notConfiguredTitle: { pl: 'Quiz nie jest jeszcze skonfigurowany', en: 'The quiz is not configured yet' },
  notConfigured: {
    pl: 'Brakuje klucza odpowiedzi. Daj znać prowadzącemu.',
    en: 'The answer key is missing. Tell the trainer.',
  },
  trainerReason: { pl: 'Powód (widoczny tylko dla prowadzących)', en: 'Reason (visible to trainers only)' },
  alreadySolved: {
    pl: 'Rozwiązane. Wyjaśnienie pojawi się, gdy tylko serwer je zwróci.',
    en: 'Solved. The explanation appears as soon as the server returns it.',
  },
  saving: { pl: 'Sprawdzam…', en: 'Checking…' },
  loading: { pl: 'Ładowanie quizu…', en: 'Loading the quiz…' },
  keyboard: { pl: 'Skróty: A–D wybiera odpowiedź, N następne pytanie.', en: 'Shortcuts: A–D picks an answer, N goes to the next question.' },
  language: { pl: 'Język', en: 'Language' },
  questions: { pl: 'Pytania', en: 'Questions' },
  firstTry: { pl: 'za pierwszym razem', en: 'first try' },
  retried: { pl: 'po kolejnej próbie', en: 'after a retry' },
  progressLabel: { pl: 'Rozwiązane pytania', en: 'Questions solved' },
} satisfies Record<string, Localized>;

export type TextKey = keyof typeof T;
export const t = (key: TextKey, lang: QuizLang) => T[key][lang];

// ── API ──

async function errorFrom(res: Response): Promise<Error> {
  let detail = `${res.status} ${res.statusText}`;
  try {
    detail = ((await res.json()) as { error?: string }).error ?? detail;
  } catch {
    /* not JSON */
  }
  return new Error(detail);
}

export async function fetchQuiz(): Promise<QuizResponse> {
  const res = await fetch('/api/quiz', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as QuizResponse;
}

export async function fetchMyQuizRows(): Promise<QuizParticipantRow[]> {
  const res = await fetch('/api/quiz/me', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { rows: unknown[] };
  return body.rows.map((r) => quizParticipantRowSchema.parse(r));
}

export async function fetchReview(lang: QuizLang): Promise<QuizReviewResponse> {
  const res = await fetch(`/api/quiz/review?lang=${lang}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw await errorFrom(res);
  return quizReviewResponseSchema.parse(await res.json());
}

export async function postAnswer(body: QuizAnswerPost): Promise<QuizAnswerResponse> {
  const res = await fetch('/api/quiz/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFrom(res);
  return quizAnswerResponseSchema.parse(await res.json());
}

// ── participant state ──

export interface QuestionState {
  attempted: boolean;
  passed: boolean;
  /** null = not answered yet */
  firstCorrect: boolean | null;
}

export function questionStates(rows: QuizParticipantRow[]): Map<string, QuestionState> {
  const map = new Map<string, QuestionState>();
  for (const r of rows) {
    map.set(r.step, { attempted: true, passed: r.passed, firstCorrect: r.first_status === 'pass' });
  }
  return map;
}

/** Applies the result of one answer to the participant's state. */
export function applyAnswer(prev: QuestionState | undefined, correct: boolean): QuestionState {
  if (!prev || !prev.attempted) return { attempted: true, passed: correct, firstCorrect: correct };
  return { ...prev, passed: prev.passed || correct };
}

export interface Summary {
  total: number;
  solved: number;
  firstCorrect: number;
  /** ids where the first answer was wrong, in quiz order */
  review: string[];
  unanswered: string[];
}

export function summarize(quiz: QuizQuestions, states: Map<string, QuestionState>, ids?: string[]): Summary {
  const list = ids ?? quiz.questions.map((q) => q.id);
  const s: Summary = { total: list.length, solved: 0, firstCorrect: 0, review: [], unanswered: [] };
  for (const id of list) {
    const st = states.get(id);
    if (!st?.attempted) {
      s.unanswered.push(id);
      continue;
    }
    if (st.passed) s.solved += 1;
    if (st.firstCorrect) s.firstCorrect += 1;
    else s.review.push(id);
  }
  return s;
}

/** Next question after `currentId` that is not solved yet (wraps), or null when all are solved. */
export function nextUnsolved(ids: string[], states: Map<string, QuestionState>, currentId: string): string | null {
  const start = Math.max(0, ids.indexOf(currentId));
  for (let i = 1; i <= ids.length; i++) {
    const id = ids[(start + i) % ids.length];
    if (!states.get(id)?.passed) return id;
  }
  return null;
}

// ── trainer statistics ──

export interface QuizParticipantStat {
  email: string;
  attempted: number;
  solved: number;
  firstCorrect: number;
  /** firstCorrect / total questions */
  score: number;
  completed: boolean;
  lastActivity: Date | null;
}

export interface QuizQuestionStat {
  id: string;
  module: string;
  attempted: number;
  firstCorrect: number;
  /** firstCorrect / attempted; null when nobody answered */
  rate: number | null;
  /** most frequent wrong first answer, e.g. "B (3)" */
  commonWrong: string | null;
}

export interface QuizStats {
  participants: QuizParticipantStat[];
  questions: QuizQuestionStat[];
  completed: number;
  averageScore: number | null;
  lastActivity: Date | null;
}

export function buildQuizStats(quiz: QuizQuestions, rows: QuizProgressRow[]): QuizStats {
  const known = new Map(quiz.questions.map((q) => [q.id, q]));
  const total = quiz.questions.length;
  const byUser = new Map<string, QuizParticipantStat>();
  const byQuestion = new Map<string, { attempted: number; firstCorrect: number; wrong: Map<string, number> }>();

  for (const r of rows) {
    if (!known.has(r.step)) continue;
    let p = byUser.get(r.user_email);
    if (!p) {
      p = { email: r.user_email, attempted: 0, solved: 0, firstCorrect: 0, score: 0, completed: false, lastActivity: null };
      byUser.set(r.user_email, p);
    }
    const first = r.first_status === 'pass';
    p.attempted += 1;
    if (r.passed) p.solved += 1;
    if (first) p.firstCorrect += 1;
    const ts = parseTs(r.last_ts);
    if (ts && (!p.lastActivity || ts > p.lastActivity)) p.lastActivity = ts;

    const q = byQuestion.get(r.step) ?? { attempted: 0, firstCorrect: 0, wrong: new Map<string, number>() };
    q.attempted += 1;
    if (first) q.firstCorrect += 1;
    else if (r.first_option) q.wrong.set(r.first_option, (q.wrong.get(r.first_option) ?? 0) + 1);
    byQuestion.set(r.step, q);
  }

  const participants = [...byUser.values()]
    .map((p) => ({ ...p, score: total ? p.firstCorrect / total : 0, completed: p.solved === total }))
    .sort((a, b) => b.firstCorrect - a.firstCorrect || a.email.localeCompare(b.email));

  const questions = quiz.questions
    .map((q): QuizQuestionStat => {
      const s = byQuestion.get(q.id);
      let commonWrong: string | null = null;
      if (s?.wrong.size) {
        const [opt, n] = [...s.wrong.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        commonWrong = `${opt} (${n})`;
      }
      return {
        id: q.id,
        module: q.module,
        attempted: s?.attempted ?? 0,
        firstCorrect: s?.firstCorrect ?? 0,
        rate: s?.attempted ? s.firstCorrect / s.attempted : null,
        commonWrong,
      };
    })
    // Hardest first; questions nobody answered go last.
    .sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.attempted - a.attempted || a.id.localeCompare(b.id));

  const lastActivity = participants.reduce<Date | null>(
    (acc, p) => (p.lastActivity && (!acc || p.lastActivity > acc) ? p.lastActivity : acc),
    null,
  );
  return {
    participants,
    questions,
    completed: participants.filter((p) => p.completed).length,
    averageScore: participants.length ? participants.reduce((s, p) => s + p.score, 0) / participants.length : null,
    lastActivity,
  };
}
