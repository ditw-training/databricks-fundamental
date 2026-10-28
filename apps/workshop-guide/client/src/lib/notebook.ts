/** Code shown in the "Notebook (optional)" section of a step (SPEC section 11). */

/** `<catalog>`, `<safe version>`, ...: parts the participant replaces before running. */
const PLACEHOLDER = /<[a-z][a-z0-9 _-]*>/gi;

/**
 * Code to paste into the notebook: the participant's completed code, then the save lines for the
 * data check (unless the code already has them); a `%sql` line first for the SQL track.
 */
export function notebookCode(code: string, sql: boolean, save: string | null | undefined): string {
  const firstSave = save?.split('\n').find((l) => l.trim() && !/^\s*(--|#)/.test(l))?.trim();
  const withSave = save && firstSave && !code.includes(firstSave) ? `${code.trimEnd()}\n\n${save}` : code;
  return sql ? `%sql\n${withSave}` : withSave;
}

export const placeholders = (code: string) => [...new Set(code.match(PLACEHOLDER) ?? [])];
