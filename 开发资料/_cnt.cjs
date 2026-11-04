const fs = require('fs');
const s = fs.readFileSync('src/web/app.js', 'utf8');
const pats = [
  'kind=${S.editKind}',
  'kind: S.editKind',
  'mdSpec(S.editKind)',
  'loadMdList(S.selected, S.editKind)',
  'CLONE_FROM[S.editKind]',
  'S.editKind = el.dataset.kind',
  'S.editKind = null; S.md = null',
  'MD_UI.includes(S.editKind)',
  'S.editKind = S.editKind',
];
for (const p of pats) console.log((s.split(p).length - 1) + '  ' + p);
