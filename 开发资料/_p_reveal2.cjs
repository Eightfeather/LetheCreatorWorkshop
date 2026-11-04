const fs = require('fs');
const P = 'src/server/api.mjs';
let s = fs.readFileSync(P, 'utf8');
const old = `      const pluginDir = state.gameRoot
        ? join(state.gameRoot, 'BepInEx', 'plugins')
        : (letheRoot ? dirname(letheRoot) : '');
      const low = p.toLowerCase();
      const insideOf = (base) => Boolean(base) && (low === base.toLowerCase() || low.startsWith(base.toLowerCase() + '\\\\'));
      const okRoot = insideOf(letheRoot);
      const okUser = insideOf(USER_DATA_DIR);
      // 插件目录（Lethe 的上级）也要能打开，否则「打开插件目录」永远 400
      const okPlugins = insideOf(pluginDir);
      if (!okRoot && !okUser && !okPlugins) {`;
const neu = `      const low = p.toLowerCase();
      const insideOf = (base) => Boolean(base) && (low === String(base).toLowerCase() || low.startsWith(String(base).toLowerCase() + '\\\\'));
      const okRoot = insideOf(letheRoot);
      const okUser = insideOf(USER_DATA_DIR);
      // 插件目录：Lethe 的上级；另兼容 gameRoot 指向 BepInEx 或其上级的两种情形
      const bases = [];
      if (letheRoot) bases.push(dirname(letheRoot));
      if (state.gameRoot) {
        bases.push(join(state.gameRoot, 'BepInEx', 'plugins'));
        bases.push(join(state.gameRoot, 'plugins'));
        bases.push(state.gameRoot);
      }
      const okPlugins = bases.some((b) => insideOf(b));
      if (!okRoot && !okUser && !okPlugins) {`;
if (!s.includes(old)) {
  // 容错：按片段重建（正则处理反斜杠差异）
  const i0 = s.indexOf("      const pluginDir = state.gameRoot");
  const i1 = s.indexOf("        const err = new Error('只允许打开私服、插件目录或用户数据目录内的路径');");
  if (i0 < 0 || i1 < 0) { console.error('reveal 锚点未命中'); process.exit(1); }
  s = s.slice(0, i0) + neu + '\n' + s.slice(i1).replace(/^[\s\S]*?(?=const err)/, '');
  s = s.replace("      if (!okRoot && !okUser && !okPlugins) {\nconst err", "      if (!okRoot && !okUser && !okPlugins) {\n        const err");
} else {
  s = s.split(old).join(neu);
}
fs.writeFileSync(P, s, 'utf8');
console.log('reveal 白名单已改为多基址');
