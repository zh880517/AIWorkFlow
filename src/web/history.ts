import type { Flow } from '../core/types.js';

/** 同组变更的合并窗口（毫秒）：连续文本输入 / 拖动的每个中间态合并为一条历史 */
const COALESCE_MS = 800;

/**
 * 撤销/重做历史（快照式）。
 * push 记录变更前的状态；带 group 的连续变更（间隔小于合并窗口）只记第一条，
 * 使"输入一段文字"或"拖动一个节点"整体是一次撤销单位。新变更会清空重做栈。
 */
export class FlowHistory {
  private undoStack: Flow[] = [];
  private redoStack: Flow[] = [];
  private lastGroup: { group: string; time: number } | null = null;

  push(state: Flow, group?: string): void {
    const now = Date.now();
    if (
      group !== undefined &&
      this.lastGroup !== null &&
      this.lastGroup.group === group &&
      now - this.lastGroup.time < COALESCE_MS
    ) {
      this.lastGroup.time = now;
      return;
    }
    this.undoStack.push(state);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    this.lastGroup = group !== undefined ? { group, time: now } : null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** 撤销：返回应恢复的状态；无可撤销返回 null */
  undo(current: Flow): Flow | null {
    const prev = this.undoStack.pop();
    if (prev === undefined) return null;
    this.redoStack.push(current);
    this.lastGroup = null;
    return prev;
  }

  /** 重做：返回应恢复的状态；无可重做返回 null */
  redo(current: Flow): Flow | null {
    const next = this.redoStack.pop();
    if (next === undefined) return null;
    this.undoStack.push(current);
    this.lastGroup = null;
    return next;
  }

  /** 加载/新建/删除流程时清空历史 */
  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastGroup = null;
  }
}
