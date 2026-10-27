#!/usr/bin/env node
// Builds the course quiz for the app from the trainer's Markdown sources.
//
// Reads (local only, gitignored):
//   ../../utilization/en/quiz.md, ../../utilization/pl/quiz.md   questions, options, answer key table
//   ../../utilization/quiz_explanations.json                       { qNN: { section, en, pl } }
// Writes:
//   config/quiz/questions.json          PUBLIC, committed: questions and options, no answers
//   ../../utilization/quiz_key.json     PRIVATE: answers, explanations, where to learn
//                                       (upload to the UC volume read by the app, see README)
//
// `version` is a hash of the public questions; the key carries the same value and the
// server refuses a key whose version differs. Run: npm run quiz-from-md
// No dependencies. Fails with a message naming the file and question on any mismatch.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(appDir, '..', '..');
const src = (...p) => path.join(repoDir, 'utilization', ...p);

const paths = {
  en: src('en', 'quiz.md'),
  pl: src('pl', 'quiz.md'),
  explanations: src('quiz_explanations.json'),
  questions: path.join(appDir, 'config', 'quiz', 'questions.json'),
  key: src('quiz_key.json'),
  notebooks: path.join(repoDir, 'notebooks', 'modules'),
};

const OPTION_IDS = ['A', 'B', 'C', 'D'];

function fail(message) {
  console.error(`quiz-from-md: ${message}`);
  process.exit(1);
}

/** Parses one quiz.md: modules (from "# Title {data-label=...}"), questions, answer table. */
export function parseQuizMarkdown(text, file) {
  const modules = [];
  const questions = [];
  const answers = {};
  let current = null;
  let question = null;
  let inKey = false;

  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trimEnd();
    const where = `${file}:${i + 1}`;
    const heading = /^# (.+?)\s*\{data-label="([^"]+)"\}\s*$/.exec(line);
    if (heading) {
      const num = /(\d+)\s*$/.exec(heading[2]);
      if (!num) fail(`${where}: data-label without a module number`);
      current = { id: `m${num[1].padStart(2, '0')}`, label: heading[2].trim(), title: heading[1].trim() };
      modules.push(current);
      question = null;
      continue;
    }
    if (/^# /.test(line)) {
      // "# Answer key {.page-break}" / "# Klucz odpowiedzi"
      inKey = true;
      current = null;
      question = null;
      continue;
    }
    if (inKey) {
      const row = /^\|\s*[^|]*?(\d+)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(line);
      if (!row) continue;
      for (const pair of row[2].split(',')) {
        const m = /^\s*(\d+)\s+([A-D])\s*$/.exec(pair);
        if (!m) fail(`${where}: cannot read answer "${pair.trim()}"`);
        answers[`q${m[1].padStart(2, '0')}`] = m[2];
      }
      continue;
    }
    const q = /^\*\*(\d+)\.\*\*\s+(.+)$/.exec(line);
    if (q) {
      if (!current) fail(`${where}: question ${q[1]} before any module heading`);
      question = { id: `q${q[1].padStart(2, '0')}`, module: current.id, text: q[2].trim(), options: [] };
      questions.push(question);
      continue;
    }
    const opt = /^- ([A-Z])\.\s+(.+)$/.exec(line);
    if (opt) {
      if (!question) fail(`${where}: option outside a question`);
      question.options.push({ id: opt[1], text: opt[2].trim() });
      continue;
    }
    if (question && line.trim() && question.options.length === 0) {
      // Question text continued on the next line.
      question.text += ` ${line.trim()}`;
    }
  }
  return { modules, questions, answers };
}

function notebookFor(moduleId) {
  if (!existsSync(paths.notebooks)) return null;
  const prefix = moduleId.slice(1); // m01 -> 01
  const hit = readdirSync(paths.notebooks).find((f) => f.startsWith(`${prefix}_`) && f.endsWith('.ipynb'));
  return hit ? hit.replace(/\.ipynb$/, '') : null;
}

function main() {
  for (const p of [paths.en, paths.pl, paths.explanations]) if (!existsSync(p)) fail(`missing ${path.relative(repoDir, p)}`);
  const en = parseQuizMarkdown(readFileSync(paths.en, 'utf8'), 'utilization/en/quiz.md');
  const pl = parseQuizMarkdown(readFileSync(paths.pl, 'utf8'), 'utilization/pl/quiz.md');
  const explanations = JSON.parse(readFileSync(paths.explanations, 'utf8'));

  // ── checks ──
  if (en.questions.length !== 40) fail(`EN has ${en.questions.length} questions, expected 40`);
  if (pl.questions.length !== en.questions.length) fail(`PL has ${pl.questions.length} questions, EN ${en.questions.length}`);
  if (en.modules.map((m) => m.id).join() !== pl.modules.map((m) => m.id).join()) fail('EN and PL modules differ');
  const ids = new Set();
  en.questions.forEach((q, i) => {
    const p = pl.questions[i];
    if (ids.has(q.id)) fail(`duplicate question ${q.id}`);
    ids.add(q.id);
    if (p.id !== q.id || p.module !== q.module) fail(`question ${i + 1}: EN ${q.id}/${q.module} vs PL ${p.id}/${p.module}`);
    if (q.options.length !== 4) fail(`${q.id}: EN has ${q.options.length} options, expected 4`);
    if (p.options.length !== q.options.length) fail(`${q.id}: EN has ${q.options.length} options, PL ${p.options.length}`);
    if (q.options.map((o) => o.id).join() !== OPTION_IDS.join()) fail(`${q.id}: EN options are not A-D`);
    if (p.options.map((o) => o.id).join() !== OPTION_IDS.join()) fail(`${q.id}: PL options are not A-D`);
    if (!en.answers[q.id]) fail(`${q.id}: no answer in the EN key table`);
    if (pl.answers[q.id] !== en.answers[q.id]) fail(`${q.id}: EN key ${en.answers[q.id]}, PL key ${pl.answers[q.id]}`);
    const ex = explanations[q.id];
    if (!ex?.en?.trim() || !ex?.pl?.trim() || !ex?.section?.trim()) fail(`${q.id}: explanation (en, pl, section) missing in quiz_explanations.json`);
  });
  if (Object.keys(en.answers).length !== ids.size) fail('the answer key lists questions that do not exist');

  // ── public questions ──
  const enModules = new Map(en.modules.map((m) => [m.id, m]));
  const modules = pl.modules.map((m) => ({
    id: m.id,
    label: { en: enModules.get(m.id).label, pl: m.label },
    title: { en: enModules.get(m.id).title, pl: m.title },
  }));
  const questions = en.questions.map((q, i) => {
    const p = pl.questions[i];
    return {
      id: q.id,
      module: q.module,
      text: { en: q.text, pl: p.text },
      options: q.options.map((o, j) => ({ id: o.id, text: { en: o.text, pl: p.options[j].text } })),
    };
  });
  const version = createHash('sha256').update(JSON.stringify({ modules, questions })).digest('hex').slice(0, 12);

  // ── private key ──
  const answers = {};
  for (const q of questions) {
    const m = modules.find((x) => x.id === q.module);
    const nb = notebookFor(q.module);
    const section = explanations[q.id].section.trim();
    answers[q.id] = {
      correct: en.answers[q.id],
      explanation: { en: explanations[q.id].en.trim(), pl: explanations[q.id].pl.trim() },
      module_ref: {
        en: `${m.label.en}${nb ? ` (${nb})` : ''}, section: ${section}`,
        pl: `${m.label.pl}${nb ? ` (${nb})` : ''}, sekcja: ${section}`,
      },
    };
  }

  mkdirSync(path.dirname(paths.questions), { recursive: true });
  writeFileSync(paths.questions, `${JSON.stringify({ version, modules, questions }, null, 2)}\n`);
  writeFileSync(paths.key, `${JSON.stringify({ version, answers }, null, 2)}\n`);
  console.log(
    `quiz-from-md: ${questions.length} questions in ${modules.length} modules, version ${version}\n` +
      `  public  ${path.relative(repoDir, paths.questions)}\n` +
      `  private ${path.relative(repoDir, paths.key)} (upload to the volume, README "Quiz")`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
