// 插件文案：注册到客户端的 locale 服务；宿主语言切换后立即生效。
import type { RunPhase } from '@shared/index.js';

const NS = 'aiworkflow-progress';

export interface Translate {
  (key: string): string;
}

const ZH: Record<string, string> = {
  'btn.open': '打开 aiworkflow 执行进度',
  title: '执行进度',
  idle: '工作流',
  'phase.running': '进行中',
  'phase.gate': '等确认',
  'phase.children': '等子 Agent',
  'phase.finished': '已完成',
  'phase.failed': '失败',
  'phase.stale': '停滞',
  steps: '步',
  'hero.current': '当前步骤',
  'hero.last': '最后一步',
  'hero.steps': '已走步数',
  'hero.elapsed': '用时',
  'hero.started': '开始',
  path: '已走路径',
  trace: '执行轨迹',
  'trace.empty': '还没有执行记录',
  'gate.title': '等待人工确认',
  'gate.hint': '在对话里回复选项后，这里会自动继续。',
  loading: '读取中…',
  'empty.noDb': '还没有 aiworkflow 数据',
  'empty.noDbHint': '先在「可视化工作流」里新建并保存一张图，这里会自动出现正在执行的流程。',
  'empty.noRuns': '还没有 run',
  'empty.noRunsHint': '等主 Agent 领取第一步后，进度就会出现在这里。',
  'empty.dbPath': '数据库',
  'empty.error': '读取失败',
  'run.active': '进行中',
  'run.recent': '最近',
  'run.select': '切换 run',
  'foot.updated': '更新于',
  nodes: '个节点',
  'payload.hint': '点击查看 payload',
  'panel.label': '可视化工作流',
  'panel.runs': '运行图',
  'panel.abandon': '放弃',
};

const EN: Record<string, string> = {
  'btn.open': 'Open aiworkflow progress',
  title: 'Run progress',
  idle: 'Workflow',
  'phase.running': 'Running',
  'phase.gate': 'Needs input',
  'phase.children': 'Waiting',
  'phase.finished': 'Done',
  'phase.failed': 'Failed',
  'phase.stale': 'Stalled',
  steps: ' steps',
  'hero.current': 'Current step',
  'hero.last': 'Last step',
  'hero.steps': 'Steps',
  'hero.elapsed': 'Elapsed',
  'hero.started': 'Started',
  path: 'Path so far',
  trace: 'Trace',
  'trace.empty': 'No executions yet',
  'gate.title': 'Waiting for a decision',
  'gate.hint': 'Reply with an option in the conversation; this view follows automatically.',
  loading: 'Loading…',
  'empty.noDb': 'No aiworkflow data yet',
  'empty.noDbHint': 'Create and save a flow in Visual Workflows and this view starts following the run.',
  'empty.noRuns': 'No runs yet',
  'empty.noRunsHint': 'Progress appears here once the main agent claims its first step.',
  'empty.dbPath': 'Database',
  'empty.error': 'Read failed',
  'run.active': 'Running',
  'run.recent': 'Recent',
  'run.select': 'Switch run',
  'foot.updated': 'Updated',
  nodes: ' nodes',
  'payload.hint': 'Click to inspect the payload',
  'panel.label': 'Visual workflows',
  'panel.runs': 'Run graph',
  'panel.abandon': 'Abandon',
};

export function phaseKey(phase: RunPhase): string {
  return `phase.${phase}`;
}

export function registerTexts(ctx: any): () => void {
  const disposers: Array<() => void> = [];
  const packs: Array<[string, Record<string, string>]> = [
    ['en', EN],
    ['zh', ZH],
    ['zh-CN', ZH],
    ['zh-Hans', ZH],
  ];
  for (const [locale, dict] of packs) {
    try {
      const dispose = ctx.locale.register(NS, locale, dict);
      if (typeof dispose === 'function') disposers.push(dispose);
    } catch {
      // 已注册或不支持的标签：忽略，其余 locale 继续
    }
  }
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // 忽略重复释放
      }
    }
  };
}

export function bindTranslate(ctx: any): Translate {
  const raw = ctx.locale.bind(NS) as (key: string) => string;
  return (key: string): string => {
    const value = raw(key);
    // 当前语言缺少该键时退回中文，而不是把 key 直接甩给用户
    return value === key ? (ZH[key] ?? key) : value;
  };
}
