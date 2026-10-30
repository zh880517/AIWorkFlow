// 单插件构建：把 shared/ 与插件 src 打成两个自包含产物。
//   index.js  —— Host 半，Node ESM，只外置 node: 内建模块
//   client.js —— Client 半，套上宿主的 __ModuleLoader__ 懒加载 factory 外壳
//
// 所有插件共用这一份构建；插件差异只允许来自它自己的 package.json 与源码。
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { repo } from './plugins.mjs';

const sharedSrc = path.join(repo, 'shared', 'src');
const jsxShim = path.join(repo, 'scripts', 'jsx-runtime-shim.ts');

const sharedAlias = [
  // 第三方预编译包自带 jsx-runtime 会引入第二份 React 身份（React #31），改接到宿主 React
  { find: /^react\/jsx-runtime$/, replacement: jsxShim },
  { find: /^react\/jsx-dev-runtime$/, replacement: jsxShim },
  { find: /^@shared\/index\.js$/, replacement: path.join(sharedSrc, 'index.ts') },
  { find: /^@shared\/(.*)\.js$/, replacement: path.join(sharedSrc, '$1.ts') },
  { find: '@shared', replacement: sharedSrc },
];

/** Host 半：ESM，node: 内建外置 */
async function buildHost(plugin, work) {
  await build({
    configFile: false,
    root: repo,
    logLevel: 'warn',
    resolve: { alias: sharedAlias },
    build: {
      lib: { entry: path.join(plugin.dir, 'src/host.ts'), formats: ['es'], fileName: () => 'index.js' },
      outDir: path.join(work, 'host'),
      emptyOutDir: true,
      minify: false,
      target: 'node22',
      rollupOptions: { external: [/^node:/] },
    },
  });
}

/** Client 半：CJS，React 走宿主模块表 */
async function buildClient(plugin, work) {
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
      lib: { entry: path.join(plugin.dir, 'src/client.tsx'), formats: ['cjs'], fileName: () => 'client.bundle.cjs' },
      outDir: path.join(work, 'client'),
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      // 只外置 React 本体：jsx-runtime 打进来但内部仍 require('react')，保证只有一份 React 身份
      rollupOptions: { external: ['react', 'react-dom', 'react-dom/client'] },
    },
  });
}

function wrapClient(body, packageName) {
  return `// 由 scripts/build-plugin.mjs 生成，勿手改。源码见 src/。
window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageName)},
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
  const imports = [...code.matchAll(/(?:^|\n)\s*import\s+[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  const bad = imports.filter((specifier) => specifier !== undefined && !specifier.startsWith('node:'));
  if (bad.length > 0) throw new Error(`${label} 仍有外部依赖：${bad.join(', ')}`);
}

/** Rolldown 的 //#region 注释会写依赖的物理路径（junction/pnpm 布局下是绝对路径）：
 *  去掉路径只保留标记，保证不同 node_modules 布局构建出的产物字节一致。 */
function stripRegionPaths(code) {
  return code.replace(/^\/\/#region .+$/gm, '//#region');
}

/**
 * 构建一个插件，产物写回插件目录。
 * @param {{ id: string, dir: string, pkg: { name: string } }} plugin
 * @returns {Promise<{ id: string, hostKiB: string, clientKiB: string }>}
 */
export async function buildPlugin(plugin) {
  const work = path.join(plugin.dir, '.build');
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });

  await Promise.all([buildHost(plugin, work), buildClient(plugin, work)]);

  const hostCode = stripRegionPaths(await readFile(path.join(work, 'host', 'index.js'), 'utf8'));
  assertSelfContained(hostCode, `${plugin.id}/index.js`);
  await writeFile(path.join(plugin.dir, 'index.js'), hostCode, 'utf8');

  const clientCode = stripRegionPaths(await readFile(path.join(work, 'client', 'client.bundle.cjs'), 'utf8'));
  if (clientCode.includes('require("react/jsx-runtime")')) {
    throw new Error(`${plugin.id}: client 包引用了 react/jsx-runtime；宿主只提供 React 本体，检查 JSX 转换设置`);
  }
  await writeFile(path.join(plugin.dir, 'client.js'), wrapClient(clientCode.trimEnd(), plugin.pkg.name), 'utf8');

  await rm(work, { recursive: true, force: true });
  return {
    id: plugin.id,
    hostKiB: (hostCode.length / 1024).toFixed(1),
    clientKiB: (clientCode.length / 1024).toFixed(1),
  };
}
