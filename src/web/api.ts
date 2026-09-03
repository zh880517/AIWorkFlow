import type { Flow } from '../core/types.js';

export interface FlowMeta {
  id: string;
  name: string;
  updatedAt: string;
}

export interface SaveOk {
  ok: true;
  warnings: unknown[];
}

export interface SaveRejected {
  ok: false;
  errors: Array<{ code: string; message: string; nodeId?: string }>;
  warnings: Array<{ code: string; message: string; nodeId?: string }>;
}

const token = new URLSearchParams(window.location.search).get('k') ?? '';

export function hasToken(): boolean {
  return token !== '';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`/api${path}${sep}k=${encodeURIComponent(token)}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(`API ${res.status}`), { status: res.status, body });
  }
  return body as T;
}

export const listFlows = (): Promise<FlowMeta[]> => req<FlowMeta[]>('/flows');

export const getFlow = (id: string): Promise<Flow> => req<Flow>(`/flows/${encodeURIComponent(id)}`);

export const saveFlow = (flow: Flow): Promise<SaveOk | SaveRejected> =>
  req<SaveOk | SaveRejected>(`/flows/${encodeURIComponent(flow.id)}`, {
    method: 'PUT',
    body: JSON.stringify(flow),
  });

export const deleteFlow = (id: string): Promise<{ ok: true }> =>
  req<{ ok: true }>(`/flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
