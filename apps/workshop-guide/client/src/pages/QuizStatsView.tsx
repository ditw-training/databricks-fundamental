import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { AlertTriangle, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { QuizResponse } from '../../../shared/quiz-schema';
import { Kpi } from '../components/Kpi';
import { useQuizStats } from '../lib/progress';
import { buildQuizStats, fetchQuiz } from '../lib/quiz';
import { useI18n } from '../i18n/context';
import { formatAgo, locale } from '../lib/status';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Trainer tab: first-attempt score per participant, first-attempt rate per question. */
export function QuizStatsView() {
  const { m } = useI18n();
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  useEffect(() => {
    fetchQuiz()
      .then(setQuiz)
      .catch((e: unknown) => setQuizError((e as Error).message));
  }, []);

  if (quizError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden />
        <AlertTitle>{m.quizUnavailable}</AlertTitle>
        <AlertDescription>{quizError}</AlertDescription>
      </Alert>
    );
  }
  if (!quiz) return <Skeleton className="h-64 w-full" />;
  return (
    <>
      {!quiz.configured && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertTitle>{m.quizNotConfiguredTrainer}</AlertTitle>
          <AlertDescription>
            <p>{quiz.reason ?? m.unknownReason}</p>
            <p>
              {m.quizFixBefore} <code>npm run quiz-from-md</code>
              {m.quizFixUpload} <code>utilization/quiz_key.json</code> {m.quizFixGrant} <code>READ VOLUME</code>{' '}
              {m.quizFixAfter}
            </p>
          </AlertDescription>
        </Alert>
      )}
      <QuizStatsTables quiz={quiz.quiz} />
    </>
  );
}

function QuizStatsTables({ quiz }: { quiz: QuizResponse['quiz'] }) {
  const { lang, m } = useI18n();
  const { rows, error, updatedAt } = useQuizStats();
  const stats = useMemo(() => buildQuizStats(quiz, rows ?? []), [quiz, rows]);
  const loading = rows === null && !error;
  const total = quiz.questions.length;
  const questionText = (id: string) => quiz.questions.find((q) => q.id === id)?.text[lang].replace(/[`*]/g, '') ?? id;
  // "M03": short module label in both languages (the full label is "Module 03" / "Moduł 03").
  const moduleLabel = (id: string) => quiz.modules.find((mod) => mod.id === id)?.label.en.replace('Module ', 'M') ?? id;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={m.kpiParticipants} value={loading ? null : String(stats.participants.length)} note={m.kpiQuizParticipantsNote} />
        <Kpi label={m.kpiCompleted} value={loading ? null : String(stats.completed)} note={m.kpiCompletedNote(total)} />
        <Kpi label={m.kpiAverage} value={loading ? null : pct(stats.averageScore)} note={m.kpiAverageNote} />
        <Kpi
          label={m.kpiLastActivity}
          value={loading ? null : formatAgo(stats.lastActivity, undefined, lang)}
          note={m.kpiLastActivityNote}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {updatedAt ? m.updatedAt(updatedAt.toLocaleTimeString(locale(lang)), m.sourceQuiz) : error ? '' : `${m.loading}…`}
      </p>
      <p role="status" className={error ? 'text-xs text-[var(--destructive)]' : 'sr-only'}>
        {error ? (rows === null ? m.quizLoadFailed(error) : m.quizRefreshFailed(error)) : ''}
      </p>

      {rows === null && error ? null : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : stats.participants.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{m.noQuizAnswersTitle}</EmptyTitle>
            <EmptyDescription>{m.noQuizAnswersText}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{m.kpiParticipants}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="wg-matrix w-full">
                  <caption className="sr-only">{m.participantsCaption}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        {m.colParticipant}
                      </th>
                      <th scope="col">{m.colFirstAttempt}</th>
                      <th scope="col">{m.colSolved}</th>
                      <th scope="col" className="text-right">
                        {m.colLastActivity}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.participants.map((p) => (
                      <tr key={p.email}>
                        <th scope="row" className="max-w-56 truncate text-left font-normal" title={p.email}>
                          {p.email}
                        </th>
                        <td className="text-center tabular-nums">
                          {p.firstCorrect}/{total} <span className="text-muted-foreground">({pct(p.score)})</span>
                        </td>
                        <td className="text-center tabular-nums">
                          {p.completed ? m.solvedAll : `${p.solved}/${total}`}
                          {p.attempted > p.solved ? (
                            <span className="text-muted-foreground">{m.solvedOpen(p.attempted - p.solved)}</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-right text-muted-foreground">{formatAgo(p.lastActivity, undefined, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{m.questionsHardest}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="wg-matrix w-full">
                  <caption className="sr-only">{m.questionsCaption}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        {m.colQuestion}
                      </th>
                      <th scope="col">{m.colFirstTry}</th>
                      <th scope="col">{m.colCommonWrong}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.questions.map((q) => (
                      <tr key={q.id}>
                        <th scope="row" className="max-w-80 text-left font-normal" title={questionText(q.id)}>
                          <span className="font-mono text-xs text-muted-foreground">
                            {q.id.slice(1)} · {moduleLabel(q.module)}
                          </span>{' '}
                          <span className="line-clamp-1">{questionText(q.id)}</span>
                        </th>
                        <td className="text-center tabular-nums">
                          {pct(q.rate)}
                          <span className="text-muted-foreground"> ({q.firstCorrect}/{q.attempted})</span>
                        </td>
                        <td className="text-center font-mono text-xs">{q.commonWrong ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
