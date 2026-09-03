import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowHistory } from '../src/web/history.js';
import type { Flow } from '../src/core/types.js';

function flowOf(name: string): Flow {
  return { id: 'f', name, entry: 'n1', nodes: [{ id: 'n1', type: 'prompt', instruction: name }] };
}

describe('FlowHistory 撤销/重做', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('基本撤销/重做往返', () => {
    const h = new FlowHistory();
    const s0 = flowOf('v0');
    const s1 = flowOf('v1');
    const s2 = flowOf('v2');
    h.push(s0);
    h.push(s1);
    expect(h.canUndo()).toBe(true);
    expect(h.canRedo()).toBe(false);

    expect(h.undo(s2)).toEqual(s1);
    expect(h.undo(s1)).toEqual(s0);
    expect(h.undo(s0)).toBeNull();

    expect(h.canRedo()).toBe(true);
    expect(h.redo(s0)).toEqual(s1);
    expect(h.redo(s1)).toEqual(s2);
    expect(h.redo(s2)).toBeNull();
  });

  it('新变更清空重做栈', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'));
    const afterUndo = h.undo(flowOf('v1'))!;
    expect(afterUndo).toEqual(flowOf('v0'));
    expect(h.canRedo()).toBe(true);
    // 撤销后产生新变更 → 重做栈清空
    h.push(flowOf('v0'));
    expect(h.canRedo()).toBe(false);
  });

  it('同 group 连续变更合并为一条历史（文本输入/拖动）', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'), 'cond:n1:b1');
    vi.advanceTimersByTime(100);
    h.push(flowOf('v1'), 'cond:n1:b1');
    vi.advanceTimersByTime(100);
    h.push(flowOf('v2'), 'cond:n1:b1');
    // 三次输入只留一条 → 一次撤销回到 v0
    expect(h.undo(flowOf('v3'))).toEqual(flowOf('v0'));
  });

  it('超过合并窗口的同 group 变更分开记录', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'), 'cond:n1:b1');
    vi.advanceTimersByTime(900);
    h.push(flowOf('v1'), 'cond:n1:b1');
    expect(h.undo(flowOf('v2'))).toEqual(flowOf('v1'));
    expect(h.undo(flowOf('v1'))).toEqual(flowOf('v0'));
  });

  it('不同 group 不合并', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'), 'a');
    h.push(flowOf('v1'), 'b');
    expect(h.undo(flowOf('v2'))).toEqual(flowOf('v1'));
    expect(h.undo(flowOf('v1'))).toEqual(flowOf('v0'));
  });

  it('无 group 的结构变更每次都记录', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'));
    h.push(flowOf('v1'));
    expect(h.undo(flowOf('v2'))).toEqual(flowOf('v1'));
    expect(h.undo(flowOf('v1'))).toEqual(flowOf('v0'));
  });

  it('reset 清空全部历史', () => {
    const h = new FlowHistory();
    h.push(flowOf('v0'));
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo(flowOf('v1'))).toBeNull();
  });

  it('历史深度上限 100', () => {
    const h = new FlowHistory();
    for (let i = 0; i < 120; i++) h.push(flowOf(`v${i}`));
    let count = 0;
    let cur = flowOf('latest');
    let prev = h.undo(cur);
    while (prev !== null) {
      cur = prev;
      count += 1;
      prev = h.undo(cur);
    }
    expect(count).toBe(100);
  });
});
