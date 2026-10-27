/**
 * Per-browser conveniences (typed blanks, revealed hints, attempt counters, theme).
 * Storage can be unavailable (private mode, blocked site data): every access is
 * guarded and the app works without it.
 */
import { useCallback, useState } from 'react';

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep the value in memory only */
  }
}

/** useState mirrored to localStorage under `key`. */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writeStored(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, update] as const;
}

export const stepKey = (email: string, workshop: string, step: string, what: string) =>
  `wg:${email}:${workshop}:${step}:${what}`;

/** Removes stored values whose key starts with `prefix` and ends with one of `suffixes`. */
export function clearStoredPrefix(prefix: string, suffixes: string[]): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(prefix) && suffixes.some((s) => k.endsWith(s))) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}
