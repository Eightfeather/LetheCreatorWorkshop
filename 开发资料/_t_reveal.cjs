const path = require('path');
const SB = 'E:\\辅助文件\\Mod编辑器\\数据缓存\\e2e-root\\BepInEx\\plugins\\Lethe';
(async () => {
  const { startServer } = await import('file:///E:/辅助文件/Mod编辑器/编辑器正式稿/开发资料/src/server/index.mjs');
  const s = await startServer({ port: 0, explicit: SB, locateNow: false, log: () => {} });
  const base = `http://127.0.0.1:${s.port}`;
  const tk = s.token;
  const st = await (await fetch(base + '/api/status', { headers: { 'x-wb-token': tk } })).json();
  console.log('status.letheRoot=', st.letheRoot, '| gameRoot=', JSON.stringify(st.gameRoot));
  const pluginDir = path.dirname(SB);
  const r = await fetch(base + '/api/reveal', { method: 'POST', headers: { 'content-type': 'application/json', 'x-wb-token': tk }, body: JSON.stringify({ path: pluginDir }) });
  console.log('reveal', pluginDir, '->', r.status, (await r.text()).slice(0, 120));
  s.server.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
