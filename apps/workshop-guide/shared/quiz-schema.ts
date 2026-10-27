import { z } from 'zod';

/** Quiz languages. The quiz sources exist in Polish and English. */
export const quizLangSchema = z.enum(['pl', 'en']);
export type QuizLang = z.infer<typeof quizLangSchema>;

const localized = z.object({ en: z.string().min(1), pl: z.string().min(1) });
export type Localized = z.infer<typeof localized>;

const questionId = z.string().regex(/^q\d{2}$/);
const optionId = z.string().regex(/^[A-Z]$/);

/** config/quiz/questions.json (public, built by scripts/quiz-from-md.mjs): no answers. */
export const quizQuestionsSchema = z
  .object({
    version: z.string().min(1),
    modules: z.array(z.object({ id: z.string().regex(/^m\d{2}$/), label: localized, title: localized })).min(1),
    questions: z
      .array(
        z.object({
          id: questionId,
          module: z.string(),
          text: localized,
          options: z.array(z.object({ id: optionId, text: localized })).min(2),
        }),
      )
      .min(1),
  })
  .strict()
  .superRefine((quiz, ctx) => {
    const modules = new Set(quiz.modules.map((m) => m.id));
    const ids = new Set<string>();
    quiz.questions.forEach((q, i) => {
      if (ids.has(q.id)) ctx.addIssue({ code: 'custom', path: ['questions', i, 'id'], message: `duplicate ${q.id}` });
      ids.add(q.id);
      if (!modules.has(q.module)) {
        ctx.addIssue({ code: 'custom', path: ['questions', i, 'module'], message: `unknown module ${q.module}` });
      }
      if (new Set(q.options.map((o) => o.id)).size !== q.options.length) {
        ctx.addIssue({ code: 'custom', path: ['questions', i, 'options'], message: 'duplicate option ids' });
      }
    });
  });
export type QuizQuestions = z.infer<typeof quizQuestionsSchema>;
export type QuizQuestion = QuizQuestions['questions'][number];
export type QuizModule = QuizQuestions['modules'][number];

/** Private key file (UC volume, QUIZ_KEY_PATH). Never sent to the browser as a whole. */
export const quizKeySchema = z.object({
  version: z.string().min(1),
  answers: z.record(
    questionId,
    z.object({ correct: optionId, explanation: localized, module_ref: localized }),
  ),
});
export type QuizKey = z.infer<typeof quizKeySchema>;

/** GET /api/quiz */
export interface QuizResponse {
  quiz: QuizQuestions;
  /** false when the key file could not be loaded or does not match the questions */
  configured: boolean;
  /** Why the quiz is not configured; only sent to trainers. */
  reason?: string;
}

/** POST /api/quiz/answer body */
export const quizAnswerPostSchema = z
  .object({
    question: questionId,
    option: optionId,
    lang: quizLangSchema,
  })
  .strict();
export type QuizAnswerPost = z.infer<typeof quizAnswerPostSchema>;

/** POST /api/quiz/answer response */
export const quizAnswerResponseSchema = z.object({
  correct: z.boolean(),
  explanation: z.string(),
  module_ref: z.string(),
  /** attempt number recorded for this question (1 = first attempt) */
  attempt: z.number().int().positive(),
});
export type QuizAnswerResponse = z.infer<typeof quizAnswerResponseSchema>;

const nullableNumber = z.coerce.number().nullable().optional().transform((v) => v ?? null);

/** One row of server/sql/quiz_progress.sql: per participant and question. */
export const quizProgressRowSchema = z.object({
  user_email: z.string(),
  step: z.string(),
  first_status: z.string(),
  /** first option chosen (message column of the first row) */
  first_option: z.string().nullable().optional().transform((v) => v ?? null),
  passed: z.union([z.boolean(), z.string(), z.number()]).transform((v) => v === true || v === 'true' || v === 1 || v === '1'),
  attempts: z.coerce.number(),
  max_attempt: nullableNumber,
  last_ts: z.string(),
});
export type QuizProgressRow = z.infer<typeof quizProgressRowSchema>;

/** GET /api/quiz/me rows: own state, no email. */
export const quizParticipantRowSchema = quizProgressRowSchema.omit({ user_email: true });
export type QuizParticipantRow = z.infer<typeof quizParticipantRowSchema>;

/**
 * GET /api/quiz/review?lang= : explanations for the questions the signed-in user has
 * already attempted (they saw them after the attempt). `correct` only once passed.
 */
export const quizReviewResponseSchema = z.object({
  items: z.record(
    z.string(),
    z.object({ explanation: z.string(), module_ref: z.string(), correct: z.string().nullable() }),
  ),
});
export type QuizReviewResponse = z.infer<typeof quizReviewResponseSchema>;
