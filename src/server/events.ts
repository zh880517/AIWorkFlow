// SSE 事件总线：engine.onEvent → 广播给 /api/events 的面板连接（§9.3：SSE 不用 WebSocket）。
// 面板的写操作（回答卡点、废弃 run）走普通 POST，不走这条通道。
import type { EngineEvent } from '../core/engine.js';

export interface EventBus {
  subscribe(listener: (event: EngineEvent) => void): () => void;
  broadcast(event: EngineEvent): void;
}

export function createEventBus(): EventBus {
  const listeners = new Set<(event: EngineEvent) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    broadcast(event) {
      for (const listener of listeners) listener(event);
    },
  };
}
