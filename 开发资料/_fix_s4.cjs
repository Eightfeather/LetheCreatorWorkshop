const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
const old = `    const reveal = await client.evalJs('(async()=>{const r=await fetch("/api/reveal",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:"D:\\\\\\\\私服\\\\\\\\BepInEx\\\\\\\\plugins"})});return r.status;})()');`;
if (!s.includes(old)) { console.error('锚点未命中'); process.exit(1); }
const neu = `    const revealPath = await client.evalJs('window.__WBS.status.letheRoot.replace(/[\\\\\\\\/][^\\\\\\\\/]+$/, "")');
    const reveal = await client.evalJs('(async()=>{const r=await fetch("/api/reveal",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:' + JSON.stringify(revealPath) + '})});return r.status;})()');`;
s = s.split(old).join(neu);
fs.writeFileSync(P, s, 'utf8');
console.log('smoke reveal 改为实际插件目录');
