/**
 * 积木程序 → Modular 脚本（后端权威实现）
 *
 * 前端 app.js 里的 mbCompileScript() 只用于实时预览；
 * 真正写进游戏文件、以及“查看输出代码”页面显示的，一律以这里为准。
 *
 * 语义（引擎 ModularSkillScripts.SetupModular / ProcessBatch）：
 *  - 一条脚本 = `Modular/` + 以 `/` 分隔的段
 *  - 第一段必须是 `TIMING:<时点名>`（可带 `(面,暴击,关键词,按键)`）
 *  - 可选第二段 `LOOP:<目标>`，整条脚本的 Target 会被逐个替换
 *  - 其余每个顶层语句各自成段（`name(args)`、`VALUE_n:表达式`、`IF(...)`、`IFNOT(...)`、`CONTINUEIF(...)`）
 *  - IF/IFNOT 的子句用 `:` 连接
 *
 * 手改行：program.manual[key] = "用户手写的整行代码"，key 为时点块在根层的下标字符串。
 * 手改行的块在 UI 上被锁死，编译时直接以手改文本为准。
 */

import { timingArgs } from '../knowledge/timing-args.mjs';

const PREFIX = 'Modular/';

function valueText(v, nested) {
  if (!v) return '_';
  if (v.t === 'target') {
    const tn = String(v.n || '');
    const cnt = v.c === null || v.c === undefined || v.c === '' ? '' : String(v.c);
    if (!cnt) return tn;
    const k = tn.indexOf('$');
    return k < 0 ? tn + cnt : tn.slice(0, k) + cnt + tn.slice(k);
  }
  if (v.t === 'var') return String(v.n || 'VALUE_0');
  if (v.t === 'n') return String(v.v);
  if (v.t === 's') return String(v.v);
  if (v.t === 'acq') {
    const list = (v.a || []).map((x) => (x ? valueText(x, true) : ''));
    while (list.length && (list[list.length - 1] === '' || list[list.length - 1] === '_')) list.pop();
    return nested ? `G${v.n}{${list.join('-')}}` : `${v.n}(${list.join(',')})`;
  }
  if (v.t === 'math') {
    const head = v.first ? valueText(v.first, true) : '0';
    const rest = (v.tail || []).map((t) => `${t.op || '+'}${t.val ? valueText(t.val, true) : '0'}`).join('');
    return `math(${head}${rest})`;
  }
  return '_';
}

function logicOf(b) {
  return ['and', 'or', 'xor'].includes(b.logic) ? b.logic : 'none';
}

function condsText(b) {
  const list = Array.isArray(b.conds) && b.conds.length ? b.conds : [{ left: b.left, op: b.op, right: b.right }];
  const head = logicOf(b) === 'none' ? '' : `${logicOf(b).toUpperCase()},`;
  const body = list.map((c) => {
    const left = c && c.left ? valueText(c.left, true) : 'VALUE_0';
    const right = c && c.right ? valueText(c.right, true) : 'VALUE_0';
    return `${left}${(c && c.op) || '>'}${right}`;
  }).join(',');
  return head + body;
}

export function stmtText(b) {
  if (!b) return '';
  if (b.k === 'cons') {
    const list = (b.a || []).map((x) => (x ? valueText(x, true) : ''));
    while (list.length && (list[list.length - 1] === '' || list[list.length - 1] === '_')) list.pop();
    return `${b.n}(${list.join(',')})`;
  }
  if (b.k === 'assign') return `${b.var || 'VALUE_0'}:${valueText(b.val)}`;
  if (b.k === 'raw') return String(b.text || '');
  if (b.k === 'if' || b.k === 'ifnot') {
    const kw = b.k === 'ifnot' ? 'IFNOT' : 'IF';
    const kids = (b.body || []).map(stmtText).filter(Boolean).join(':');
    return `${kw}(${condsText(b)})${kids ? ':' + kids : ''}`;
  }
  if (b.k === 'continueif') return `CONTINUEIF(${condsText(b)})`;
  return '';
}

export function hatText(b) {
  const args = timingArgs(b.v) || [];
  const parts = [];
  if (args.includes('face') || args.includes('crit')) {
    parts.push(args.includes('face') ? (b.face || 'None') : 'None');
    parts.push(args.includes('crit') ? (b.crit || 'None') : 'None');
  }
  if (args.includes('keyword') && b.kw) parts.push(String(b.kw));
  if (args.includes('key') && b.key) parts.push(String(b.key));
  const nonEmpty = parts.filter((x) => x && x !== 'None').length > 0;
  return nonEmpty ? `TIMING:${b.v}(${parts.join(',')})` : `TIMING:${b.v}`;
}

function ensurePrefix(code) {
  const text = String(code || '').trim();
  if (!text) return '';
  return text.startsWith(PREFIX) ? text : PREFIX + text.replace(/^\/+/, '');
}

/**
 * 编译为「一行一条脚本」。
 * 返回 [{ key, timing, code, manual }]，key 为时点块的根层下标（手改以它为键）。
 */
export function compileTimingRows(program) {
  const blocks = Array.isArray(program && program.blocks) ? program.blocks : [];
  const manual = (program && program.manual && typeof program.manual === 'object') ? program.manual : {};
  const rows = [];
  blocks.forEach((b, index) => {
    if (!b) return;
    if (b.k !== 'timing') return;
    const parts = [hatText(b)];
    if (b.loop && b.loop.n) parts.push(`LOOP:${valueText(b.loop, true)}`);
    for (const it of b.body || []) {
      const t = stmtText(it);
      if (t) parts.push(t);
    }
    const key = String(index);
    const hand = manual[key];
    const code = typeof hand === 'string' && hand.trim() ? ensurePrefix(hand) : PREFIX + parts.join('/');
    rows.push({ key, timing: String(b.v || ''), code, manual: Boolean(hand && String(hand).trim()) });
  });
  return rows;
}

/** 编译为脚本字符串数组（可直接写进 abilityScriptList / requireIDList / list[].ability） */
export function compileProgram(program) {
  return compileTimingRows(program).map((r) => r.code);
}
