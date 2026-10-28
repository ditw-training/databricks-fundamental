/**
 * End-to-end run of a training day against the real app (production build) and the lab warehouse.
 * One ordered story: the unlock state is global, so the tests run serially in one worker.
 * Identities: `e2e-<run>-*@example.com` participants and `trainer.e2e@example.com` (TRAINER_EMAILS).
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { resolveExercise } from '../shared/guide-schema';
import {
  answerList,
  assertNothingPassedOrPrefilled,
  completeWorkshop,
  counter,
  fillInputs,
  goToStep,
  guidePl,
  identity,
  liveTitle,
  openWorkshop,
  quizKey,
  requiredCount,
  solveFill,
  stepNav,
  waitForProgress,
} from './support/guide';
import { deleteParticipantRows, TRAINER_EMAIL } from './support/db';

const RUN = Date.now().toString(36);
const P1 = `e2e-${RUN}-sql@example.com`;
const P2 = `e2e-${RUN}-py@example.com`;
const P3 = `e2e-${RUN}-mobile@example.com`;
const P4 = `e2e-${RUN}-fresh@example.com`;

const WS1 = guidePl('ws_ingestion');
const WS2 = guidePl('ws_delta');
const UNLOCK_WAIT = 20_000; // 4 s server cache + 5 s poll + guide refetch, with margin

test.describe.configure({ mode: 'serial' });

let trainer: { ctx: BrowserContext; page: Page };
let p1: { ctx: BrowserContext; page: Page };
let p2: { ctx: BrowserContext; page: Page };

const lockedCard = (page: Page, title: string) => page.getByLabel(`${title}: Zablokowane`, { exact: true });

async function openAccess(page: Page) {
  await page.goto('/trainer');
  await expect(page.getByText('Dostęp', { exact: true })).toBeVisible();
}

async function setItem(page: Page, label: string, on: boolean) {
  const sw = page.getByRole('switch', { name: `Odblokuj ${label} dla uczestników` });
  await expect(sw).toBeEnabled({ timeout: 30_000 });
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', String(on));
  // The save is done when the spinner is gone and the switch is enabled again.
  await expect(sw).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByText('Zapisuję…')).toHaveCount(0, { timeout: 60_000 });
}

test.afterAll(async () => {
  for (const s of [trainer, p1, p2]) await s?.ctx.close();
});

test('1. fresh participant: everything is locked by default, Quiz in the header too', async ({ browser }) => {
  p1 = await identity(browser, P1);
  const { page } = p1;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Warsztaty i quiz' })).toBeVisible();
  await expect(lockedCard(page, 'Warsztat I — Ingestion')).toBeVisible();
  await expect(lockedCard(page, 'Warsztat II — Delta Lake')).toBeVisible();
  await expect(lockedCard(page, 'III — Quiz')).toBeVisible();
  await expect(page.getByText('Trener odblokuje to w odpowiednim momencie.')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /^Otwórz/ })).toHaveCount(0);
  const quizNav = page.getByRole('navigation', { name: 'Menu główne' }).getByRole('link', { name: /Quiz/ });
  await expect(quizNav).toContainText('(Zablokowane)');
  await expect(page.getByRole('navigation', { name: 'Menu główne' }).getByRole('link', { name: 'Trener' })).toHaveCount(
    0
  );
  // A direct link into a locked workshop shows the notice, not the content.
  await page.goto('/?ws=ws_ingestion');
  await expect(page.getByText('Zablokowane przez trenera')).toBeVisible();
  await page.goto('/quiz');
  await expect(page.getByText(/Zablokowane/).first()).toBeVisible();
  await expect(page.locator('#quiz-question')).toHaveCount(0);
});

test('2. trainer unlocks Workshop I; the participant sees it without a reload', async ({ browser }) => {
  trainer = await identity(browser, TRAINER_EMAIL);
  await p1.page.goto('/');
  await expect(lockedCard(p1.page, 'Warsztat I — Ingestion')).toBeVisible();

  await openAccess(trainer.page);
  await expect(trainer.page.getByRole('switch')).toHaveCount(3);
  await setItem(trainer.page, 'Warsztat I — Ingestion', true);
  const started = Date.now();
  await expect(p1.page.getByRole('button', { name: 'Otwórz Warsztat I', exact: true })).toBeVisible({
    timeout: UNLOCK_WAIT,
  });
  test.info().annotations.push({ type: 'unlock-propagation-ms', description: String(Date.now() - started) });
  await expect(lockedCard(p1.page, 'Warsztat II — Delta Lake')).toBeVisible();
  await expect(lockedCard(p1.page, 'III — Quiz')).toBeVisible();
});

test('3. fresh participant opens Workshop I: nothing passed, 0/N, no exercise pre-filled', async () => {
  const { page } = p1;
  await openWorkshop(page, WS1);
  await expect(page.getByRole('heading', { name: 'Wybierz ścieżkę' })).toBeVisible();
  await waitForProgress(page);
  await expect(counter(page, 0, requiredCount(WS1))).toBeVisible();
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Zaczynam w SQL' }).click();
  await assertNothingPassedOrPrefilled(page, WS1, 'sql');
});

test('4. SQL track: every step of Workshop I through the UI (wrong answers are not passed)', async () => {
  test.setTimeout(10 * 60_000);
  const { page } = p1;
  await expect(page.getByRole('group', { name: 'Ścieżka' }).getByRole('button', { name: 'SQL' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await completeWorkshop(page, WS1, 'sql');
});

test('5. PySpark track: a second fresh participant completes Workshop I', async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  p2 = await identity(browser, P2);
  const { page } = p2;
  await openWorkshop(page, WS1);
  await page.getByRole('button', { name: 'Zaczynam w PySpark' }).click();
  await assertNothingPassedOrPrefilled(page, WS1, 'pyspark');
  await completeWorkshop(page, WS1, 'pyspark');
});

test('6. Workshop II in the SQL track; a step without PySpark variant shows the note', async () => {
  test.setTimeout(10 * 60_000);
  await setItem(trainer.page, 'Warsztat II — Delta Lake', true);
  const { page } = p1;
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Otwórz Warsztat II', exact: true })).toBeVisible({
    timeout: UNLOCK_WAIT,
  });
  await openWorkshop(page, WS2);
  await page.getByRole('button', { name: 'Zaczynam w SQL' }).click();
  await assertNothingPassedOrPrefilled(page, WS2, 'sql');
  await completeWorkshop(page, WS2, 'sql');

  // Switch to PySpark: a step that reuses SQL shows its note and the "SQL (obie ścieżki)" badge, still passed.
  await page.getByRole('group', { name: 'Ścieżka' }).getByRole('button', { name: 'PySpark' }).click();
  const shared = WS2.steps.findIndex((s) => resolveExercise(s, 'pyspark').fallback);
  expect(shared).toBeGreaterThanOrEqual(0);
  const { note } = resolveExercise(WS2.steps[shared], 'pyspark');
  await goToStep(page, shared);
  await expect(page.getByText('SQL (obie ścieżki)')).toBeVisible();
  const firstWords = (note ?? '').replace(/[`*]/g, '').split(' ').slice(0, 4).join(' ');
  await expect(page.locator('.wg-expected', { hasText: firstWords })).toBeVisible();
  await expect(liveTitle(page)).toHaveText('Zaliczone');
  await page.getByRole('group', { name: 'Ścieżka' }).getByRole('button', { name: 'SQL' }).click();
});

test('7. quiz: three questions, one wrong then right, explanation and progress', async () => {
  await setItem(trainer.page, 'III — Quiz', true);
  const { page } = p1;
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Otwórz quiz' })).toBeVisible({ timeout: UNLOCK_WAIT });
  await page.getByRole('button', { name: 'Otwórz quiz' }).click();
  await expect(page.locator('#quiz-question')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^Rozwiązane: 0 \/ \d+$/).first()).toBeVisible();
  const key = await quizKey();
  const options = page.locator('ul[aria-labelledby="quiz-question"] button');
  const feedback = page.locator('[role="status"] .wg-feedback');
  const answer = async (letter: string) => {
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/quiz/answer') && r.request().method() === 'POST', {
        timeout: 60_000,
      }),
      options
        .filter({ hasText: new RegExp(`^${letter}`) })
        .first()
        .click(),
    ]);
    expect(res.status()).toBeLessThan(300);
    return (await res.json()) as { correct?: boolean; is_correct?: boolean; status?: string };
  };
  let sawWrong = false;
  for (let n = 1; n <= 3; n++) {
    const qid = `q${String(n).padStart(2, '0')}`;
    await expect(page.locator('#quiz-question')).toContainText(`${n}.`);
    const letters = ['A', 'B', 'C', 'D'];
    // With the local key: a deliberately wrong option first on question 1. Without it: A, B, C, D in turn.
    const order = key
      ? n === 1
        ? [...letters.filter((l) => l !== key[qid]).slice(0, 1), key[qid]]
        : [key[qid]]
      : letters;
    for (const letter of order) {
      await answer(letter);
      const text = (await feedback.textContent({ timeout: 30_000 })) ?? '';
      if (text.startsWith('Dobrze!')) break;
      sawWrong = true;
      await expect(feedback).toContainText('Nie tym razem. Spróbuj ponownie.');
      await expect(options.filter({ hasText: new RegExp(`^${letter}`) }).first()).toBeDisabled();
    }
    await expect(feedback).toContainText('Dobrze!');
    await expect(feedback).toContainText('Gdzie się tego nauczyć:');
    expect(((await feedback.textContent()) ?? '').length).toBeGreaterThan(40); // explanation text from the server
    await expect(page.getByText(`Rozwiązane: ${n} / `, { exact: false }).first()).toBeVisible();
    if (n < 3) await page.getByRole('button', { name: 'Następne pytanie' }).click();
  }
  if (key) expect(sawWrong).toBe(true);
  // Persisted on the server: still 3 solved after a reload.
  await page.reload();
  await expect(page.getByText(/^Rozwiązane: 3 \/ \d+$/).first()).toBeVisible({ timeout: 30_000 });
});

test('8. trainer matrix shows both participants with their track badges', async () => {
  const { page } = trainer;
  await page.goto('/trainer');
  const row = (email: string) => page.getByRole('rowheader', { name: new RegExp(email.replace(/[.@-]/g, '\\$&')) });
  await expect(row(P1)).toBeVisible({ timeout: UNLOCK_WAIT });
  await expect(row(P2)).toBeVisible({ timeout: UNLOCK_WAIT });
  await expect(row(P1)).toContainText('SQL');
  await expect(row(P1)).not.toContainText('PySpark');
  await expect(row(P2)).toContainText('PySpark');
  const req = requiredCount(WS1);
  await expect(page.getByRole('row').filter({ has: row(P1) })).toContainText(`${req}/${req}`);
  await expect(page.getByRole('row').filter({ has: row(P2) })).toContainText(`${req}/${req}`);
});

test('9. reload keeps passed steps; EN switch in the middle of an exercise keeps typed answers', async () => {
  const { page } = p2;
  // P2 passed Workshop I: after a reload the state comes from the server.
  await page.goto('/?ws=ws_ingestion');
  await waitForProgress(page);
  await expect(counter(page, requiredCount(WS1), requiredCount(WS1))).toBeVisible();
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(WS1.steps.length);

  // Half-done fill in Workshop II (PySpark): one blank typed, then EN, then reload.
  await page.goto('/?ws=ws_delta');
  await page.getByRole('button', { name: 'Zaczynam w PySpark' }).click();
  const i = WS2.steps.findIndex((s) => {
    const ex = resolveExercise(s, 'pyspark').exercise;
    return ex?.type === 'fill' && Object.keys(ex.blanks).length >= 2 && !resolveExercise(s, 'pyspark').fallback;
  });
  await goToStep(page, i);
  const ex = resolveExercise(WS2.steps[i], 'pyspark').exercise;
  if (ex?.type !== 'fill') throw new Error('expected a fill step');
  const firstId = ex.template.match(/\{\{(b\d+)\}\}/)![1];
  const total = Object.keys(ex.blanks).length;
  await fillInputs(page).first().fill(ex.blanks[firstId].answers[0]);
  await expect(page.getByText(`Poprawne luki: 1 z ${total}`)).toBeVisible();

  await page.getByRole('group', { name: 'Język' }).getByRole('button', { name: 'EN' }).click();
  await expect(page.getByText(`1 of ${total} blanks correct`)).toBeVisible();
  await expect(fillInputs(page).first()).toHaveValue(ex.blanks[firstId].answers[0]);
  await expect(page.locator('#status-heading')).toHaveText('Not checked yet');
  await expect(page.getByRole('group', { name: 'Track' }).getByRole('button', { name: 'PySpark' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.reload();
  await expect(page.getByText(`1 of ${total} blanks correct`)).toBeVisible({ timeout: 30_000 });
  await expect(fillInputs(page).first()).toHaveValue(ex.blanks[firstId].answers[0]);
  // Finish it in English: it passes and the counter counts it.
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/progress') && r.request().method() === 'POST', {
    timeout: 90_000,
  });
  const ids = [...ex.template.matchAll(/\{\{(b\d+)\}\}/g)].map((m) => m[1]);
  for (let k = 1; k < ids.length; k++) await fillInputs(page).nth(k).fill(ex.blanks[ids[k]].answers[0]);
  const body = (await (await posted).json()) as { status: string };
  expect(body.status).toBe('pass');
  await expect(page.locator('#status-heading')).toHaveText('Passed');
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'PL' }).click();
  await expect(liveTitle(page)).toHaveText('Zaliczone');
});

test('10. Reset my progress clears the passed steps (UI and after reload)', async () => {
  const { page } = p1;
  await page.goto('/?ws=ws_ingestion');
  await waitForProgress(page);
  const req = requiredCount(WS1);
  await expect(counter(page, req, req)).toBeVisible();
  await page.getByRole('button', { name: 'Wyczyść moje postępy' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Wyczyść postępy' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
  await expect(counter(page, 0, req)).toBeVisible();
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(0);
  // Not brought back by a later poll, nor by a reload.
  await page.waitForTimeout(11_000);
  await expect(counter(page, 0, req)).toBeVisible();
  await page.reload();
  await waitForProgress(page);
  await expect(counter(page, 0, req)).toBeVisible();
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(0);
  await expect(liveTitle(page)).toHaveText('Jeszcze nie sprawdzono');
  // The other workshop is untouched.
  await page.goto('/?ws=ws_delta');
  await waitForProgress(page);
  await expect(counter(page, requiredCount(WS2), requiredCount(WS2))).toBeVisible();
});

/** localStorage keys of saved answers (fill / order / match) of one workshop for one identity. */
async function storedAnswerKeys(page: Page, email: string, workshop: string): Promise<string[]> {
  return page.evaluate(
    ({ prefix }) =>
      Object.keys(window.localStorage).filter((k) => k.startsWith(prefix) && /:(fill|order|match)$/.test(k)),
    { prefix: `wg:${email}:${workshop}:` }
  );
}

/** A step's exercise looks untouched: no green blank, no success line, no save button, empty answer. */
async function assertStepFresh(page: Page, ex: ReturnType<typeof resolveExercise>['exercise']) {
  await expect(liveTitle(page)).toHaveText('Jeszcze nie sprawdzono');
  if (ex?.type === 'fill') {
    const inputs = fillInputs(page);
    const n = await inputs.count();
    expect(n).toBeGreaterThan(0);
    for (let k = 0; k < n; k++) await expect(inputs.nth(k)).toHaveValue('');
    await expect(page.locator('.wg-blank-correct')).toHaveCount(0);
    await expect(page.getByText(/^(Wszystkie luki poprawne|Luka poprawna)/)).toHaveCount(0);
    await expect(page.getByText(`Poprawne luki: 0 z ${n}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zapisz wynik ponownie' })).toHaveCount(0);
  } else if (ex?.type === 'order') {
    await expect(answerList(page).getByRole('heading')).toHaveText('Twoje rozwiązanie (0)');
    await expect(page.locator('.wg-feedback')).toHaveCount(0);
  }
}

/**
 * The trainer's report: "I enter a workshop and steps already look passed although I did nothing".
 * Cause: the exercises restored answers saved in this browser (kept after Reset) and a fill step then
 * showed every blank green, "Wszystkie luki poprawne (N)." and "Zapisz wynik ponownie" without a
 * pass on the server. Reset now clears the saved answers.
 */
test('11. after Reset, no step looks solved and the saved answers are gone (trainer report)', async () => {
  const { page } = p1;
  await page.goto('/?ws=ws_ingestion');
  await waitForProgress(page);
  expect(await storedAnswerKeys(page, P1, 'ws_ingestion')).toEqual([]);
  await assertNothingPassedOrPrefilled(page, WS1, 'sql');
});

/**
 * The trainer's actual case: his rows disappeared on the server (no Reset in this browser), so the
 * browser still had his complete answers. A complete answer without a pass must start again.
 */
test('11b. rows deleted on the server: saved complete answers do not look solved', async () => {
  const { page } = p2;
  await page.goto('/?ws=ws_ingestion');
  await waitForProgress(page);
  const req = requiredCount(WS1);
  await expect(counter(page, req, req)).toBeVisible();
  const fillAt = WS1.steps.findIndex((s) => resolveExercise(s, 'pyspark').exercise?.type === 'fill');
  const orderAt = WS1.steps.findIndex((s) => resolveExercise(s, 'pyspark').exercise?.type === 'order');
  const fill = resolveExercise(WS1.steps[fillAt], 'pyspark').exercise;
  if (fill?.type !== 'fill') throw new Error('expected a fill step');
  // Passed: the saved answer is shown as solved (all blanks green).
  await goToStep(page, fillAt);
  await expect(liveTitle(page)).toHaveText('Zaliczone');
  await expect(page.locator('.wg-blank-correct')).toHaveCount(Object.keys(fill.blanks).length);
  expect((await storedAnswerKeys(page, P2, 'ws_ingestion')).length).toBeGreaterThan(0);

  deleteParticipantRows(P2, 'ws_ingestion');
  await page.reload();
  // The server cache may serve the old rows for a few seconds; reload until they are gone.
  await expect(async () => {
    await page.reload();
    await waitForProgress(page);
    await expect(counter(page, 0, req)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await goToStep(page, fillAt);
  await assertStepFresh(page, fill);
  await goToStep(page, orderAt);
  await assertStepFresh(page, resolveExercise(WS1.steps[orderAt], 'pyspark').exercise);
  await assertNothingPassedOrPrefilled(page, WS1, 'pyspark');
  // Solving it again records a new pass.
  await goToStep(page, fillAt);
  await solveFill(page, fill);
  await expect(liveTitle(page)).toHaveText('Zaliczone');
  await expect(counter(page, 1, req)).toBeVisible();
});

test('12. mobile 390x844 smoke: step sheet, track chooser, one step', async ({ browser }) => {
  const p3 = await identity(browser, P3, { width: 390, height: 844 });
  const { page } = p3;
  await openWorkshop(page, WS1);
  await expect(page.getByRole('button', { name: `Kroki (0/${requiredCount(WS1)})` })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Zaczynam w SQL' }).click();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW, 'no horizontal page scroll').toBeLessThanOrEqual(390);
  const i = WS1.steps.findIndex((s) => resolveExercise(s, 'sql').exercise?.type === 'fill');
  await page.getByRole('button', { name: /^Kroki \(/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('img', { name: 'Zaliczony' })).toHaveCount(0);
  await sheet.getByRole('listitem').nth(i).getByRole('button').click();
  await expect(sheet).toHaveCount(0);
  const ex = resolveExercise(WS1.steps[i], 'sql').exercise;
  if (ex?.type !== 'fill') throw new Error('expected fill');
  await solveFill(page, ex);
  await expect(liveTitle(page)).toHaveText('Zaliczone');
  await expect(
    page.getByRole('button', { name: `Kroki (${WS1.steps[i].optional ? 0 : 1}/${requiredCount(WS1)})` })
  ).toBeVisible();
  await p3.ctx.close();
});

test('13. Lock all hides content again: an open workshop shows the locked notice', async ({ browser }) => {
  const p4 = await identity(browser, P4);
  await openWorkshop(p4.page, WS1);
  await p4.page.getByRole('button', { name: 'Zaczynam w SQL' }).click();
  await expect(
    answerList(p4.page)
      .or(fillInputs(p4.page).first())
      .or(p4.page.getByRole('button', { name: 'Sprawdź pary' }))
      .first()
  ).toBeVisible();

  const { page } = trainer;
  await openAccess(page);
  await page.getByRole('button', { name: 'Zablokuj wszystko' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Zablokuj wszystko' }).click();
  for (const label of ['Warsztat I — Ingestion', 'Warsztat II — Delta Lake', 'III — Quiz']) {
    await expect(page.getByRole('switch', { name: `Odblokuj ${label} dla uczestników` })).toHaveAttribute(
      'aria-checked',
      'false',
      { timeout: 60_000 }
    );
  }

  await expect(p4.page.getByText('Zablokowane przez trenera')).toBeVisible({ timeout: UNLOCK_WAIT });
  await expect(p4.page.locator('#step-title')).toHaveCount(0);
  // The API answers 423 for the participant now.
  const res = await p4.page.request.get('/api/guides/ws_ingestion');
  expect(res.status()).toBe(423);
  await p4.page.goto('/');
  await expect(p4.page.getByText('Trener odblokuje to w odpowiednim momencie.')).toHaveCount(3);
  await p4.ctx.close();
});
