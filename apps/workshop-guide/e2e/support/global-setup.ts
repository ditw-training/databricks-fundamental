import { deleteTestRows } from './db';

/** Starts from a clean slate: no rows of earlier runs, so every item is locked (default `none`). */
export default async function globalSetup() {
  const base = process.env.BASE_URL ?? 'http://localhost:8000';
  const res = await fetch(`${base}/api/me`, { headers: { 'X-Forwarded-Email': 'e2e-probe@example.com' } }).catch(
    (err: unknown) => {
      throw new Error(
        `Workshop Guide is not reachable at ${base} (${(err as Error).message}). Start it first, see README "E2E tests".`
      );
    }
  );
  if (!res.ok) throw new Error(`GET ${base}/api/me answered ${res.status}. Is it the production build (npm start)?`);
  if (process.env.E2E_SKIP_CLEANUP === '1') return;
  const n = deleteTestRows();
  if (n > 0) console.log(`[e2e] removed ${n} rows of an earlier run`);
}
