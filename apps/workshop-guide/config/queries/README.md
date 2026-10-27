# config/queries

Intentionally empty of `.sql` files. AppKit typegen needs this folder to exist.

The progress SQL lives in `server/sql/latest_progress.sql`. Every `.sql` file here is
served by the AppKit analytics plugin at `/api/analytics/query/<name>` to any signed-in
user, and plugin routes are mounted before `server.extend()` routes. A file here could
not be limited to trainers, and a `:user_email` parameter here would come from the
browser. See the README of the app ("Deviation from the AppKit SQL-files rule").
