import { countTestRows, deleteTestRows } from './db';

/** Runs after every run, also a failed one: removes the suite's rows (which also locks everything again). */
export default function globalTeardown() {
  if (process.env.E2E_SKIP_CLEANUP === '1') {
    console.log('[e2e] E2E_SKIP_CLEANUP=1: test rows kept, run `npm run test:e2e:cleanup` later');
    return;
  }
  const n = deleteTestRows();
  const left = countTestRows();
  console.log(`[e2e] cleanup: removed ${n} test rows, ${left} left`);
  if (left > 0) throw new Error(`[e2e] ${left} test rows are still in the progress table`);
}
