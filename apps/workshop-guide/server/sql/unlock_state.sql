-- Trainer unlock state (SPEC section 10): the latest trainer row per item (step).
-- Only rows written by TRAINER_EMAILS count (:trainers = comma-separated, lower-case; the
-- server checks the same again in reduceUnlock). Defense in depth: only the app SP can write.
-- Run by the server only (GET /api/unlock and the 423 gates), as the app service principal,
-- at most once every few seconds (server-side cache). Not in config/queries/ for the same
-- reason as latest_progress.sql.
-- {{PROGRESS_TABLE}} is replaced at startup with PROGRESS_TABLE (validated catalog.schema.table).
SELECT
  step,
  status,
  lower(user_email) AS user_email,
  CAST(ts AS STRING) AS ts
FROM (
  SELECT
    step,
    status,
    user_email,
    ts,
    ROW_NUMBER() OVER (PARTITION BY step ORDER BY ts DESC) AS rn
  FROM {{PROGRESS_TABLE}}
  WHERE workshop = '__unlock' AND step_type = 'unlock' AND source = 'trainer'
    AND array_contains(split(:trainers, ','), lower(user_email))
)
WHERE rn = 1
ORDER BY step
