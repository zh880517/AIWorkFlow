// 「工作流」启动面板的列表口径：子 Agent 配置只能被主流程引用，不能单独启动（2026-10-29 用户反馈）。
import { describe, expect, it } from 'vitest';
import { startableFlows } from '../dsh-plugin/src/picker.js';

const at = '2026-10-29T12:00:00.000Z';

describe('启动工作流列表只留主流程', () => {
  it('过滤掉 kind=agent 的子 Agent 配置', () => {
    const flows = [
      { id: 'f_flow', name: '主流程', kind: 'flow' as const, updatedAt: at },
      { id: 'f_agent', name: '评审配置', kind: 'agent' as const, updatedAt: at },
    ];
    expect(startableFlows(flows).map((flow) => flow.id)).toEqual(['f_flow']);
  });

  it('缺 kind 的老数据按主流程保留，顺序不变', () => {
    const flows = [
      { id: 'f_a', name: 'A', updatedAt: at },
      { id: 'f_b', name: 'B', kind: 'agent' as const, updatedAt: at },
      { id: 'f_c', name: 'C', kind: 'flow' as const, updatedAt: at },
    ];
    expect(startableFlows(flows).map((flow) => flow.id)).toEqual(['f_a', 'f_c']);
  });

  it('全是配置时返回空列表（面板走空态，而不是显示配置）', () => {
    const flows = [{ id: 'f_only_agent', name: '只有配置', kind: 'agent' as const, updatedAt: at }];
    expect(startableFlows(flows)).toEqual([]);
  });
});
