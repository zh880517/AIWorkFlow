// 图编辑的数据访问：走插件 Host 半的 /aiworkflow/flows 路由（同源或 CORS 放行）。
import type { Flow, FlowKind } from '@shared/index.js';
import { resolveEndpoint } from '../endpoint.js';

export interface FlowMeta {
  id: string;
  name: string;
  /** flow（缺省）= 主流程；agent = 子 Agent 配置 */
  kind: FlowKind;
  updatedAt: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  nodeId?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface SaveRejected {
  ok: false;
  errors: Array<{ code: string; message: string; nodeId?: string }>;
  warnings: Array<{ code: string; message: string; nodeId?: string }>;
}

export interface SaveOk {
  ok: true;
  flow: Flow;
  warnings: Array<{ code: string; message: string; nodeId?: string }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveEndpoint(`aiworkflow/${path}`);
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (body === null || typeof body !== 'object') throw new Error(`HTTP ${response.status}`);
  return body as T;
}

export async function listFlows(kind?: FlowKind): Promise<FlowMeta[]> {
  const path = kind === undefined ? 'flows' : `flows?kind=${kind}`;
  const body = await request<{ ok: true; flows: FlowMeta[] }>(path);
  return body.flows;
}

export async function getFlow(id: string): Promise<Flow> {
  const body = await request<{ ok: true; flow: Flow }>(`flows/${encodeURIComponent(id)}`);
  return body.flow;
}

export function saveFlow(flow: Flow): Promise<SaveOk | SaveRejected> {
  return request<SaveOk | SaveRejected>(`flows/${encodeURIComponent(flow.id)}`, {
    method: 'PUT',
    body: JSON.stringify(flow),
  });
}

export function deleteFlow(id: string): Promise<{ ok: true; deleted: boolean }> {
  return request<{ ok: true; deleted: boolean }>(`flows/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** 干跑校验：与保存用同一个 validateFlow，不落库 */
export async function validateFlow(flow: Flow): Promise<ValidationResult> {
  const body = await request<{ ok: true; result: ValidationResult }>('flows/validate', {
    method: 'POST',
    body: JSON.stringify(flow),
  });
  return body.result;
}

/** 该图历史 run 里出现过的 payload 字段名（插值提示用） */
export async function payloadFields(id: string): Promise<Record<string, string[]>> {
  const body = await request<{ ok: true; fields: Record<string, string[]> }>(
    `flows/${encodeURIComponent(id)}/payload-fields`,
  );
  return body.fields;
}
