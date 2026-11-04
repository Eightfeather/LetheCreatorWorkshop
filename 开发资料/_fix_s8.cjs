const fs = require('fs');
const P = 'test/smoke.mjs';
let s = fs.readFileSync(P, 'utf8');
const a = 'JSON.stringify({root:\' + JSON.stringify(SANDBOX) + \'})';
if (s.includes(a)) { s = s.split(a).join('JSON.stringify({path:\' + JSON.stringify(SANDBOX) + \'})'); console.log('已改 body.root → body.path'); }
else console.log('未找到 root body（检查）');
s = s.split('body:JSON.stringify({root:"D:\\\\\\\\私服"})').join('body:JSON.stringify({path:"D:\\\\\\\\私服"})');
fs.writeFileSync(P, s, 'utf8');
