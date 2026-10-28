/**
 * Guide data and UI drivers. Answers come from the guide solutions in config/guides (with the
 * Polish overlay, as the UI shows them); every action goes through the real UI.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Browser, type BrowserContext, type Locator, type Page, type Response } from '@playwright/test';
import { localizeGuide } from '../../shared/guide-i18n';
import {
  resolveExercise,
  type FillVariant,
  type Guide,
  type MatchVariant,
  type OrderVariant,
  type Step,
  type Track,
} from '../../shared/guide-schema';
import { loadGuides, loadOverlays } from '../../server/guides';
import { parseTemplate } from '../../client/src/lib/exercise';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUIDES_DIR = path.join(APP_DIR, 'config', 'guides');

const guides = loadGuides(GUIDES_DIR);
const overlays = loadOverlays(guides, GUIDES_DIR, () => {});

export function guidePl(id: string): Guide {
  const g = guides.get(id);
  if (!g) throw new Error(`no guide ${id}`);
  return localizeGuide(g, overlays.pl?.[id], 'pl');
}

export const requiredCount = (g: Guide) => g.steps.filter((s) => !s.optional).length;

/** One browser context per identity: own storage, identity via the header Databricks Apps sets. */
export async function identity(
  browser: Browser,
  email: string,
  viewport = { width: 1440, height: 900 }
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-Email': email }, viewport, locale: 'pl-PL' });
  const page = await ctx.newPage();
  return { ctx, page };
}

// ── workshop view ──

export const stepNav = (page: Page) => page.getByRole('navigation', { name: 'Kroki warsztatu' }).first();
export const stepItem = (page: Page, index: number) => stepNav(page).getByRole('listitem').nth(index);
export const counter = (page: Page, passed: number, total: number) =>
  stepNav(page).getByText(`Zaliczone kroki: ${passed} / ${total}`);
export const liveTitle = (page: Page) => page.locator('#status-heading');

export async function openWorkshop(page: Page, guide: Guide) {
  await page.goto('/');
  await page.getByRole('button', { name: `Otwórz Warsztat ${guide.number === 1 ? 'I' : 'II'}`, exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: new RegExp(`^Warsztat ${guide.number === 1 ? 'I' : 'II'} — `) })
  ).toBeVisible();
}

/** Waits until the first progress poll answered (the step list no longer says "loading"). */
export async function waitForProgress(page: Page) {
  await expect(stepNav(page).getByText(/^Na żywo · odświeżono/)).toBeVisible({ timeout: 30_000 });
}

export async function goToStep(page: Page, index: number) {
  await stepItem(page, index).getByRole('button').click();
  await expect(page.getByText(`Krok ${String(index + 1).padStart(2, '0')}`, { exact: true })).toBeVisible();
}

/** Asserts that no step shows as passed and the exercise of every step starts empty. */
export async function assertNothingPassedOrPrefilled(page: Page, guide: Guide, track: Track) {
  await waitForProgress(page);
  await expect(counter(page, 0, requiredCount(guide))).toBeVisible();
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(0);
  await expect(stepNav(page).getByRole('img', { name: 'Nierozpoczęty' })).toHaveCount(guide.steps.length);
  for (let i = 0; i < guide.steps.length; i++) {
    await goToStep(page, i);
    await expect(liveTitle(page)).toHaveText('Jeszcze nie sprawdzono');
    await expect(page.getByText('Brak zapisanego wyniku')).toBeVisible();
    const ex = resolveExercise(guide.steps[i], track).exercise;
    if (ex?.type === 'fill') {
      const inputs = fillInputs(page);
      const n = await inputs.count();
      expect(n).toBeGreaterThan(0);
      for (let k = 0; k < n; k++) await expect(inputs.nth(k)).toHaveValue('');
      await expect(page.locator('.wg-blank-correct')).toHaveCount(0);
      await expect(page.getByText(/^(Wszystkie luki poprawne|Luka poprawna)/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Zapisz wynik ponownie' })).toHaveCount(0);
    } else if (ex?.type === 'order') {
      await expect(answerList(page).getByRole('heading')).toHaveText('Twoje rozwiązanie (0)');
      await expect(page.locator('.wg-feedback')).toHaveCount(0);
    } else if (ex?.type === 'match') {
      await expect(termBank(page).getByRole('button')).toHaveCount(ex.pairs.length);
      await expect(page.locator('.wg-feedback')).toHaveCount(0);
    }
  }
}

// ── exercises ──

// By class, not by the group's label: the label changes with the language (test 9 switches to EN).
export const fillInputs = (page: Page) => page.locator('pre.wg-fill-code input.wg-blank');
const poolList = (page: Page) => page.getByRole('region', { name: 'Dostępne bloki' });
export const answerList = (page: Page) => page.getByRole('region', { name: 'Twoje rozwiązanie' });
const termBank = (page: Page) => page.getByRole('group', { name: 'Pojęcia', exact: true });

const isProgressPost = (r: Response) => r.url().endsWith('/api/progress') && r.request().method() === 'POST';

/** Runs `action`, waits for the server's grade of the answer and returns it. */
async function graded(
  page: Page,
  action: () => Promise<void>
): Promise<{ status: string; message: string; track: string }> {
  const [res] = await Promise.all([page.waitForResponse(isProgressPost, { timeout: 90_000 }), action()]);
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { status: string; message: string; track: string };
}

function blankIds(ex: FillVariant): string[] {
  return parseTemplate(ex.template).flatMap((s) => (s.kind === 'blank' ? [s.id] : []));
}

export async function solveFill(page: Page, ex: FillVariant, { wrongFirst = false } = {}) {
  const inputs = fillInputs(page);
  const ids = blankIds(ex);
  await expect(inputs).toHaveCount(ids.length);
  if (wrongFirst) {
    // A wrong answer is never recorded: no POST, the blank turns red, the step stays "not checked".
    let posted = false;
    const spy = (r: Response) => isProgressPost(r) && (posted = true);
    page.on('response', spy);
    await inputs.first().fill('zzz_wrong_answer');
    await inputs.first().press('Tab');
    await expect(inputs.first()).toHaveClass(/wg-blank-wrong/);
    await expect(inputs.first()).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/Czerwona luka to jeszcze nie ta odpowiedź/)).toBeVisible();
    await expect(liveTitle(page)).toHaveText('Jeszcze nie sprawdzono');
    await page.waitForTimeout(500);
    page.off('response', spy);
    expect(posted, 'a wrong fill must not be posted').toBe(false);
  }
  const res = await graded(page, async () => {
    for (let k = 0; k < ids.length; k++) await inputs.nth(k).fill(ex.blanks[ids[k]].answers[0]);
  });
  expect(res.status, res.message).toBe('pass');
  await expect(page.locator('.wg-blank-correct')).toHaveCount(ids.length);
}

/** Adds blocks to "Your solution" with the + buttons (the keyboard / button fallback of drag and drop). */
async function addBlocks(page: Page, ex: OrderVariant, ids: string[]) {
  for (const id of ids) {
    const code = ex.blocks.find((b) => b.id === id)?.code;
    if (code === undefined) throw new Error(`no block ${id}`);
    const codes = await poolList(page).locator('code.wg-block-code').allTextContents();
    const at = codes.indexOf(code);
    expect(at, `block ${id} in the pool`).toBeGreaterThanOrEqual(0);
    await poolList(page)
      .getByRole('listitem')
      .nth(at)
      .getByRole('button', { name: /^Dodaj do rozwiązania:/ })
      .click();
  }
}

export async function solveOrder(page: Page, ex: OrderVariant, { wrongFirst = false } = {}) {
  const check = page.getByRole('button', { name: 'Sprawdź kolejność' });
  if (wrongFirst) {
    const wrong = [...ex.solution].reverse();
    await addBlocks(page, ex, wrong);
    const res = await graded(page, () => check.click());
    expect(res.status, res.message).toBe('fail');
    await expect(page.locator('.wg-feedback-fail')).toContainText('Bloki na właściwym miejscu');
    await expect(liveTitle(page)).toHaveText('Jeszcze nie, przeczytaj komunikat');
    await page.getByRole('button', { name: 'Wyczyść', exact: true }).click();
    await expect(answerList(page).getByRole('heading')).toHaveText('Twoje rozwiązanie (0)');
  }
  // Add the first two blocks swapped, then put them right with "Przesuń w górę" (↑).
  const sol = ex.solution;
  if (sol.length >= 2) {
    await addBlocks(page, ex, [sol[1], sol[0], ...sol.slice(2)]);
    await answerList(page)
      .getByRole('listitem')
      .nth(1)
      .getByRole('button', { name: /^Przesuń w górę:/ })
      .click();
  } else {
    await addBlocks(page, ex, sol);
  }
  const res = await graded(page, () => check.click());
  expect(res.status, res.message).toBe('pass');
  await expect(page.locator('.wg-feedback-pass')).toContainText('Dobra kolejność');
}

export async function solveMatch(page: Page, ex: MatchVariant) {
  for (const pair of ex.pairs) {
    await termBank(page).getByRole('button', { name: pair.left, exact: true }).click();
    await page.getByRole('button', { name: `Umieść wybrane pojęcie przy opisie: ${pair.right}`, exact: true }).click();
  }
  const res = await graded(page, () => page.getByRole('button', { name: 'Sprawdź pary' }).click());
  expect(res.status, res.message).toBe('pass');
  await expect(page.locator('.wg-feedback-pass')).toContainText('Wszystkie pary połączone dobrze');
}

/**
 * Completes every step of the workshop in `track` through the UI. A wrong answer goes first on the
 * first fill step and the first order step. After each step: passed status, green dot, counter.
 */
export async function completeWorkshop(page: Page, guide: Guide, track: Track) {
  const required = requiredCount(guide);
  let passedRequired = 0;
  let passedOptional = 0;
  let wrongFill = false;
  let wrongOrder = false;
  for (let i = 0; i < guide.steps.length; i++) {
    const step: Step = guide.steps[i];
    await goToStep(page, i);
    const { exercise } = resolveExercise(step, track);
    if (!exercise) throw new Error(`step ${step.id} has no app exercise`);
    if (exercise.type === 'fill') {
      await solveFill(page, exercise, { wrongFirst: !wrongFill });
      wrongFill = true;
    } else if (exercise.type === 'order') {
      await solveOrder(page, exercise, { wrongFirst: !wrongOrder });
      wrongOrder = true;
    } else {
      await solveMatch(page, exercise);
    }
    if (step.optional) passedOptional++;
    else passedRequired++;
    await expect(liveTitle(page)).toHaveText('Zaliczone');
    await expect(page.getByText(`zaliczone w: ${track === 'sql' ? 'SQL' : 'PySpark'}`)).toBeVisible();
    await expect(stepItem(page, i).getByRole('img', { name: 'Zaliczony' })).toBeVisible();
    await expect(counter(page, passedRequired, required)).toBeVisible();
    if (passedOptional > 0) {
      await expect(stepNav(page).getByText(`+${passedOptional} opcjonaln`, { exact: false })).toBeVisible();
    }
  }
  await expect(stepNav(page).getByRole('img', { name: 'Zaliczony' })).toHaveCount(guide.steps.length);
}

// ── quiz key (optional, local only) ──

/** Correct options from the trainer's local quiz source (`utilization/en/quiz.md`, gitignored), if present. */
export async function quizKey(): Promise<Record<string, string> | null> {
  const md = path.resolve(APP_DIR, '..', '..', 'utilization', 'en', 'quiz.md');
  if (!existsSync(md)) return null;
  // @ts-expect-error plain .mjs script without types
  const { parseQuizMarkdown } = (await import('../../scripts/quiz-from-md.mjs')) as {
    parseQuizMarkdown: (text: string, file: string) => { answers: Record<string, string> };
  };
  return parseQuizMarkdown(readFileSync(md, 'utf8'), md).answers;
}

export type { Locator };
