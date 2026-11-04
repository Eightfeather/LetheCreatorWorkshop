const fs = require('fs');
// ---------- D4：reveal 放行插件目录 ----------
let m = fs.readFileSync('src/server/api.mjs', 'utf8');
const oldReveal = `      const { letheRoot } = need();
      const okRoot = letheRoot && p.toLowerCase().startsWith(letheRoot.toLowerCase());
      const okUser = p.toLowerCase().startsWith(USER_DATA_DIR.toLowerCase());
      if (!okRoot && !okUser) {
        const err = new Error('只允许打开私服或用户数据目录内的路径');
        err.status = 400;
        throw err;
      }`;
const newReveal = `      const { letheRoot } = need();
      const pluginDir = state.gameRoot ? join(state.gameRoot, 'BepInEx', 'plugins') : '';
      const low = p.toLowerCase();
      const insideOf = (base) => Boolean(base) && (low === base.toLowerCase() || low.startsWith(base.toLowerCase() + '\\\\'));
      const okRoot = insideOf(letheRoot);
      const okUser = insideOf(USER_DATA_DIR);
      // 插件目录（Lethe 的上级）也要能打开，否则「打开插件目录」永远 400
      const okPlugins = insideOf(pluginDir);
      if (!okRoot && !okUser && !okPlugins) {
        const err = new Error('只允许打开私服、插件目录或用户数据目录内的路径');
        err.status = 400;
        throw err;
      }`;
if (!m.includes(oldReveal)) { console.error('D4 锚点未命中'); process.exit(1); }
m = m.split(oldReveal).join(newReveal);
fs.writeFileSync('src/server/api.mjs', m, 'utf8');
console.log('D4 ok；join 是否已导入:', /import \{[^}]*\bjoin\b/.test(m) || /const \{ join \}/.test(m));

// ---------- L2：render() 状态不变量断言 ----------
let a = fs.readFileSync('src/web/app.js', 'utf8');
const anchor = 'function render() {';
const guard = `function assertState() {
  // 不变量：视图状态只允许落在各自的枚举里（0.9.0 的“镜牢→编辑空白”就是因为 editKind 被复用）
  const wizKinds = WIZARDS.map((w) => w.kind);
  if (S.editKind && !wizKinds.includes(S.editKind)) {
    console.warn('[state] editKind 非法，已重置为向导首页：', S.editKind);
    S.editKind = null; S.personalityId = null; S.personality = null;
    S.moduleEditing = null; S.mb = null; S.mbDoc = null;
  }
  if (S.mdKind && !MD_UI.includes(S.mdKind)) {
    console.warn('[state] mdKind 非法，已重置为镜牢表列表：', S.mdKind);
    S.mdKind = null; S.md = null; S.mdId = null;
  }
  return true;
}

function render() {
  assertState();`;
if (!a.includes(anchor)) { console.error('render 锚点未命中'); process.exit(1); }
a = a.split(anchor).join(guard);
fs.writeFileSync('src/web/app.js', a, 'utf8');
console.log('L2 ok');
