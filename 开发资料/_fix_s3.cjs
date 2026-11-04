const fs = require('fs');
// 1) smoke：每次先回向导首页
let s = fs.readFileSync('test/smoke.mjs', 'utf8');
const old = `    const openKind = async (kind, sel) => {
      await client.evalJs(\`(document.querySelector('.wiz[data-kind="\${kind}"]') || {click(){}}).click(); true\`);`;
const neu = `    const openKind = async (kind, sel) => {
      // 先回向导首页（人格/技能等编辑器进入后，向导卡不在 DOM 里）
      await client.evalJs('document.querySelector(\\'.dock-item[data-view="edit"]\\').click(); true');
      await wait(450);
      await client.evalJs(\`(document.querySelector('.wiz[data-kind="\${kind}"]') || {click(){}}).click(); true\`);`;
if (!s.includes(old)) { console.error('smoke 锚点未命中'); process.exit(1); }
s = s.split(old).join(neu);
fs.writeFileSync('test/smoke.mjs', s, 'utf8');
console.log('smoke openKind 已修');

// 2) reveal：gameRoot 缺失时用 letheRoot 的父目录（沙箱没有 exe）
let m = fs.readFileSync('src/server/api.mjs', 'utf8');
const oldR = "      const pluginDir = state.gameRoot ? join(state.gameRoot, 'BepInEx', 'plugins') : '';";
const newR = "      const pluginDir = state.gameRoot\n        ? join(state.gameRoot, 'BepInEx', 'plugins')\n        : (letheRoot ? dirname(letheRoot) : '');";
if (!m.includes(oldR)) { console.error('reveal 锚点未命中'); process.exit(1); }
m = m.split(oldR).join(newR);
fs.writeFileSync('src/server/api.mjs', m, 'utf8');
console.log('reveal 已加 letheRoot 兜底；dirname 已导入:', /import \{[^}]*\bdirname\b/.test(m));
