const fs = require('fs');
const L = fs.readFileSync('src/web/app.js', 'utf8').split('\n');
const pats = ['kind: S.editKind', 'loadMdList(S.selected, S.editKind)', 'S.editKind = null; S.md = null', 'S.editKind = el.dataset.kind', 'MD_UI.includes(S.editKind)'];
L.forEach((l, i) => { if (pats.some((p) => l.includes(p))) console.log((i + 1) + ': ' + l.trim().slice(0, 150)); });
