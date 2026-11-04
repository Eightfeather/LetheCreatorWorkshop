const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
const old1 = `const version = await client.evalJs('(await fetch("/api/health").then(r=>r.json())).version');`;
const new1 = `const version = await client.evalJs('(async()=>{const r=await fetch("/api/health");return (await r.json()).version;})()');`;
if (!s.includes(old1)) { console.error('锚点1未命中'); process.exit(1); }
s = s.replace(old1, () => new1);
const old2 = `const reveal = await client.evalJs('(await fetch("/api/reveal",{method:"POST",headers:{"content-type":"application/json","x-wb-token":document.querySelector("script")?window.__WB_TOKEN__:""},body:JSON.stringify({path:"D:\\\\\\\\私服\\\\\\\\BepInEx\\\\\\\\plugins"})}).then(r=>r.status))');`;
if (!s.includes(old2)) { console.error('锚点2未命中'); process.exit(1); }
const new2 = `const reveal = await client.evalJs('(async()=>{const r=await fetch("/api/reveal",{method:"POST",headers:{"content-type":"application/json","x-wb-token":window.__WB_TOKEN__},body:JSON.stringify({path:"D:\\\\\\\\私服\\\\\\\\BepInEx\\\\\\\\plugins"})});return r.status;})()');`;
s = s.replace(old2, () => new2);
fs.writeFileSync(P, s, 'utf8');
console.log('smoke 补丁完成');
