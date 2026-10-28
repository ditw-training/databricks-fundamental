-- Warehouse statements of the progress table in the load-test window, by kind.
-- system.query.history lags a few minutes: run it ~5 min after the test.
-- Params: :warehouse_id, :t_start, :t_end (ISO timestamps printed by class-sim.mjs) and
-- :executed_by, the identity of the server under test (locally: the CLI profile user; deployed:
-- the app service principal id). It keeps out statements of other apps on the same warehouse.
SELECT
  -- Classified by how the statement starts (the server SQL files start with a comment line).
  CASE
    WHEN statement_text LIKE 'INSERT%VALUES%''quiz''%' THEN 'quiz insert'
    WHEN statement_text LIKE 'INSERT%VALUES%' THEN 'progress insert'
    WHEN statement_text LIKE 'INSERT%SELECT%' THEN 'unlock insert'
    WHEN statement_text LIKE '-- State per participant%' THEN 'progress read'
    WHEN statement_text LIKE '-- Trainer unlock state%' THEN 'unlock read'
    WHEN statement_text LIKE '-- Course quiz%' THEN 'quiz read'
    ELSE 'other'
  END AS kind,
  count(*) AS statements,
  round(percentile(total_duration_ms, 0.5)) AS p50_ms,
  round(percentile(total_duration_ms, 0.95)) AS p95_ms,
  max(total_duration_ms) AS max_ms,
  sum(CASE WHEN execution_status <> 'FINISHED' THEN 1 ELSE 0 END) AS not_finished
FROM system.query.history
WHERE compute.warehouse_id = :warehouse_id
  AND start_time BETWEEN CAST(:t_start AS TIMESTAMP) AND CAST(:t_end AS TIMESTAMP)
  AND statement_text LIKE '%workshop_progress%'
  AND executed_by = :executed_by
  -- the CLI's own queries (cleanup, this query) are not the server's
  AND statement_text NOT LIKE '%system.query.history%'
  AND statement_text NOT LIKE 'DELETE%'
GROUP BY 1
ORDER BY statements DESC
