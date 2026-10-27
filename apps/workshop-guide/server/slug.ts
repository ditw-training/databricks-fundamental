/**
 * Participant catalog from the e-mail. Must stay identical to user_slug_for() in
 * notebooks/setup/00_setup.ipynb (shared block with 00_pre_config).
 */

export const CATALOG_PREFIX = 'retailhub';

/** E-mail -> catalog suffix. Example: Jan.Kowalski@example.com -> jan_kowalski. */
export function userSlugFor(email: string, trainerAccounts: Iterable<string> = []): string {
  const normalized = email.trim().toLowerCase();
  const login = normalized.split('@')[0];
  const trainers = new Set([...trainerAccounts].map((a) => a.trim().toLowerCase()));
  if (trainers.has(normalized) || trainers.has(login)) return 'trainer';
  let slug = login.replace(/[^a-z0-9]/g, '_');
  slug = slug.replace(/_+/g, '_');
  slug = slug.replace(/^[0-9_]+/, ''); // a catalog name must not start with a digit
  return slug.replace(/^_+|_+$/g, '') || 'user';
}

/** retailhub_<slug>; only [a-z0-9_], so it is safe to put into SQL as an identifier. */
export const catalogFor = (email: string, trainerAccounts: Iterable<string> = []): string =>
  `${CATALOG_PREFIX}_${userSlugFor(email, trainerAccounts)}`;
