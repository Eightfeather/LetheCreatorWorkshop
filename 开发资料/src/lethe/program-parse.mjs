/**
 * Modular 脚本 → 积木程序（反向解析）
 *
 * 只做「识别」，不改变磁盘内容：解析失败的部分一律折成 raw 块原样保留，
 * 保证「看到的就是文件里的」。
 *
 * 引擎语义参考（ModularSkillScripts.SetupModular / ProcessBatch）：
 *  - 整串按 `/` 切段；`TIMING:x(...)` 只设时点、`LOOP:y` 只设遍历，两者不进 batch
 *  - 其余每段是一条 batch，段内按 `:` 拆指令；`VALUE_n:expr` 是赋值，`IF(...)` 的作用域是「同段剩余指令」
 *  - 实参里的 `Gname{a-b-c}` 是内嵌取值函数（引擎把 {} 换成 ()、- 换成 ,）
 */

import { canonicalCommand } from '../knowledge/modular-tables.mjs';
import { compileProgram } from './program.mjs';

const PREFIX = 'Modular/';

/** 已知目标选择器基础名（引擎 switch 里出现过的） */
const TARGET_BASES = [
  'EveryAbnoCoreAlly', 'EveryAbnoCoreEnemy', 'EveryCoreAlly', 'EveryCoreEnemy', 'EveryTarget', 'BegoneSubTargets',
  'SelfCore', 'SelfParts', 'TargetCore', 'TargetParts', 'MainTarget', 'SubTarget', 'EveryAlly', 'EveryEnemy',
  'RandomAlly', 'RandomEnemy', 'AllyExceptSelf', 'EnemyExceptSelf', 'ExceptSelf', 'ExceptTarget', 'Victim',
  'Killer', 'Self', 'Target', 'All',
];
const TARGET_PREFIXES = ['Self', 'Target', 'Every', 'Ally', 'Enemy', 'Random', 'MainTarget', 'SubTarget', 'Victim', 'Killer', 'Except', 'Begone', 'All', 'Slowest', 'Fastest', 'Highest', 'Lowest'];

const MATH_OPS = ['+', '-', '*', '%', '!', '¡', '?'];

function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(text || '')) {
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function splitTrailing(text) {
  const s = String(text || '').trim();
  const m = s.match(/^(.*?)(\d+)?(\$[A-Za-z0-9_]+)?$/);
  if (!m) return { base: s, count: null, kw: '' };
  return { base: m[1] || '', count: m[2] ? Number(m[2]) : null, kw: m[3] || '' };
}

function looksLikeTarget(base) {
  if (!base) return false;
  if (TARGET_BASES.includes(base)) return true;
  if (!TARGET_PREFIXES.some((p) => base.startsWith(p))) return false;
  return /^[A-Za-z0-9_$+]+$/.test(base);
}

function parseTarget(text) {
  const s = String(text || '').trim();
  if (splitTop(s, '+').length > 1) {
    const parts = splitTop(s, '+').map((x) => parseTarget(x)).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => p.t === 'target')) {
      return { t: 'target', n: parts.map((p) => p.n).join('+'), c: parts[0].c ?? null };
    }
    return { t: 's', v: s };
  }
  const { base, count, kw } = splitTrailing(s);
  if (!looksLikeTarget(base)) return null;
  return { t: 'target', n: base + kw, c: count && count > 0 ? count : null };
}

function parseMath(inner) {
  const text = String(inner || '');
  const pieces = [];
  let cur = '';
  let depth = 0;
  let op = '';
  for (const ch of text) {
    if (ch === '(' || ch === '{') depth += 1;
    if (ch === ')' || ch === '}') depth -= 1;
    if (depth === 0 && MATH_OPS.includes(ch)) {
      pieces.push({ op, val: cur });
      op = ch;
      cur = '';
      continue;
    }
    cur += ch;
  }
  pieces.push({ op, val: cur });
  const first = parseValue(pieces[0] && pieces[0].val);
  const tail = pieces.slice(1).filter((p) => String(p.val || '').trim() !== '').slice(0, 8)
    .map((p) => ({ op: p.op || '+', val: parseValue(p.val) }));
  return { t: 'math', first, tail };
}

/** 单值表达式 → 值块 */
export function parseValue(text) {
  const raw = String(text === undefined || text === null ? '' : text).trim();
  if (!raw || raw === '_') return null;
  if (/^VALUE_\d+$/.test(raw)) return { t: 'var', n: raw };
  if (/^-?\d+$/.test(raw)) return { t: 'n', v: Number(raw) };
  if (raw.startsWith('G') && raw.includes('{') && raw.endsWith('}')) {
    const k = raw.indexOf('{');
    const name = raw.slice(1, k);
    const inner = raw.slice(k + 1, -1);
    const a = splitTop(inner, '-').map((x) => parseValue(x));
    return { t: 'acq', n: name, a };
  }
  if (raw.includes('(') && raw.endsWith(')')) {
    const k = raw.indexOf('(');
    const name = raw.slice(0, k).trim();
    const inner = raw.slice(k + 1, -1);
    if (name === 'math') return parseMath(inner);
    const a = inner === '' ? [] : splitTop(inner, ',').map((x) => parseValue(x));
    return { t: 'acq', n: name, a };
  }
  const tg = parseTarget(raw);
  if (tg) return tg;
  return { t: 's', v: raw };
}

function parseTimingArgs(inner) {
  const out = { face: null, crit: null, kw: null, key: null, extras: [] };
  const list = splitTop(String(inner || ''), ',').map((x) => x.trim()).filter(Boolean);
  list.forEach((part) => {
    if (['Head', 'Tail', 'None'].includes(part) && !out.face) { out.face = part; return; }
    if (['Crit', 'NoCrit', 'None'].includes(part) && !out.crit) { out.crit = part; return; }
    out.extras.push(part);
  });
  if (out.extras.length === 1) out.kw = out.extras[0];
  else if (out.extras.length === 2) { out.kw = out.extras[0]; out.key = out.extras[1]; }
  return out;
}

/** 单条指令 → 语句块；返回 null 表示空 */
function parseInstruction(text) {
  const s = String(text || '').trim();
  if (!s || s === '_') return null;
  if (/^VALUE_\d+$/.test(s)) return { k: 'assign', var: s, val: null };
  if (/^(CLEARVALUES|RESETWHENUSE|EXPECTED|LUAMAIN)$/.test(s)) return { k: 'raw', text: s };
  let m = s.match(/^(VALUE_\d+):([\s\S]+)$/);
  if (m) return { k: 'assign', var: m[1], val: parseValue(m[2]) };
  m = s.match(/^(IFNOT|IF|CONTINUEIF)\(([\s\S]*)\)([\s\S]*)$/);
  if (m) {
    const kw = m[1] === 'IFNOT' ? 'ifnot' : (m[1] === 'CONTINUEIF' ? 'continueif' : 'if');
    const conds = parseConds(m[2]);
    const rest = (m[3] || '').replace(/^:/, '').trim();
    const body = rest ? parseInstruction(rest) : null;
    const b = { k: kw, logic: conds.logic, conds: conds.conds };
    if (kw !== 'continueif') b.body = body ? [body] : [];
    return b;
  }
  m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\(([\s\S]*)\))?$/);
  if (m) {
    const args = m[2] === undefined ? [] : (m[2].trim() === '' ? [] : splitTop(m[2], ',').map((x) => parseValue(x)));
    return { k: 'cons', n: canonicalCommand('consequence', m[1]), a: args.slice(0, 12) };
  }
  return { k: 'raw', text: s.slice(0, 300) };
}

/** 条件串 → {logic, conds[]}（引擎只支持 > < =） */
function parseConds(text) {
  const body = String(text || '').trim();
  let logic = 'none';
  let rest = body;
  const m = body.match(/^(AND|OR|XOR)\s*,\s*([\s\S]+)$/i);
  if (m) { logic = m[1].toLowerCase(); rest = m[2]; }
  const parts = splitTop(rest, ',').map((x) => x.trim()).filter(Boolean);
  const conds = parts.map((p) => {
    const c = p.match(/^([\s\S]*?)(>=|<=|>|<|=)([\s\S]*)$/);
    if (!c) return { left: { t: 's', v: p }, op: '>', right: { t: 'n', v: 0 } };
    let op = c[2];
    if (op === '>=') op = '>';
    if (op === '<=') op = '<';
    return { left: parseValue(c[1]), op: ['>', '<', '='].includes(op) ? op : '>', right: parseValue(c[3]) };
  });
  if (!conds.length) conds.push({ left: { t: 'var', n: 'VALUE_0' }, op: '>', right: { t: 'n', v: 0 } });
  return { logic, conds: conds.slice(0, 8) };
}

/** 一条脚本 → { timing, args, loop, stmts[], ok, code } */
export function parseScript(code) {
  const text = String(code || '').trim();
  const body = text.startsWith(PREFIX) ? text.slice(PREFIX.length) : text;
  const segments = splitTop(body, '/').map((s) => s.trim()).filter(Boolean);
  const row = { code: text, timing: '', args: { face: null, crit: null, kw: null, key: null, extras: [] }, loop: null, stmts: [], ok: true };
  if (!segments.length) { row.ok = false; return row; }

  let i = 0;
  const first = segments[0];
  if (/^TIMING:/i.test(first)) {
    const rest = first.slice(7);
    const k = rest.indexOf('(');
    if (k >= 0 && rest.endsWith(')')) {
      row.timing = rest.slice(0, k).trim();
      row.args = parseTimingArgs(rest.slice(k + 1, -1));
    } else {
      row.timing = rest.trim();
    }
    i = 1;
  } else {
    row.ok = false;
  }
  if (i < segments.length && /^LOOP:/i.test(segments[i])) {
    const v = parseTarget(segments[i].slice(5).trim());
    row.loop = v || { t: 's', v: segments[i].slice(5).trim() };
    i += 1;
  }
  for (; i < segments.length; i += 1) {
    const seg = segments[i];
    const toks = splitTop(seg, ':').map((x) => x.trim()).filter(Boolean);
    let host = row.stmts;
    for (let t = 0; t < toks.length; t += 1) {
      let ins = toks[t];
      if (/^VALUE_\d+$/.test(ins) && t + 1 < toks.length) { ins = ins + ':' + toks[t + 1]; t += 1; }
      const b = parseInstruction(ins);
      if (!b) continue;
      if (b.k === 'if' || b.k === 'ifnot' || b.k === 'continueif') {
        host.push(b);
        if (b.k !== 'continueif') host = b.body;
      } else {
        host.push(b);
      }
    }
  }
  row.blockCount = countBlocks(row.stmts);
  return row;
}

function countBlocks(list) {
  let n = 0;
  for (const b of list || []) {
    n += 1;
    if (b && Array.isArray(b.body)) n += countBlocks(b.body);
  }
  return n;
}

/** 多条脚本 → { rows, program }（program 可直接喂给积木画布） */
export function parseScripts(list) {
  const rows = (Array.isArray(list) ? list : []).map((x) => parseScript(x));
  const blocks = rows.filter((r) => r.timing).map((r) => {
    const b = { k: 'timing', v: r.timing, body: r.stmts };
    if (r.args.face || r.args.crit) { b.face = r.args.face || 'None'; b.crit = r.args.crit || 'None'; }
    if (r.args.kw) b.kw = r.args.kw;
    if (r.args.key) b.key = r.args.key;
    b.loop = r.loop && r.loop.t === 'target' ? r.loop : null;
    return b;
  });
  return { rows, program: { version: 1, blocks } };
}


/** 规范化脚本文本：旧称归一、去掉多余空参、去掉行尾多余斜杠 */
export function canonicalCode(code) {
  const text = String(code || '').trim();
  const r = parseScript(text);
  if (!r.timing) return text.replace(/\s+/g, '');
  const b = { k: 'timing', v: r.timing, body: r.stmts };
  if (r.args.face || r.args.crit) { b.face = r.args.face || 'None'; b.crit = r.args.crit || 'None'; }
  if (r.args.kw) b.kw = r.args.kw;
  if (r.args.key) b.key = r.args.key;
  b.loop = r.loop && r.loop.t === 'target' ? r.loop : null;
  let out = '';
  try { out = compileProgram({ version: 1, blocks: [b] })[0] || ''; } catch { out = ''; }
  return out || text;
}
