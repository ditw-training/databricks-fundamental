-- Latest state per participant and step for one workshop.
-- Run by the server only (GET /api/progress/me and /api/progress/matrix), as the app
-- service principal, at most once per workshop every few seconds (server-side cache).
-- It is deliberately NOT in config/queries/: the AppKit analytics plugin serves every
-- file there at /api/analytics/query/<name> to any signed-in user, before custom
-- middleware runs, so the trainer gate and the per-user filter could be bypassed.
-- {{PROGRESS_TABLE}} is replaced at startup with PROGRESS_TABLE (validated catalog.schema.table).
-- @param workshop STRING
SELECT
  user_email,
  step,
  step_type,
  status,
  message,
  hints_used,
  attempts,
  source,
  CAST(ts AS STRING) AS ts,
  runs
FROM (
  SELECT
    lower(user_email) AS user_email,
    step,
    step_type,
    status,
    message,
    MAX(hints_used) OVER (PARTITION BY lower(user_email), step) AS hints_used,
    MAX(attempts) OVER (PARTITION BY lower(user_email), step) AS attempts,
    source,
    ts,
    COUNT(*) OVER (PARTITION BY lower(user_email), step) AS runs,
    ROW_NUMBER() OVER (PARTITION BY lower(user_email), step ORDER BY ts DESC) AS rn
  FROM {{PROGRESS_TABLE}}
  WHERE workshop = :workshop
)
WHERE rn = 1
ORDER BY user_email, step
LIMIT 10000
