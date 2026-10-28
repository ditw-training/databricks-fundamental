import { useEffect, useState } from 'react';
import type { CheckPost, CheckResponse, ResetResponse } from '../../../shared/check-schema';
import type { GuidesResponse, MeResponse, ProgressPostInput, ProgressPostResponse } from '../../../shared/guide-schema';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/**
 * GET once, and again whenever `refreshKey` changes. A refetch keeps the previous data on
 * screen (no loading state) and keeps it when the refetch fails.
 */
function useJson<T>(url: string, refreshKey = ''): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    getJson<T>(url)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState((prev) =>
            prev.data ? { ...prev, loading: false } : { data: null, loading: false, error: (err as Error).message }
          )
      );
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey]);
  return state;
}

export const useMe = () => useJson<MeResponse>('/api/me');
/** Guides the viewer may open plus metadata of locked ones; refetched when the unlock state changes. */
export const useGuides = (unlockSignature: string) => useJson<GuidesResponse>('/api/guides', unlockSignature);

async function sendJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** Sends the participant's answer; the server grades it and records the result (POST /api/progress). */
export const postProgress = (body: ProgressPostInput) =>
  sendJson<ProgressPostResponse>('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Runs the step's check on the SQL warehouse as the signed-in user (POST /api/check). */
export const postCheck = (body: CheckPost) =>
  sendJson<CheckResponse>('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Deletes the signed-in user's progress rows of one workshop. */
export const resetMyProgress = (workshop: string) =>
  sendJson<ResetResponse>(`/api/progress/me?workshop=${encodeURIComponent(workshop)}`, { method: 'DELETE' });

/** Copies text; falls back to a hidden textarea when the Clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
