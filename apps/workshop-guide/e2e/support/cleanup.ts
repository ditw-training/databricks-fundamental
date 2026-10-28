/** `npm run test:e2e:cleanup`: removes the suite's rows by hand (e.g. after E2E_SKIP_CLEANUP=1). */
import { countTestRows, deleteTestRows } from './db';

const n = deleteTestRows();
console.log(`removed ${n} test rows, ${countTestRows()} left`);
