import { describe, expect, it } from 'vitest';
import type { QuizProgressRow, QuizQuestions } from '../../../shared/quiz-schema';
import { applyAnswer, buildQuizStats, nextUnsolved, questionStates, summarize } from './quiz';

const quiz: QuizQuestions = {
  version: 'v1',
  modules: [{ id: 'm01', label: { en: 'Module 01', pl: 'Moduł 01' }, title: { en: 'A', pl: 'A' } }],
  questions: ['q01', 'q02', 'q03'].map((id) => ({
    id,
    module: 'm01',
    text: { en: id, pl: id },
    options: ['A', 'B', 'C', 'D'].map((o) => ({ id: o, text: { en: o, pl: o } })),
  })),
};

const row = (over: Partial<QuizProgressRow>): QuizProgressRow => ({
  user_email: 'a@x.com',
  step: 'q01',
  first_status: 'pass',
  first_option: 'A',
  passed: true,
  attempts: 1,
  max_attempt: 1,
  last_ts: '2026-10-27 10:00:00',
  ...over,
});

describe('participant quiz state', () => {
  it('counts the first attempt for the score and lists questions to review', () => {
    const states = questionStates([
      row({}),
      row({ step: 'q02', first_status: 'fail', first_option: 'B', passed: true, attempts: 2 }),
    ]);
    expect(summarize(quiz, states)).toEqual({ total: 3, solved: 2, firstCorrect: 1, review: ['q02'], unanswered: ['q03'] });
  });

  it('keeps the first result when retrying', () => {
    const wrong = applyAnswer(undefined, false);
    expect(wrong).toEqual({ attempted: true, passed: false, firstCorrect: false });
    expect(applyAnswer(wrong, true)).toEqual({ attempted: true, passed: true, firstCorrect: false });
  });

  it('finds the next unsolved question, wrapping around', () => {
    const ids = ['q01', 'q02', 'q03'];
    const states = questionStates([row({ step: 'q03' })]);
    expect(nextUnsolved(ids, states, 'q02')).toBe('q01');
    expect(nextUnsolved(ids, questionStates(ids.map((step) => row({ step }))), 'q01')).toBeNull();
  });
});

describe('trainer quiz statistics', () => {
  it('scores participants and sorts questions hardest first', () => {
    const stats = buildQuizStats(quiz, [
      row({}),
      row({ step: 'q02' }),
      row({ step: 'q03' }),
      row({ user_email: 'b@x.com', step: 'q01', first_status: 'fail', first_option: 'C' }),
      row({ user_email: 'b@x.com', step: 'q02', first_status: 'fail', first_option: 'C', passed: false }),
      row({ user_email: 'b@x.com', step: 'q99' }),
    ]);
    expect(stats.participants.map((p) => [p.email, p.firstCorrect, p.completed])).toEqual([
      ['a@x.com', 3, true],
      ['b@x.com', 0, false],
    ]);
    expect(stats.completed).toBe(1);
    expect(stats.averageScore).toBeCloseTo(0.5);
    expect(stats.questions.map((q) => [q.id, q.rate])).toEqual([
      ['q01', 0.5],
      ['q02', 0.5],
      ['q03', 1],
    ]);
    expect(stats.questions[0].commonWrong).toBe('C (1)');
  });
});
