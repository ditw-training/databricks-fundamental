import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  useIsMobile,
} from '@databricks/appkit-ui/react';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Check, ListChecks, Lock, RotateCcw, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useSearchParams } from 'react-router';
import type { QuizReviewResponse } from '../../../shared/quiz-schema';
import { StatusDot } from '../components/StatusDot';
import {
  applyAnswer,
  fetchMyQuizRows,
  fetchQuiz,
  fetchReview,
  loc,
  nextUnsolved,
  postAnswer,
  questionStates,
  summarize,
  type QuestionState,
  type QuizLang,
  type QuizQuestions,
} from '../lib/quiz';
import type { StepStatus } from '../lib/status';
import { useI18n } from '../i18n/context';
import { useStoredState } from '../lib/storage';
import type { UnlockView } from '../lib/unlock';

type ReviewItems = QuizReviewResponse['items'];

/** Inline Markdown (backticks, bold) that is valid inside buttons and headings. */
function Inline({ children }: { children: string }) {
  return (
    <span className="wg-md inline-md">
      <ReactMarkdown
        allowedElements={['p', 'code', 'strong', 'em']}
        unwrapDisallowed
        components={{ p: ({ children: c }) => <>{c}</> }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

/** fetchQuiz error marker for a 423 (quiz locked for this participant). */
const LOCKED = '__locked__';

const statusOf = (s: QuestionState | undefined): StepStatus => (s?.passed ? 'pass' : s?.attempted ? 'fail' : 'none');

/** Item III of the day. Locked for participants until the trainer unlocks it (SPEC section 10). */
export function QuizPage({ email, unlock }: { email: string; unlock: UnlockView }) {
  // Before the first unlock poll returns, try the quiz: the server answers 423 if it is locked.
  const open = unlock.rows === null || unlock.open('quiz');
  // Locked while the participant was in the quiz: say that the answers so far are saved.
  const [wasOpen, setWasOpen] = useState(false);
  const confirmedOpen = unlock.rows !== null && unlock.open('quiz');
  // Adjusting state while rendering (React docs: "storing information from previous renders").
  if (confirmedOpen && !wasOpen) setWasOpen(true);
  if (!open) return <QuizLocked lockedNow={wasOpen} />;
  return <QuizLoader email={email} />;
}

function QuizLocked({ lockedNow = false }: { lockedNow?: boolean }) {
  const { m } = useI18n();
  return (
    <Empty className="mx-auto mt-8 max-w-xl rounded-xl border" role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Lock aria-hidden />
        </EmptyMedia>
        <EmptyTitle>
          {m.quizItemTitle}: {lockedNow ? m.lockedNowTitle : m.lockedBadge}
        </EmptyTitle>
        <EmptyDescription>{lockedNow ? m.lockedQuizNowText : `${m.lockedText} ${m.lockedQuizText}`}</EmptyDescription>
      </EmptyHeader>
      <Button asChild variant="outline">
        <Link to="/">
          <ArrowLeft className="size-4" aria-hidden /> {m.backToWorkshops}
        </Link>
      </Button>
    </Empty>
  );
}

function QuizLoader({ email }: { email: string }) {
  // Language comes from the switch in the header (shared with the whole app).
  const { m } = useI18n();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchQuiz>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuiz()
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError((e as { status?: number }).status === 423 ? LOCKED : (e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error === LOCKED) return <QuizLocked />;
  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-xl">
        <AlertTriangle aria-hidden />
        <AlertTitle>{m.quizNotConfiguredTitle}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-6 md:grid-cols-[300px_1fr]" aria-busy="true" aria-label={m.quizLoading}>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!data.configured) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertTitle>{m.quizNotConfiguredTitle}</AlertTitle>
          <AlertDescription>
            <p>{m.quizNotConfigured}</p>
            {data.reason && (
              <p className="mt-2">
                <strong>{m.quizTrainerReason}:</strong> {data.reason}
              </p>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  return <QuizView quiz={data.quiz} email={email} />;
}

function QuizView({ quiz, email }: { quiz: QuizQuestions; email: string }) {
  const { lang, m } = useI18n();
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [listOpen, setListOpen] = useState(false);
  const [states, setStates] = useState<Map<string, QuestionState>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState<ReviewItems>({});
  const [wrong, setWrong] = useStoredState<Record<string, string[]>>(`wg:${email}:quiz:${quiz.version}:wrong`, {});
  const [busy, setBusy] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const moduleParam = params.get('module');
  const moduleFilter = quiz.modules.some((mod) => mod.id === moduleParam) ? moduleParam : null;
  const ids = useMemo(
    () => quiz.questions.filter((q) => !moduleFilter || q.module === moduleFilter).map((q) => q.id),
    [quiz, moduleFilter],
  );
  const showSummary = params.get('view') === 'summary';
  const current = quiz.questions.find((q) => q.id === params.get('q') && ids.includes(q.id)) ?? quiz.questions.find((q) => q.id === ids[0])!;

  const loadStates = useCallback(() => {
    fetchMyQuizRows()
      .then((rows) => setStates(questionStates(rows)))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);
  useEffect(loadStates, [loadStates]);

  useEffect(() => {
    let cancelled = false;
    fetchReview(lang)
      .then((r) => !cancelled && setReview(r.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setNav = (next: { q?: string; module?: string | null; view?: 'summary' | null }) => {
    const p = new URLSearchParams(params);
    if (next.q !== undefined) p.set('q', next.q);
    if (next.module !== undefined) {
      if (next.module) p.set('module', next.module);
      else p.delete('module');
      p.delete('q');
    }
    if (next.view === 'summary') p.set('view', 'summary');
    else if (next.view === null || next.q !== undefined) p.delete('view');
    setParams(p);
  };

  const goTo = (id: string) => {
    setNav({ q: id });
    setListOpen(false);
    setPostError(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const state = states.get(current.id);
  const solved = state?.passed ?? false;
  const wrongHere = wrong[current.id] ?? [];
  const item = review[current.id];
  const index = ids.indexOf(current.id);
  const nextId = nextUnsolved(ids, states, current.id);
  const filtered = summarize(quiz, states, ids);
  const pct = filtered.total ? Math.round((filtered.solved / filtered.total) * 100) : 0;
  const moduleOf = (id: string) => quiz.modules.find((mod) => mod.id === id)!;

  const answer = (option: string) => {
    if (busy || solved || wrongHere.includes(option)) return;
    setBusy(true);
    setPostError(null);
    const qid = current.id;
    postAnswer({ question: qid, option, lang })
      .then((r) => {
        setStates((prev) => new Map(prev).set(qid, applyAnswer(prev.get(qid), r.correct)));
        setReview((prev) => ({
          ...prev,
          [qid]: { explanation: r.explanation, module_ref: r.module_ref, correct: r.correct ? option : null },
        }));
        if (!r.correct) setWrong((prev) => ({ ...prev, [qid]: [...(prev[qid] ?? []), option] }));
      })
      .catch((e: unknown) => {
        setPostError((e as Error).message);
        loadStates(); // e.g. 409: solved on another device
      })
      .finally(() => setBusy(false));
  };

  // Keyboard: A–D answer, N next. Ignored while typing or with modifiers.
  const answerRef = useRef(answer);
  const nextRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    answerRef.current = answer;
    nextRef.current = () => (solved ? (nextId ? goTo(nextId) : setNav({ view: 'summary' })) : undefined);
  });
  useEffect(() => {
    if (showSummary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement | null)?.isContentEditable) return;
      const k = e.key.toUpperCase();
      if (/^[A-D]$/.test(k)) {
        answerRef.current(k);
        e.preventDefault();
      } else if (k === 'N') {
        nextRef.current();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSummary]);

  const list = (
    <nav aria-label={m.quizQuestions} className="flex flex-col gap-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">
            {m.quizAnswered(filtered.solved, filtered.total)}
          </span>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} aria-label={m.quizProgressLabel} />
      </div>
      <Select value={moduleFilter ?? 'all'} onValueChange={(v) => setNav({ module: v === 'all' ? null : v })}>
        <SelectTrigger className="w-full" aria-label={m.quizModule}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{m.quizAllModules}</SelectItem>
          {quiz.modules.map((mod) => (
            <SelectItem key={mod.id} value={mod.id}>
              {loc(mod.label, lang)} · {loc(mod.title, lang)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-3">
        {quiz.modules
          .filter((mod) => !moduleFilter || mod.id === moduleFilter)
          .map((mod) => (
            <section key={mod.id} aria-label={`${loc(mod.label, lang)}: ${loc(mod.title, lang)}`}>
              <h3 className="wg-section-title mb-1">
                {loc(mod.label, lang)} · {loc(mod.title, lang)}
              </h3>
              <ol className="flex flex-col gap-0.5">
                {quiz.questions
                  .filter((q) => q.module === mod.id)
                  .map((q) => {
                    const st = states.get(q.id);
                    const active = q.id === current.id && !showSummary;
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => goTo(q.id)}
                          aria-current={active ? 'step' : undefined}
                          className={`wg-steplink ${active ? 'wg-steplink-active' : ''}`}
                        >
                          <StatusDot status={statusOf(st)} />
                          <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{q.id.slice(1)}</span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {loc(q.text, lang).replace(/[`*]/g, '')}
                          </span>
                          {st?.passed && st.firstCorrect === false && (
                            <RotateCcw className="size-3.5 shrink-0 text-muted-foreground" aria-label={m.quizRetried} />
                          )}
                        </button>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
      </div>
      <Button type="button" variant={showSummary ? 'secondary' : 'outline'} onClick={() => setNav({ view: 'summary' })}>
        <Trophy className="size-4" aria-hidden /> {m.quizSummary}
      </Button>
    </nav>
  );

  const mod = moduleOf(current.module);
  const optionClass = (id: string) => {
    if (solved && item?.correct === id) return 'wg-option wg-option-pass';
    if (wrongHere.includes(id)) return 'wg-option wg-option-fail';
    return 'wg-option';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold">
          {m.quizTitle} · Databricks Fundamental
        </h2>
        <Badge variant="secondary" className="font-mono text-xs">
          {m.quizQuestionCount(quiz.questions.length)}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {isMobile && (
            <Button type="button" variant="outline" size="sm" onClick={() => setListOpen(true)}>
              <ListChecks className="size-4" aria-hidden /> {filtered.solved}/{filtered.total}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        {!isMobile && (
          <aside className="wg-sidebar sticky top-4 max-h-[calc(100vh-6rem)] self-start overflow-y-auto rounded-xl border bg-card p-4">
            {list}
          </aside>
        )}

        <div className="min-w-0">
          {showSummary ? (
            <QuizSummary quiz={quiz} states={states} lang={lang} loaded={loaded} onOpen={goTo} onBack={() => setNav({ view: null })} />
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-5">
                <p className="text-sm text-muted-foreground">{m.quizIntro}</p>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {m.quizQuestion} {index + 1} {m.quizOf} {ids.length}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {loc(mod.label, lang)} · {loc(mod.title, lang)}
                    </span>
                  </div>
                  <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold leading-snug outline-none" id="quiz-question">
                    <span className="mr-2 font-mono text-muted-foreground">{Number(current.id.slice(1))}.</span>
                    <Inline>{loc(current.text, lang)}</Inline>
                  </h3>
                </div>

                <ul role="list" aria-labelledby="quiz-question" className="flex flex-col gap-2">
                  {current.options.map((o) => {
                    const isWrong = wrongHere.includes(o.id);
                    const isRight = solved && item?.correct === o.id;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          className={optionClass(o.id)}
                          onClick={() => answer(o.id)}
                          disabled={busy || solved || isWrong}
                          aria-keyshortcuts={o.id}
                        >
                          <span className="wg-option-letter" aria-hidden>
                            {isRight ? <Check className="size-3.5" /> : isWrong ? <X className="size-3.5" /> : o.id}
                          </span>
                          <span className="sr-only">
                            {o.id}
                            {isRight ? `, ${m.quizCorrect}` : isWrong ? `, ${m.quizIncorrect}` : ''}:
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <Inline>{loc(o.text, lang)}</Inline>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div role="status" aria-live="polite" className="empty:hidden">
                  {busy ? (
                    <p className="text-sm text-muted-foreground">{m.quizSaving}</p>
                  ) : postError ? (
                    <p className="text-sm text-[var(--destructive)]">{postError}</p>
                  ) : state?.attempted ? (
                    <div className={`wg-feedback ${solved ? 'wg-feedback-pass' : 'wg-feedback-fail'} space-y-2`}>
                      <p className="font-medium">{solved ? m.quizCorrect : m.quizIncorrect}</p>
                      {item ? (
                        <>
                          <p>
                            <Inline>{item.explanation}</Inline>
                          </p>
                          <p className="flex items-start gap-1.5 text-muted-foreground">
                            <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>
                              <span className="font-medium text-foreground">{m.quizWhereToLearn}:</span> {item.module_ref}
                            </span>
                          </p>
                        </>
                      ) : (
                        solved && <p className="text-muted-foreground">{m.quizAlreadySolved}</p>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={index <= 0}
                    onClick={() => goTo(ids[index - 1])}
                  >
                    <ArrowLeft className="size-4" aria-hidden /> {m.quizPrev}
                  </Button>
                  {solved ? (
                    nextId ? (
                      <Button type="button" onClick={() => goTo(nextId)} aria-keyshortcuts="N">
                        {m.quizNext} <ArrowRight className="size-4" aria-hidden />
                      </Button>
                    ) : (
                      <Button type="button" onClick={() => setNav({ view: 'summary' })} aria-keyshortcuts="N">
                        <Trophy className="size-4" aria-hidden /> {m.quizSummary}
                      </Button>
                    )
                  ) : (
                    index < ids.length - 1 && (
                      <Button type="button" variant="ghost" onClick={() => goTo(ids[index + 1])}>
                        {m.quizSkip} <ArrowRight className="size-4" aria-hidden />
                      </Button>
                    )
                  )}
                  <span className="ml-auto hidden text-xs text-muted-foreground md:inline">{m.quizKeyboard}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Sheet open={listOpen && isMobile} onOpenChange={setListOpen}>
        <SheetContent side="left" className="overflow-y-auto p-4">
          <SheetHeader className="px-0">
            <SheetTitle>{m.quizTitle}</SheetTitle>
          </SheetHeader>
          {list}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QuizSummary({
  quiz,
  states,
  lang,
  loaded,
  onOpen,
  onBack,
}: {
  quiz: QuizQuestions;
  states: Map<string, QuestionState>;
  lang: QuizLang;
  loaded: boolean;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const { m } = useI18n();
  const all = summarize(quiz, states);
  const pct = all.total ? Math.round((all.firstCorrect / all.total) * 100) : 0;
  const text = (id: string) => loc(quiz.questions.find((q) => q.id === id)!.text, lang);

  if (!loaded) return <Skeleton className="h-72 w-full" />;
  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.quizFirstAttempt}</div>
            <div className="mt-1 text-4xl font-semibold tabular-nums">
              {all.firstCorrect}
              <span className="text-xl text-muted-foreground"> / {all.total}</span>
            </div>
            <div className="text-sm text-muted-foreground">{pct}%</div>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>
              {m.quizAnswered(all.solved, all.total)}
            </div>
            {all.unanswered.length > 0 && (
              <div>
                {m.quizNotAnswered}: {all.unanswered.length}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{m.quizFirstAttempt}</caption>
            <tbody>
              {quiz.modules.map((mod) => {
                const ids = quiz.questions.filter((q) => q.module === mod.id).map((q) => q.id);
                const s = summarize(quiz, states, ids);
                return (
                  <tr key={mod.id} className="border-b last:border-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {loc(mod.label, lang)} · {loc(mod.title, lang)}
                    </th>
                    <td className="py-1.5 text-right tabular-nums">
                      {s.firstCorrect} / {s.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold">{m.quizToReview}</h3>
          {all.review.length === 0 ? (
            <p className="text-sm text-muted-foreground">{all.firstCorrect > 0 ? m.quizNothingToReview : m.quizNotAnswered}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{m.quizToReviewNote}</p>
              <ul className="flex flex-col gap-1">
                {all.review.map((id) => (
                  <li key={id}>
                    <button type="button" className="wg-steplink" onClick={() => onOpen(id)}>
                      <StatusDot status={states.get(id)?.passed ? 'pass' : 'fail'} />
                      <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{id.slice(1)}</span>
                      <span className="min-w-0 flex-1 text-left text-sm">
                        <Inline>{text(id)}</Inline>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> {m.quizBackToQuestions}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">{m.backToWorkshops}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
