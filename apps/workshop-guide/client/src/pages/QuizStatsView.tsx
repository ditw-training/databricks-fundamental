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
import { formatAgo } from '../lib/status';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

/** Trainer tab: first-attempt score per participant, first-attempt rate per question. */
export function QuizStatsView() {
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
        <AlertTitle>Quiz unavailable</AlertTitle>
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
          <AlertTitle>The quiz is not configured: participants cannot answer</AlertTitle>
          <AlertDescription>
            <p>{quiz.reason ?? 'Unknown reason.'}</p>
            <p>
              Fix: run <code>npm run quiz-from-md</code>, upload <code>utilization/quiz_key.json</code> to the volume and grant the
              app service principal <code>READ VOLUME</code> (README, “Quiz”). The app reloads the key within 30 s.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <QuizStatsTables quiz={quiz.quiz} />
    </>
  );
}

function QuizStatsTables({ quiz }: { quiz: QuizResponse['quiz'] }) {
  const { rows, error, updatedAt } = useQuizStats();
  const stats = useMemo(() => buildQuizStats(quiz, rows ?? []), [quiz, rows]);
  const loading = rows === null && !error;
  const total = quiz.questions.length;
  const questionText = (id: string) => quiz.questions.find((q) => q.id === id)?.text.en.replace(/[`*]/g, '') ?? id;
  const moduleLabel = (id: string) => quiz.modules.find((m) => m.id === id)?.label.en.replace('Module ', 'M') ?? id;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Participants" value={loading ? null : String(stats.participants.length)} note="answered at least one question" />
        <Kpi label="Completed" value={loading ? null : String(stats.completed)} note={`solved all ${total} questions`} />
        <Kpi label="Average score" value={loading ? null : pct(stats.averageScore)} note="first attempts correct" />
        <Kpi label="Last activity" value={loading ? null : formatAgo(stats.lastActivity)} note="any participant" />
      </div>

      <p className="text-xs text-muted-foreground">
        {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · source: progress table (workshop = quiz)` : error ? '' : 'Loading…'}
      </p>
      <p role="status" className={error ? 'text-xs text-[var(--destructive)]' : 'sr-only'}>
        {error ? (rows === null ? `Could not load quiz results: ${error}` : `Could not refresh: ${error}. Retrying.`) : ''}
      </p>

      {rows === null && error ? null : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : stats.participants.length === 0 ? (
        <Empty className="rounded-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users aria-hidden />
            </EmptyMedia>
            <EmptyTitle>No quiz answers yet</EmptyTitle>
            <EmptyDescription>Participants appear here after their first answer on the Quiz page.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="wg-matrix w-full">
                  <caption className="sr-only">First-attempt score and completion per participant</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        Participant
                      </th>
                      <th scope="col">First-attempt score</th>
                      <th scope="col">Solved</th>
                      <th scope="col" className="text-right">
                        Last activity
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
                          {p.completed ? 'all' : `${p.solved}/${total}`}
                          {p.attempted > p.solved ? (
                            <span className="text-muted-foreground"> · {p.attempted - p.solved} open</span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap text-right text-muted-foreground">{formatAgo(p.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Questions, hardest first</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="wg-matrix w-full">
                  <caption className="sr-only">First-attempt correct rate per question, lowest first</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="text-left">
                        Question
                      </th>
                      <th scope="col">First try correct</th>
                      <th scope="col">Common wrong</th>
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
