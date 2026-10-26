// 生成 DSH 插件市场索引（format 1）：把当前 HEAD 的 dsh-plugin/ 目录登记成一个可安装版本。
//
// 用法：npm run market:plugin
// 顺序很重要：先 npm run build:plugin → 提交 index.js/client.js → 再跑本脚本 → 提交 market/index.json，
// 这样索引里的 commit 一定包含构建产物，别人安装时不需要在本机构建。
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const pkgDir = path.resolve(here, '..');
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

function git(...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

const commit = git('rev-parse', 'HEAD');
const commitTime = Number(git('show', '-s', '--format=%ct', 'HEAD'));

/** origin 可能是 git@github.com:user/repo.git 或 https://github.com/user/repo.git */
function repositoryUrl() {
  const remote = git('remote', 'get-url', 'origin');
  const https = remote
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '');
  return https;
}

const url = repositoryUrl();
// 索引放在 <repo>/dsh-plugin/market/index.json：图标用相对路径，读索引时按索引 URL 解析
const index = {
  format: 1,
  title: {
    en: 'aiworkflow for DeepSeek Harness',
    zh: 'aiworkflow 工作流插件',
  },
  description: {
    en: 'Flowchart-driven agent workflows inside DSH: progress pill, floating panel, run graph, and a visual flow editor.',
    zh: '在 DSH 里跑流程图驱动的 Agent 工作流：进度胶囊、浮动画板、运行图，以及可视化流程编辑器。',
  },
  plugins: [
    {
      name: pkg.name,
      title: {
        en: 'aiworkflow',
        zh: 'AI 工作流',
      },
      description: {
        en: 'Run aiworkflow flows in a DSH session, watch the run graph, and edit flows on a canvas.',
        zh: '在 DSH 会话里发起 aiworkflow 流程、查看运行图，并在画布上编辑流程图。',
      },
      icon: '../icon.svg',
      author: 'zh880517',
      homepage: url,
      repository: { url, directory: 'dsh-plugin' },
      metadata: {
        keywords: ['workflow', 'flowchart', 'agent', 'dsh', 'editor'],
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: commitTime,
          source: {
            type: 'git',
            url,
            commit,
            path: 'dsh-plugin',
          },
        },
      ],
    },
  ],
};

const out = path.join(here, 'index.json');
writeFileSync(out, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

const spec = `git+${url}.git#${commit}&path:/dsh-plugin`;
console.log(`已写入 ${path.relative(repo, out)}`);
console.log(`  ${pkg.name}@${pkg.version} @ ${commit.slice(0, 7)}`);
console.log(`安装 spec: ${spec}`);
