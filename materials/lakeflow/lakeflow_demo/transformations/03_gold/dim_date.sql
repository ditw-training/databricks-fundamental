
------------------------------------------------------------------
-- GOLD – DIM DATE (MV) - Standalone date dimension
------------------------------------------------------------------

CREATE OR REFRESH MATERIALIZED VIEW dim_date
AS
WITH date_range AS (
  SELECT explode(
    sequence(
      to_date('2020-01-01'),
      to_date('2030-12-31'),
      interval 1 day
    )
  ) AS date
)
SELECT
  CAST(date_format(date, 'yyyyMMdd') AS INT) AS date_key,
  date                                        AS date,
  year(date)                                  AS year,
  quarter(date)                               AS quarter,
  month(date)                                 AS month,
  day(date)                                   AS day,
  date_format(date, 'E')                      AS day_of_week,
  dayofweek(date)                             AS day_of_week_num,
  weekofyear(date)                            AS week_of_year,
  date_format(date, 'MMMM')                   AS month_name,
  CASE 
    WHEN date_format(date, 'E') IN ('Sat', 'Sun') 
      THEN 1 ELSE 0 
  END                                         AS is_weekend,
  CASE 
    WHEN month(date) IN (12, 1, 2) THEN 'Winter'
    WHEN month(date) IN (3, 4, 5) THEN 'Spring'
    WHEN month(date) IN (6, 7, 8) THEN 'Summer'
    ELSE 'Fall'
  END                                         AS season
FROM date_range;
