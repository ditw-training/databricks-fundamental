-- State per participant and step for one workshop.
-- Run by the server only (GET /api/progress/me and /api/progress/matrix), as the app
-- service principal, at most once per workshop every few seconds (server-side cache).
-- It is deliberately NOT in config/queries/: the AppKit analytics plugin serves every
-- file there at /api/analytics/query/<name> to any signed-in user, before custom
-- middleware runs, so the trainer gate and the per-user filter could be bypassed.
-- {{PROGRESS_TABLE}} is replaced at startup with PROGRESS_TABLE (validated catalog.schema.table).
--
-- Two tracks (SPEC section 11):
-- - A step counts once, whichever track passed it: the state is the latest PASS row, or the
--   latest row when the step has no pass yet (a later failed try in the other track does not
--   turn a passed step red).
-- - tracks: tracks with a pass, from the "track=sql|pyspark" prefix of app messages ("pyspark,sql").
-- - Rows of the optional "Check on data" (step_type = 'data_check') never change the state.
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
  runs,
  tracks
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
    array_join(
      array_sort(
        collect_set(
          CASE WHEN status = 'pass' THEN nullif(regexp_extract(message, '^track=(sql|pyspark)', 1), '') END
        ) OVER (PARTITION BY lower(user_email), step)
      ),
      ','
    ) AS tracks,
    ROW_NUMBER() OVER (
      PARTITION BY lower(user_email), step
      ORDER BY CASE WHEN status = 'pass' THEN 0 ELSE 1 END, ts DESC
    ) AS rn
  FROM {{PROGRESS_TABLE}}
  WHERE workshop = :workshop
    AND coalesce(step_type, '') <> 'data_check'
)
WHERE rn = 1
ORDER BY user_email, step
LIMIT 10000
