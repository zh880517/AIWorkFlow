// 属性面板的结构回归：首屏只露核心字段，低频配置收进折叠组，角色表不再占节点面板。
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SubagentNode } from '../../shared/src/types.js';
import { Inspector, type InspectorProps } from '../../plugins/aiworkflow/src/editor/inspector.js';
import type { CanvasNode } from '../../plugins/aiworkflow/src/editor/model.js';

const base: InspectorProps = {
  body: undefined,
  canvasNode: undefined,
  nodes: [],
  flows: [],
  agents: [],
  payloadFields: {},
  edges: [],
  isEntry: false,
  issues: [],
  onPatch: () => undefined,
  onDelete: () => undefined,
  onCondition: () => undefined,
  onWhen: () => undefined,
  onAgentsChange: () => undefined,
  onOpenSubflow: () => undefined,
  onSetEntry: () => undefined,
};

const render = (body: InspectorProps['body'], extra: Partial<InspectorProps> = {}): string =>
  renderToStaticMarkup(React.createElement(Inspector, { ...base, body, ...extra }));

describe('Inspector 信息分层', () => {
  const agent: SubagentNode = {
    id: 'n2',
    type: 'subagent',
    title: '评审',
    extraPrompt: '只读不写',
    mode: 'inline',
    role: 'review',
    thread: 'role',
    produces: ['design'],
    consumes: ['issues'],
  };

  it('子 Agent 首屏是附加指令 + 执行方式，角色表不在节点面板', () => {
    const html = render(agent, {
      agents: [{ id: 'review', name: '评审员', charter: '挑剔' }],
      edges: [{ id: 'e1', source: 'n2', target: 'n3', data: {} }],
    });
    expect(html).toContain('附加指令');
    expect(html).toContain('执行方式');
    expect(html).not.toContain('基本信息');
    expect(html).not.toContain('角色表（');
    // 已配置的角色/线程/产物在概览 chip 里直接可读
    expect(html).toContain('review · 线程 role');
    expect(html).toContain('design → issues');
  });

  it('高级配置默认折叠：折叠头在、输入控件与说明不在', () => {
    const html = render(agent, {
      agents: [{ id: 'review', name: '评审员', charter: '挑剔' }],
    });
    expect(html).toContain('角色与线程');
    expect(html).toContain('产物与汇报');
    expect(html).toContain('循环与逃生');
    // 折叠时 textarea 不挂载，说明文字也不占行
    expect(html).not.toContain('角色章程与线程摘要');
    expect(html).not.toContain('只用于校验与面板');
  });

  it('卡点不再有独立出口分支区，目标直接写在选项行里', () => {
    const html = render(
      {
        id: 'g1',
        type: 'gate',
        title: '验收',
        question: '可以合并吗？',
        options: [
          { id: 'o1', label: '通过' },
          { id: 'o2', label: '打回' },
        ],
      },
      { edges: [{ id: 'e1', source: 'g1', target: 'n3', data: { outlet: 'o1' } }] },
    );
    expect(html).toContain('人工卡点');
    expect(html).toContain('→ n3');
    expect(html).toContain('未连接');
    expect(html).not.toContain('出口分支');
  });

  it('汇聚节点的本步指令被引擎覆盖，未填时整组隐藏', () => {
    const html = render({
      id: 'j1',
      type: 'join',
      title: '汇总',
      aggregateInstruction: '汇总结果',
    });
    expect(html).toContain('汇聚');
    expect(html).not.toContain('补充说明');
    expect(html).not.toContain('本步指令');
  });

  it('汇聚节点填过本步指令时保留入口，避免旧数据不可见', () => {
    const html = render({
      id: 'j1',
      type: 'join',
      title: '汇总',
      aggregateInstruction: '汇总结果',
      instruction: '旧值',
    });
    expect(html).toContain('本步指令');
    expect(html).toContain('旧值');
  });

  it('结束节点没有循环/本步指令分组', () => {
    const html = render({ id: 'e1', type: 'end', title: '完成', outcome: 'success' });
    expect(html).toContain('结束');
    expect(html).not.toContain('循环与逃生');
    expect(html).not.toContain('本步指令');
  });

  it('校验问题贴在节点面板顶部', () => {
    const html = render(agent, {
      issues: [{ severity: 'error', code: 'E_NO_ENTRY', message: '入口缺失', nodeId: 'n2' }],
    });
    expect(html).toContain('1 个问题');
    expect(html).toContain('E_NO_ENTRY');
  });

  it('引用目标按流程 / 子 Agent 配置分组，且不再显示无效的附加指令', () => {
    const html = render(
      {
        id: 'n2',
        type: 'subagent',
        title: '评审',
        extraPrompt: '',
        mode: 'flowRef',
        flowRef: 'f_agent_profile',
      },
      {
        flows: [
          { id: 'f_main', name: '主流程', kind: 'flow', updatedAt: '' },
          { id: 'f_agent_profile', name: '评审配置', kind: 'agent', updatedAt: '' },
        ],
      },
    );
    expect(html).toContain('引用目标');
    expect(html).toContain('<optgroup label="子 Agent 配置">');
    expect(html).toContain('<optgroup label="流程">');
    expect(html).not.toContain('附加指令');
  });

  it('prompt 不再套一层同名区块标题', () => {
    const html = render({ id: 'n1', type: 'prompt', title: '开始', instruction: '读文档' });
    expect(html).toContain('指令');
    expect(html).not.toContain('wf-section-title">指令');
  });

  it('插值提示在没有历史 payload 时只说明一次，不按节点重复', () => {
    const canvas = (id: string): CanvasNode => ({
      id,
      type: 'wf',
      position: { x: 0, y: 0 },
      data: { title: id, kind: 'prompt', detail: '', isEntry: false, outlets: [] },
    });
    const html = render(
      { id: 'n1', type: 'prompt', title: '开始', instruction: '读文档' },
      { nodes: [canvas('n2'), canvas('n3')], payloadFields: {} },
    );
    expect(html.match(/这张图跑过一次后/g)?.length).toBe(1);
  });
});
