const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
// 用 API 切根，避免依赖 config 文件位置
s = s.split(`  // 配置指向沙箱，避免污染真实私服
  const cfgBackup = exists(CFG) ? readFileSync(CFG, 'utf8') : null;
  writeFileSync(CFG, JSON.stringify({ version: 1, gameRoot: '', letheRoot: SANDBOX, recentRoots: [], theme: 'dark' }, null, 2), 'utf8');
`).join(`  const cfgBackup = exists(CFG) ? readFileSync(CFG, 'utf8') : null;
`);
// 03 改为主动切根
const old03 = `    check('03 定位到沙箱私服', String(await client.evalJs('window.__WBS.status.letheRoot')).includes('e2e-root'));`;
const new03 = `    const switched = await client.evalJs('(async()=>{const r=await fetch("/api/root",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({root:' + JSON.stringify(SANDBOX) + '})});if(!r.ok)return {ok:false,body:(await r.text()).slice(0,120)};location.reload();return {ok:true};})()');
    await wait(2500);
    for (let i = 0; i < 40; i++) { if (await client.evalJs('Boolean(window.__WBS && window.__WBS.status && window.__WBS.status.letheRoot)')) break; await wait(400); }
    const rootNow = String(await client.evalJs('window.__WBS.status.letheRoot'));
    check('03 已切到沙箱私服', switched.ok && rootNow.includes('e2e-root'), JSON.stringify(switched) + ' root=' + rootNow);`;
if (!s.includes(old03)) { console.error('03 锚点未命中'); process.exit(1); }
s = s.split(old03).join(new03);
// 结束时切回真实私服
s = s.split('  } finally {').join(`  } finally {
    try { if (client) await client.evalJs('fetch("/api/root",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({root:"D:\\\\\\\\私服"})})'); } catch { /* ignore */ }`);
fs.writeFileSync(P, s, 'utf8');
console.log('smoke 改为 API 切根');
