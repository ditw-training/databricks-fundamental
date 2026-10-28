import { gradedBy, type Guide, type Step } from '../../shared/guide-schema';
import { type CheckPost, checkPostSchema } from '../../shared/check-schema';
import { type CheckContext, CheckFail, firstLine, type StepCheck } from './framework';
import { DELTA_CHECKS } from './ws_delta';
import { INGESTION_CHECKS } from './ws_ingestion';

/** Step checks per workshop id; every notebook-graded guide step needs one (tested). */
export const CHECKS: Record<string, Record<string, StepCheck>> = {
  ws_ingestion: INGESTION_CHECKS,
  ws_delta: DELTA_CHECKS,
};

export type CheckValidation =
  | {
      ok: true;
      post: CheckPost;
      step: Step;
      check: StepCheck;
      /**
       * True for the optional "Check on data" of an app-graded step (SPEC section 11): the result is
       * shown and stored as step_type 'data_check', which never changes the step's status. False
       * only for legacy free `code` steps, where Check is how the step is completed.
       */
      bonus: boolean;
    }
  | { ok: false; status: number; error: string };

/** Body of POST /api/check: known workshop and step that has a data check. */
export function validateCheckPost(body: unknown, guides: Map<string, Guide>): CheckValidation {
  const parsed = checkPostSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: 'Invalid body (fields: workshop, step)' };
  const post = parsed.data;
  const { workshop, step: stepId } = post;
  const guide = guides.get(workshop);
  if (!guide) return { ok: false, status: 404, error: `Unknown workshop "${workshop}"` };
  const step = guide.steps.find((s) => s.id === stepId);
  if (!step) return { ok: false, status: 404, error: `Unknown step "${stepId}" in ${workshop}` };
  const check = CHECKS[workshop]?.[stepId];
  if (!check) {
    return gradedBy(step) === 'notebook'
      ? { ok: false, status: 501, error: `No check is defined for ${workshop}/${stepId}` }
      : { ok: false, status: 409, error: `Step "${stepId}" has no data check; it is graded in the app` };
  }
  return { ok: true, post, step, check, bonus: gradedBy(step) === 'app' };
}

/**
 * Marks the steps that have a data check (`data_check`), so the app shows "Check on data" only
 * there. The flag in the guide file is ignored: CHECKS is the only source.
 */
export function markDataChecks(guides: Map<string, Guide>): Map<string, Guide> {
  for (const guide of guides.values()) {
    for (const step of guide.steps) step.data_check = Boolean(CHECKS[guide.id]?.[step.id]);
  }
  return guides;
}

export type CheckOutcome =
  | { kind: 'result'; status: 'pass' | 'fail'; message: string }
  /** Not the participant's fault (no access to the warehouse, token, ...): nothing is recorded. */
  | { kind: 'error'; error: string };

/** Errors that mean "the app cannot run SQL as you", not "your step is wrong". */
const ACCESS_ERROR =
  /PERMISSION_DENIED.*(warehouse|endpoint)|(warehouse|endpoint).*(PERMISSION_DENIED|permission)|CAN_USE|invalid (access )?token|unauthori[sz]ed|\b401\b|scope|insufficient_scope|Missing user token|user token/i;
/** Catalog of the participant missing or not visible. */
const CATALOG_ERROR = /NO_SUCH_CATALOG|CATALOG_NOT_FOUND|catalog .* (was )?not found|does not exist.*catalog/i;

/**
 * Runs one check. CheckFail -> FAIL with its message. A SQL error inside the participant's
 * catalog -> FAIL with the first line (like the notebook's "re-run the cells" message).
 * Access errors -> `error` (HTTP 502, not recorded).
 */
export async function runCheck(check: StepCheck, ctx: CheckContext): Promise<CheckOutcome> {
  try {
    const message = await check(ctx);
    return { kind: 'result', status: 'pass', message: message.slice(0, 200) };
  } catch (err) {
    if (err instanceof CheckFail) return { kind: 'result', status: 'fail', message: err.message.slice(0, 200) };
    const line = firstLine(err, 160);
    if (CATALOG_ERROR.test(line)) {
      return {
        kind: 'result',
        status: 'fail',
        message: `Catalog ${ctx.catalog} not found or not accessible. Run 00_setup in the notebook; if it fails, tell the trainer.`,
      };
    }
    if (ACCESS_ERROR.test(line)) return { kind: 'error', error: `The app could not run the check as you: ${line}` };
    return {
      kind: 'result',
      status: 'fail',
      message: `SQL error: ${firstLine(err, 120)}. Re-run the cells of this step, then Check again.`.slice(0, 200),
    };
  }
}
