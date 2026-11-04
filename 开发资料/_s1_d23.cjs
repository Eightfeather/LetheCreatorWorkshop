const fs = require('fs');
// loadMdList 默认参数修正
let a = fs.readFileSync('src/web/app.js', 'utf8');
const before = a;
a = a.split("async function loadMdList(name = S.selected, kind = S.editKind) {").join("async function loadMdList(name, kind) {\n  name = name || S.selected;\n  kind = kind || S.mdKind;");
a = a.split("if (S.editKind) await loadMdList(nm, S.editKind);").join("if (S.mdKind) await loadMdList(nm, S.mdKind);");
fs.writeFileSync('src/web/app.js', a, 'utf8');
console.log('app.js 改动:', before.length, '→', a.length);

// reveal 白名单：允许插件目录
let m = fs.readFileSync('src/server/api.mjs', 'utf8');
const i = m.indexOf("'/api/reveal'");
console.log('--- reveal 原文 ---');
console.log(m.slice(i, i + 1100));
