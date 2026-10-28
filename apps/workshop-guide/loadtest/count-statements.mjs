// Preload for the load test: counts the SQL statements the server sends to the warehouse
// (POST .../api/2.0/sql/statements), by kind and minute, without changing the server code.
// system.query.history cannot separate two local servers that run with the same CLI identity,
// this counter can.
//
//   STATEMENT_COUNT_FILE=/tmp/statements.json node --import ./loadtest/count-statements.mjs dist/server.js
//
// The file is rewritten every 5 s: { total, byKind, byMinute: { "HH:MM": { kind: n } } }.
// Statement text is classified by how it starts; nothing else from the request is stored.
/* global process, setInterval */
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const out = process.env.STATEMENT_COUNT_FILE;
const counts = { startedAt: new Date().toISOString(), total: 0, byKind: {}, byMinute: {} };

function kindOf(statement) {
  const s = statement.trimStart();
  if (/^INSERT[\s\S]*VALUES[\s\S]*'quiz'/.test(s)) return 'quiz insert';
  if (/^INSERT[\s\S]*VALUES/.test(s)) return 'progress insert';
  if (/^INSERT[\s\S]*SELECT/.test(s)) return 'unlock insert';
  if (s.startsWith('-- State per participant')) return 'progress read';
  if (s.startsWith('-- Trainer unlock state')) return 'unlock read';
  if (s.startsWith('-- Course quiz')) return 'quiz read';
  if (/^DELETE/.test(s)) return 'reset delete';
  return 'other';
}

function count(body) {
  let kind = 'other';
  try {
    kind = kindOf(JSON.parse(body).statement ?? '');
  } catch {
    /* not JSON: count as other */
  }
  const minute = new Date().toISOString().slice(11, 16);
  counts.total += 1;
  counts.byKind[kind] = (counts.byKind[kind] ?? 0) + 1;
  counts.byMinute[minute] ??= {};
  counts.byMinute[minute][kind] = (counts.byMinute[minute][kind] ?? 0) + 1;
}

// Every outgoing HTTP(S) request is a ClientRequest, whichever wrapper created it (the SDK's
// fetch, telemetry instrumentation), so the body is read where it is written.
const { ClientRequest } = http;
const statementPath = /\/api\/2\.0\/sql\/statements\/?(\?.*)?$/;
const isStatementPost = (req) => req.method === 'POST' && statementPath.test(req.path ?? '');
for (const name of ['write', 'end']) {
  const original = ClientRequest.prototype[name];
  ClientRequest.prototype[name] = function patched(chunk, ...args) {
    if (chunk && typeof chunk !== 'function' && isStatementPost(this) && !this.__counted) {
      this.__counted = true;
      count(String(chunk));
    }
    return original.call(this, chunk, ...args);
  };
}

const dump = () => {
  if (out) writeFileSync(out, JSON.stringify(counts, null, 2));
};
setInterval(dump, 5000).unref();
process.on('exit', dump);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    dump();
    process.exit(0);
  });
}
