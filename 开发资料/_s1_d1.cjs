const fs = require('fs');
const P = 'src/web/app.js';
let s = fs.readFileSync(P, 'utf8');
const before = s;
let n = 0;
const rep = (from, to, expect) => {
  const c = s.split(from).length - 1;
  if (c !== expect) { console.error(`ANCHOR MISMATCH (${c} != ${expect}): ${from.slice(0, 70)}`); process.exit(1); }
  s = s.split(from).join(to); n += c;
};
rep('kind=${S.editKind}', 'kind=${S.mdKind}', 3);
rep('kind: S.editKind', 'kind: S.mdKind', 6);
rep('mdSpec(S.editKind)', 'mdSpec(S.mdKind)', 8);
rep('loadMdList(S.selected, S.editKind)', 'loadMdList(S.selected, S.mdKind)', 5);
rep('CLONE_FROM[S.editKind]', 'CLONE_FROM[S.mdKind]', 1);
rep('    S.editKind = el.dataset.kind;\n    S.editKind = S.editKind;', '    S.mdKind = el.dataset.kind;', 1);
rep('S.editKind = null; S.md = null', 'S.mdKind = null; S.md = null', 2);
rep('const kind = S.editKind && MD_UI.includes(S.editKind) ? S.editKind : null;', 'const kind = S.mdKind && MD_UI.includes(S.mdKind) ? S.mdKind : null;', 1);
fs.writeFileSync(P, s, 'utf8');
console.log('替换处数 =', n, '；', before.length, '→', s.length);
