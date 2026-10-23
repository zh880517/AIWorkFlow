// 稳定序列化 + 内容寻址 hash：快照去重的基础
import crypto from 'node:crypto';

/** 按键排序的 JSON 序列化，保证同内容同串 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

export function contentHash(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}
