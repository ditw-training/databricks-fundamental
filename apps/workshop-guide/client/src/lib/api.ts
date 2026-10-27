import { useEffect, useState } from 'react';
import type { CheckPost, CheckResponse, ResetResponse } from '../../../shared/check-schema';
import type { GuidesResponse, MeResponse, ProgressPost } from '../../../shared/guide-schema';

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

function useJson<T>(url: string): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    getJson<T>(url)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => !cancelled && setState({ data: null, loading: false, error: (err as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

export const useMe = () => useJson<MeResponse>('/api/me');
export const useGuides = () => useJson<GuidesResponse>('/api/guides');

export async function postProgress(body: ProgressPost): Promise<void> {
  const res = await fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = ((await res.json()) as { error?: string }).error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
}

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
