// 构建脚本：把 shared/ 和 dsh-plugin/src 打成两个自包含产物。
//   index.js  —— Host 半，Node ESM，只外置 node: 内建模块
//   client.js —— Client 半，套上宿主的 __ModuleLoader__ 懒加载 factory 外壳
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const sharedSrc = path.join(repo, 'shared', 'src');
const work = path.join(here, '.build');

const pkg = JSON.parse(await readFile(path.join(here, 'package.json'), 'utf8'));

const sharedAlias = [
  // 第三方预编译包自带 jsx-runtime 会引入第二份 React 身份（React #31），改接到宿主 React
  { find: /^react\/jsx-runtime$/, replacement: path.join(here, 'src', 'jsx-runtime-shim.ts') },
  { find: /^react\/jsx-dev-runtime$/, replacement: path.join(here, 'src', 'jsx-runtime-shim.ts') },
  { find: /^@shared\/index\.js$/, replacement: path.join(sharedSrc, 'index.ts') },
  { find: /^@shared\/(.*)\.js$/, replacement: path.join(sharedSrc, '$1.ts') },
  { find: '@shared', replacement: sharedSrc },
];

/** Host 半：ESM，node: 内建外置 */
async function buildHost() {
  await build({
    configFile: false,
    root: repo,
    logLevel: 'warn',
    resolve: { alias: sharedAlias },
    build: {
      lib: { entry: path.join(here, 'src/host.ts'), formats: ['es'], fileName: () => 'index.js' },
      outDir: path.join(work, 'host'),
      emptyOutDir: true,
      minify: false,
      target: 'node22',
      rollupOptions: { external: [/^node:/] },
    },
  });
}

/** Client 半：CJS，React 走宿主模块表 */
async function buildClient() {
  await build({
    configFile: false,
    root: repo,
    logLevel: 'warn',
    resolve: { alias: sharedAlias },
    esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
    // React Flow 预编译产物用 jsx-runtime 并读 process.env.NODE_ENV；浏览器里没有 process，
    // 必须在构建期折叠掉，否则整个插件模块在 materialize 时抛错、所有插槽都注册不上。
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      lib: { entry: path.join(here, 'src/client.tsx'), formats: ['cjs'], fileName: () => 'client.bundle.cjs' },
      outDir: path.join(work, 'client'),
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      // 只外置 React 本体：jsx-runtime 打进来但内部仍 require('react')，保证只有一份 React 身份
      rollupOptions: { external: ['react', 'react-dom', 'react-dom/client'] },
    },
  });
}

function wrapClient(body) {
  return `// 由 build.mjs 生成，勿手改。源码见 src/。
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    (function (module, exports, require) {
${body}
    })(module, module.exports, require);
    return module.exports;
  },
});
`;
}

/** Host 产物里的 import 只应剩 node: 内建；其余说明打包没闭合 */
function assertSelfContained(code, label) {
  const imports = [...code.matchAll(/(?:^|\n)\s*import\s+[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  const bad = imports.filter((specifier) => specifier !== undefined && !specifier.startsWith('node:'));
  if (bad.length > 0) throw new Error(`${label} 仍有外部依赖：${bad.join(', ')}`);
}

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

await Promise.all([buildHost(), buildClient()]);

const hostCode = await readFile(path.join(work, 'host', 'index.js'), 'utf8');
assertSelfContained(hostCode, 'index.js');
await writeFile(path.join(here, 'index.js'), hostCode, 'utf8');

const clientCode = await readFile(path.join(work, 'client', 'client.bundle.cjs'), 'utf8');
if (clientCode.includes('require("react/jsx-runtime")')) {
  throw new Error('client 包引用了 react/jsx-runtime；宿主只提供 React 本体，检查 JSX 转换设置');
}
await writeFile(path.join(here, 'client.js'), wrapClient(clientCode.trimEnd()), 'utf8');

await rm(work, { recursive: true, force: true });
console.log(`built ${pkg.name}: index.js ${(hostCode.length / 1024).toFixed(1)} KiB, client.js ${(clientCode.length / 1024).toFixed(1)} KiB`);
