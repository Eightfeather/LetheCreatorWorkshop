import fs from 'node:fs';
import path from 'node:path';

const DECOMP = process.env.DECOMP_DIR || 'E:/辅助文件/Mod编辑器/数据缓存/decomp-current3';
const OUT = 'E:/辅助文件/Mod编辑器/编辑器正式稿/开发资料/src/knowledge/engine-registry.mjs';

const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.cs')) out.push(p); } return out; };
const groups = { modular: walk(DECOMP + '/ModularSkillScripts'), mt: walk(DECOMP + '/MTCustomScripts'), lethe: walk(DECOMP + '/Lethe') };
const texts = new Map();
for (const g of Object.keys(groups)) for (const f of groups[g]) texts.set(f, { src: g, text: fs.readFileSync(f, 'utf8') });

const classBodies = new Map();
for (const [f, { src, text }] of texts) {
  for (const m of text.matchAll(/(?:^|\n)\s*(?:public|internal|private|protected)?\s*(?:static\s+|sealed\s+|partial\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/g)) {
    const name = m[1];
    const brace = text.indexOf('{', m.index + m[0].length - 1);
    if (brace < 0) continue;
    let depth = 0, end = -1;
    for (let i = brace; i < text.length; i++) { if (text[i] === '{') depth++; else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
    if (end < 0) continue;
    if (!classBodies.has(name)) classBodies.set(name, []);
    classBodies.get(name).push({ src, body: text.slice(brace, end + 1) });
  }
}

const analyze = (cls, prefer) => {
  const list = classBodies.get(cls) || [];
  if (!list.length) return null;
  const b = (list.find((x) => x.src === prefer) || list[0]).body;
  const idx = [...new Set([...b.matchAll(/circles\[(\d+)\]/g)].map((x) => Number(x[1])))].sort((x, y) => x - y);
  const circed = /GetNumFromParamString\(\s*circledSection\s*\)|GetTargetModel\(circledSection\)|circledSection\s*(==|!=)|Split\(/.test(b) && /circledSection/.test(b);
  const guards = [...new Set([...b.matchAll(/circles\.Length\s*>\s*(\d+)/g)].map((x) => Number(x[1])))].sort((x, y) => x - y);
  const paramFromCircles = idx.length ? Math.max(...idx) + 1 : 0;
  return { idx, guards, circed, paramsEngine: paramFromCircles || (circed ? 1 : 0) };
};

const regs = new Map();
for (const [f, { src, text }] of texts) {
  for (const m of text.matchAll(/(consequenceDict|acquirerDict)\["([^"]+)"\]\s*=\s*([^;]+);/g)) {
    const [, dict, name, rhs] = m;
    const kind = dict === 'consequenceDict' ? 'consequence' : 'acquirer';
    const clsM = /new\s+([A-Za-z_][\w.]*)\s*[\(\{]/.exec(rhs);
    const aliasM = /Dict\["([^"]+)"\]/.exec(rhs);
    const cls = clsM ? clsM[1].split('.').pop() : null;
    regs.set(kind + ':' + name, { kind, name, cls, alias: aliasM ? aliasM[1] : null, src, file: path.basename(f), ...(cls ? analyze(cls, src) || {} : {}) });
  }
}
// alias 展开参数
for (const r of regs.values()) {
  if (r.alias) {
    const t = regs.get(r.kind + ':' + r.alias);
    r.paramsEngine = t ? (t.paramsEngine || 0) : 0;
    r.idx = t ? t.idx : [];
    r.aliasOf = r.alias;
  }
}

// timings
const mainFile = [...texts.keys()].find((f) => f.replace(/\\/g, '/').endsWith('ModularSkillScripts/MainClass.cs'));
const mainSrc = texts.get(mainFile).text;
const seg = mainSrc.slice(mainSrc.indexOf('new List<string>('), mainSrc.indexOf('int count'));
const timingList = [...seg.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const timingAlias = {};
for (const m of mainSrc.matchAll(/timingDict\.Add\("([^"]+)",\s*timingDict\["([^"]+)"\]\);/g)) timingAlias[m[1]] = m[2];

const rows = [...regs.values()].sort((a, b) => (a.kind + a.name).localeCompare(b.kind + b.name));
const header = `// 由 tools/build-engine-registry.mjs 生成，数据来源：当前私服 BepInEx/plugins 下的
// ModularSkillScripts.dll（5.1.17）、MTCustomScripts.dll、Lethe.dll 反编译结果。
// 勿手改：重新反编译后用脚本重生成。
// 生成时间：${new Date().toISOString()}
export const ENGINE_VERSION = 'ModularSkillScripts 5.1.17 + MTCustomScripts + Lethe';
export const TIMINGS = ${JSON.stringify(timingList, null, 0)};
export const TIMING_ALIASES = ${JSON.stringify(timingAlias, null, 0)};
export const COMMANDS = ${JSON.stringify(rows.map((r) => ({ kind: r.kind, name: r.name, cls: r.cls, src: r.src, params: r.paramsEngine || 0, aliasOf: r.aliasOf || null, circleIdx: r.idx || [], guards: r.guards || [] })), null, 0)};
`;
fs.writeFileSync(OUT, header, 'utf8');
console.log('wrote', OUT, 'commands', rows.length, 'timings', timingList.length, 'timingAliases', Object.keys(timingAlias).length, 'bytes', fs.statSync(OUT).size);
const dist = (k) => rows.filter((r) => r.kind === k).reduce((a, r) => { a[r.paramsEngine] = (a[r.paramsEngine] || 0) + 1; return a; }, {});
console.log('cons params dist', JSON.stringify(dist('consequence')));
console.log('acq params dist', JSON.stringify(dist('acquirer')));
