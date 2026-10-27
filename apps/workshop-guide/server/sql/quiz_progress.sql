-- Course quiz: one row per participant and question (workshop = 'quiz').
-- Run by the server only (GET /api/quiz/me, GET /api/quiz/stats, POST /api/quiz/answer),
-- as the app service principal, at most once every few seconds (server-side cache).
-- Not in config/queries/ for the same reason as latest_progress.sql.
-- {{PROGRESS_TABLE}} is replaced at startup with PROGRESS_TABLE (validated catalog.schema.table).
SELECT
  lower(user_email) AS user_email,
  step,
  min_by(status, ts) AS first_status,
  min_by(message, ts) AS first_option,
  max(CASE WHEN status = 'pass' THEN 1 ELSE 0 END) = 1 AS passed,
  count(*) AS attempts,
  max(attempts) AS max_attempt,
  CAST(max(ts) AS STRING) AS last_ts
FROM {{PROGRESS_TABLE}}
WHERE workshop = 'quiz'
GROUP BY lower(user_email), step
ORDER BY user_email, step
LIMIT 20000
