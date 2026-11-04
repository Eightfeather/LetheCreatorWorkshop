const fs = require('fs');
const L = fs.readFileSync('src/web/app.js', 'utf8').split('\n');
const bad = L.map((l, i) => [i + 1, l]).filter(([, l]) => /mdSpec\(S\.editKind\)|S\.editKind.*S\.md|kind=\$\{S\.editKind\}|MD_UI\.includes\(S\.editKind\)/.test(l));
console.log('残留可疑行:', bad.length); bad.forEach(([n, l]) => console.log(n + ': ' + l.trim().slice(0, 120)));
console.log('mdKind 出现', (fs.readFileSync('src/web/app.js','utf8').match(/S\.mdKind/g) || []).length, '次');
