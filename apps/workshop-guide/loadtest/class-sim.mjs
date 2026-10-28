#!/usr/bin/env node
// Load test: simulates one class against a running Workshop Guide server.
//
// - N participants (load.NN@example.com): GET /api/guides once, then poll GET /api/unlock and
//   GET /api/progress/me every --poll seconds (like the UI), and submit every step of Workshop I
//   to POST /api/progress with a think time of 20-60 s divided by --speed. Some answers are wrong
//   first (--wrong), then corrected. A share of them (--quiz) also answers the quiz (random option
//   until correct, like the learning mode).
// - 1 trainer (load.trainer@example.com, must be in TRAINER_EMAILS of the server): unlocks all
//   items at the start, then polls GET /api/progress/matrix and GET /api/unlock every --poll seconds.
//
// Identity is the X-Forwarded-Email header, so the server must run locally (not behind the
// Databricks Apps proxy). Only @example.com identities are used; clean up afterwards with
// loadtest/cleanup.sql.
//
// Usage:
//   node loadtest/class-sim.mjs --base http://localhost:8791 [--participants 15] [--duration 600]
//     [--speed 2] [--poll 5] [--wrong 0.25] [--quiz 0.3] [--workshop ws_ingestion] [--out file.json]
//
// No dependencies: Node 20+ (global fetch).

/* global process, console, fetch, performance, AbortSignal, setTimeout, setInterval, clearInterval */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    base: 'http://localhost:8000',
    participants: 15,
    duration: 600,
    speed: 2,
    poll: 5,
    wrong: 0.25,
    quiz: 0.3,
    workshop: 'ws_ingestion',
    trainer: 'load.trainer@example.com',
    out: '',
    seed: 42,
  };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!(key in opts)) throw new Error(`Unknown option --${key}`);
    opts[key] = typeof opts[key] === 'number' ? Number(argv[i + 1]) : argv[i + 1];
  }
  if (!opts.trainer.endsWith('@example.com')) throw new Error('--trainer must end with @example.com');
  return opts;
}

const opts = parseArgs(process.argv);

// Deterministic PRNG so two runs submit the same pattern.
let seed = opts.seed >>> 0;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Guide: correct and wrong answers per step and track, from config/guides ──
const guide = JSON.parse(readFileSync(join(here, '..', 'config', 'guides', `${opts.workshop}.json`), 'utf8'));
const quizQuestions = JSON.parse(readFileSync(join(here, '..', 'config', 'quiz', 'questions.json'), 'utf8')).questions;

function exerciseFor(step, track) {
  // Raw guide JSON: a step with `variants` is a two-track step (the server normalizes it to 'tracks').
  if (!step.variants) return step;
  const own = step.variants?.[track];
  if (own && 'type' in own) return own;
  const target = own?.same_as ?? (track === 'sql' ? 'pyspark' : 'sql');
  return step.variants?.[target];
}

function answerFor(ex, correct) {
  if (ex.type === 'fill') {
    const values = Object.fromEntries(Object.entries(ex.blanks).map(([b, d]) => [b, d.answers[0]]));
    if (!correct) values[Object.keys(values)[0]] = 'wrong_value';
    return { type: 'fill', values };
  }
  if (ex.type === 'order') {
    const order = [...ex.order];
    if (!correct) [order[0], order[1]] = [order[1], order[0]];
    return { type: 'order', order };
  }
  if (ex.type === 'match') {
    const assignment = ex.pairs.map((_, i) => i);
    if (!correct) [assignment[0], assignment[1]] = [assignment[1], assignment[0]];
    return { type: 'match', assignment };
  }
  throw new Error(`Unsupported exercise type ${ex.type}`);
}

// ── Metrics ──
const metrics = new Map(); // endpoint -> { lat: [], status: {code: n} }
const unexpected = []; // first few unexpected responses, for the report
function record(endpoint, ms, status) {
  let m = metrics.get(endpoint);
  if (!m) metrics.set(endpoint, (m = { lat: [], status: {} }));
  m.lat.push(ms);
  m.status[status] = (m.status[status] ?? 0) + 1;
}

async function call(email, method, path, body, label = path.split('?')[0]) {
  const t0 = performance.now();
  let status = 'ERR';
  let json = null;
  try {
    const res = await fetch(opts.base + path, {
      method,
      headers: { 'X-Forwarded-Email': email, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch (err) {
    status = err?.name === 'TimeoutError' ? 'TIMEOUT' : 'ERR';
  }
  const ms = performance.now() - t0;
  record(`${method} ${label}`, ms, status);
  const expected = typeof status === 'number' && (status < 400 || status === 409);
  if (!expected && unexpected.length < 20) unexpected.push({ email, method, path, status, body: json });
  return { status, json, ms };
}

const startedAt = new Date();
const deadline = Date.now() + opts.duration * 1000;
const running = () => Date.now() < deadline;

/** Polls `path` every --poll seconds until the run ends (no overlap, like the UI's setTimeout loop). */
async function poller(email, path, label) {
  await sleep(rand() * opts.poll * 1000); // spread clients over the interval
  while (running()) {
    const t0 = Date.now();
    await call(email, 'GET', path, null, label);
    await sleep(Math.max(0, opts.poll * 1000 - (Date.now() - t0)));
  }
}

const participantStats = [];

async function participant(n) {
  const email = `load.${String(n).padStart(2, '0')}@example.com`;
  const track = n % 2 === 0 ? 'pyspark' : 'sql';
  const stat = {
    email,
    track,
    passed: 0,
    failedTries: 0,
    firstMeRows: null,
    quizCorrect: 0,
    quizTries: 0,
    finishedAtS: null,
  };
  participantStats.push(stat);
  await sleep(rand() * 10_000); // people join over the first 10 s
  await call(email, 'GET', '/api/me');
  await call(email, 'GET', '/api/guides?lang=pl', null, '/api/guides');
  // Fresh identity: the server must return no progress rows (nothing passed yet).
  const first = await call(email, 'GET', `/api/progress/me?workshop=${opts.workshop}`, null, '/api/progress/me');
  stat.firstMeRows = first.json?.rows?.length ?? null;
  await call(email, 'GET', `/api/guides/${opts.workshop}?lang=pl`, null, '/api/guides/:id');

  const polls = [
    poller(email, '/api/unlock', '/api/unlock'),
    poller(email, `/api/progress/me?workshop=${opts.workshop}`, '/api/progress/me'),
  ];

  const work = (async () => {
    for (const step of guide.steps) {
      const ex = exerciseFor(step, track);
      if (!ex || !['fill', 'order', 'match'].includes(ex.type)) continue;
      let attempts = 0;
      let wrongFirst = rand() < opts.wrong;
      while (running()) {
        await sleep((between(20, 60) * 1000) / opts.speed / (attempts > 0 ? 3 : 1));
        if (!running()) return;
        attempts += 1;
        const r = await call(email, 'POST', '/api/progress', {
          workshop: opts.workshop,
          step: step.id,
          track,
          answer: answerFor(ex, !wrongFirst),
          hints_used: wrongFirst ? 1 : 0,
          attempts,
        });
        if (r.status === 201 && r.json?.status === 'pass') {
          stat.passed += 1;
          break;
        }
        if (r.status === 201) stat.failedTries += 1;
        wrongFirst = false;
      }
    }
    stat.finishedAtS = Math.round((Date.now() - startedAt.getTime()) / 1000);

    if (n <= Math.round(opts.participants * opts.quiz)) {
      await call(email, 'GET', '/api/quiz', null, '/api/quiz');
      const quizPoll = poller(email, '/api/quiz/me', '/api/quiz/me');
      for (const q of quizQuestions) {
        const options = q.options.map((o) => o.id).sort(() => rand() - 0.5);
        for (const option of options) {
          await sleep((between(10, 30) * 1000) / opts.speed);
          if (!running()) break;
          stat.quizTries += 1;
          const r = await call(email, 'POST', '/api/quiz/answer', { question: q.id, option, lang: 'pl' });
          if (r.status === 409 || r.json?.correct) {
            stat.quizCorrect += 1;
            break;
          }
          if (r.status !== 201) break;
        }
        if (!running()) break;
      }
      await quizPoll;
    }
  })();
  await Promise.all([...polls, work]);
}

async function trainer() {
  const email = opts.trainer;
  await call(email, 'GET', '/api/me');
  const unlock = await call(email, 'POST', '/api/unlock', { item: 'all', on: true });
  if (unlock.status !== 200 && unlock.status !== 201) {
    throw new Error(`Trainer unlock failed (${unlock.status}): is ${email} in TRAINER_EMAILS of the server?`);
  }
  await Promise.all([
    poller(email, `/api/progress/matrix?workshop=${opts.workshop}`, '/api/progress/matrix'),
    poller(email, '/api/unlock', '/api/unlock'),
  ]);
}

// ── Run ──
console.log(
  `[load] ${opts.participants} participants + trainer, ${opts.duration} s, speed x${opts.speed}, poll ${opts.poll} s, base ${opts.base}`
);
const progressTimer = setInterval(() => {
  const total = [...metrics.values()].reduce((s, m) => s + m.lat.length, 0);
  const passed = participantStats.reduce((s, p) => s + p.passed, 0);
  console.log(`[load] t=${Math.round((Date.now() - startedAt) / 1000)} s requests=${total} steps passed=${passed}`);
}, 30_000);

const trainerRun = trainer();
await sleep(1500); // unlock first, then the class joins
await Promise.all([trainerRun, ...Array.from({ length: opts.participants }, (_, i) => participant(i + 1))]);
clearInterval(progressTimer);
const endedAt = new Date();

// ── Report ──
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const rows = [...metrics.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([endpoint, m]) => {
    const lat = [...m.lat].sort((a, b) => a - b);
    const errors = Object.entries(m.status)
      .filter(([s]) => !(Number(s) < 400 || s === '409' || s === '423' || s === '429'))
      .reduce((s, [, n]) => s + n, 0);
    return {
      endpoint,
      n: lat.length,
      p50: Math.round(pct(lat, 50)),
      p95: Math.round(pct(lat, 95)),
      max: Math.round(lat[lat.length - 1]),
      errors,
      errorRate: +(errors / lat.length).toFixed(4),
      status: m.status,
    };
  });
const totalReq = rows.reduce((s, r) => s + r.n, 0);
const totalErr = rows.reduce((s, r) => s + r.errors, 0);
const report = {
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  options: opts,
  totals: {
    requests: totalReq,
    errors: totalErr,
    errorRate: +(totalErr / totalReq).toFixed(4),
    rps: +(totalReq / opts.duration).toFixed(2),
  },
  endpoints: rows,
  participants: participantStats,
  unexpected,
};

console.log('\nendpoint                        n      p50    p95    max  errors  statuses');
for (const r of rows) {
  console.log(
    `${r.endpoint.padEnd(30)} ${String(r.n).padStart(5)} ${String(r.p50).padStart(6)} ${String(r.p95).padStart(6)} ${String(r.max).padStart(6)} ${String(r.errors).padStart(7)}  ${JSON.stringify(r.status)}`
  );
}
console.log(`\ntotal ${totalReq} requests, ${totalErr} errors, ${report.totals.rps} req/s`);
console.log(`window for system.query.history: ${report.startedAt} .. ${report.endedAt}`);
const fresh = participantStats.filter((p) => p.firstMeRows !== 0);
console.log(
  fresh.length
    ? `WARNING: ${fresh.length} fresh participants got progress rows on their first GET /api/progress/me`
    : 'fresh participants: GET /api/progress/me returned 0 rows for all (nothing passed before the first answer)'
);
const steps = guide.steps.length;
console.log(`steps passed: ${participantStats.map((p) => `${p.email.slice(5, 7)}:${p.passed}/${steps}`).join(' ')}`);
if (opts.out) writeFileSync(opts.out, JSON.stringify(report, null, 2));
if (unexpected.length) console.log('unexpected responses (first 20):', JSON.stringify(unexpected, null, 1));
