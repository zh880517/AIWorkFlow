// 循环构建 plugins/ 下的插件；`node scripts/build.mjs --only <id>` 只构建一个。
import { buildPlugin } from './build-plugin.mjs';
import { selectPlugins } from './plugins.mjs';

const plugins = selectPlugins();
if (plugins.length === 0) {
  console.error('plugins/ 下没有插件可构建。');
  process.exit(1);
}

for (const plugin of plugins) {
  const result = await buildPlugin(plugin);
  console.log(`built ${result.id}: index.js ${result.hostKiB} KiB, client.js ${result.clientKiB} KiB`);
}
