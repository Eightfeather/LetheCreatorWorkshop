const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
const i0 = s.indexOf("    const switched = await client.evalJs(");
const i1 = s.indexOf("    check('04 底栏 5 项'");
if (i0 < 0 || i1 < 0) { console.error('锚点未命中'); process.exit(1); }
const SANDBOX = 'E:\\辅助文件\\Mod编辑器\\数据缓存\\e2e-root\\BepInEx\\plugins\\Lethe';
const block = [
  "    const switched = await client.evalJs('(async()=>{const r=await fetch(\"/api/root\",{method:\"POST\",headers:{\"content-type\":\"application/json\",\"x-wb-token\":window.__WB_TOKEN__},body:JSON.stringify({root:' + JSON.stringify(SANDBOX) + '})});const st=await (await fetch(\"/api/status\",{headers:{\"x-wb-token\":window.__WB_TOKEN__}})).json();return {ok:r.ok,root:st.letheRoot,game:st.gameRoot};})()');",
  "    check('03 已切到沙箱私服', switched.ok && String(switched.root).includes('e2e-root'), JSON.stringify(switched));",
  "    await client.evalJs('window.__WBS.status.letheRoot=' + JSON.stringify(SANDBOX) + '; window.__WBS.mods=[]; document.querySelector(\\'.dock-item[data-view=\"mods\"]\\').click(); true');",
  "    await wait(1200);",
  '',
].join('\n');
s = s.slice(0, i0) + block + s.slice(i1);
fs.writeFileSync(P, s, 'utf8');
console.log('03 重写完成');
