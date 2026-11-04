import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { cpSync } from 'node:fs';
import { readJson, writeFileAtomic } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { workbenchDir } from './state.mjs';
import { ENGINE_TIMINGS } from '../knowledge/timings.mjs';
import { canonicalCommand } from '../knowledge/modular-tables.mjs';
import { SCOPE_IDS, timingAllowed, commandAllowed, scopeZh } from '../knowledge/scopes.mjs';
import { timingArgs } from '../knowledge/timing-args.mjs';

/**
 * 编辑器侧元数据（不写进游戏数据）：
 *  - meta/skills/<mod>/<skillId>.json：修改日期、基础信息占位字段、代码区（模块/硬币）、描述草稿
 *  - meta/modules/<moduleId>.json：模块库（当前仅 3 个测试模块，模块编辑上线后由它接管）
 * 说明：字段与游戏 JSON 的映射尚未落实，见 docs/06-待落实：编辑器↔游戏映射.md
 */
export /** 时点前缀统一存英文名：老数据里可能是数字 id（0/7/14/-1），读入时换算。 */
const TIMING_ID_TO_EN = new Map(ENGINE_TIMINGS.map((t) => [String(t.id), t.en]));
function normalizePrefix(prefix) {
  const raw = String(prefix ?? '').trim();
  if (!raw) return '';
  return TIMING_ID_TO_EN.get(raw) || raw;
}
const META_VERSION = 1;

export const DEFAULT_INFO = {
  basePower: 4,
  coinCount: 1,
  atkCorrection: 0,
  targetNum: 1,
  physical: 'SLASH',
  sin: 'AZURE',
  sign: 'positive',
};

/** 物理属性：与游戏 atkType 枚举一一对应（突刺=PENETRATE、打击=HIT） */
export const PHYSICAL_TYPES = [
  { id: 'SLASH', zh: '斩击' },
  { id: 'HIT', zh: '打击' },
  { id: 'PENETRATE', zh: '突刺' },
  { id: 'NONE', zh: '无' },
];
/** 罪孽属性：严格按 dumpedData/limbus_locale/EN/attributeList.json 的 9 条顺序
 *  NEUTRAL 是 attributeType 的合法取值（数据里 402 次），但不是 attributeList 里的罪孽，
 *  因此排在最后并标注「无属性」。 */
export const SIN_TYPES = [
  { id: 'CRIMSON', zh: '暴怒' },
  { id: 'SCARLET', zh: '色欲' },
  { id: 'AMBER', zh: '怠惰' },
  { id: 'SHAMROCK', zh: '暴食' },
  { id: 'AZURE', zh: '忧郁' },
  { id: 'INDIGO', zh: '傲慢' },
  { id: 'VIOLET', zh: '嫉妒' },
  { id: 'WHITE', zh: '疯狂' },
  { id: 'BLACK', zh: '哀叹' },
  { id: 'NEUTRAL', zh: '无属性' },
];
/** 硬币颜色：数据里出现过的枚举是 GREY/GREEN/PURPLE，RED 为保留项（样本中未出现） */
export const COIN_COLORS = [
  { id: 'GREY', zh: '灰' },
  { id: 'GREEN', zh: '绿' },
  { id: 'PURPLE', zh: '紫' },
  { id: 'RED', zh: '红' },
];
/** 旧版本占位 id（normal/red/green/purple）→ 游戏枚举 的兼容映射 */
const COIN_COLOR_ALIAS = { normal: 'GREY', grey: 'GREY', green: 'GREEN', purple: 'PURPLE', red: 'RED' };

/** 3 个测试模块：可拖动，无映射、无实际效果 */
export const TEST_MODULES = [
  { id: 'test-burn-quake', name: '测试模块 · 烧伤+震颤', desc: '[使用时]若目标的[烧伤]强度与[震颤]强度之和不低于6级，则使本技能的硬币威力+1' },
  { id: 'test-power-gain', name: '测试模块 · 硬币威力', desc: '[使用时]使本技能的硬币威力+1' },
  { id: 'test-heal-sp', name: '测试模块 · 回复理智', desc: '[命中时]恢复自身2点理智值' },
];

export const DEFAULT_PASSIVE_INFO = {
  conditionMode: 'none',
  stockConditions: [],
  resonanceConditions: [],
};

/** 被动启动条件三态（互斥）：无条件 / 资源拥有（attributeStockCondition）/ 资源共鸣（attributeResonanceCondition） */
export const PASSIVE_CONDITION_TYPES = [
  { id: 'none', zh: '无条件' },
  { id: 'stock', zh: '资源拥有' },
  { id: 'resonance', zh: '资源共鸣' },
];

export const DEFAULT_BUFF_INFO = {
  buffClass: 'NonvolatileBuff',
  buffType: 'Positive',
  canBeDespelled: true,
  maxStack: 1,
  maxTurn: 1,
  iconId: '',
  special: '',
};

/** Buff 类别：游戏枚举名，官方中文未在 locale 中给出，这里保留英文枚举并附中文说明 */
export const BUFF_CLASSES = [
  { id: 'NonvolatileBuff', zh: '常驻（NonvolatileBuff）' },
  { id: 'VolatileBuff', zh: '挥发（VolatileBuff）' },
];

/** Buff 正负：游戏文案使用「增益 / 减益」 */
export const BUFF_TYPES = [
  { id: 'Positive', zh: '增益' },
  { id: 'Negative', zh: '减益' },
  { id: 'Neutral', zh: '中性' },
];

function designRoot(letheRoot) {
  // 设计态数据统一放在 <Lethe>/LCW/projects（迁移由 lcw.mjs 的 migrateToLcw 负责）
  return join(letheRoot, 'LCW', 'projects');
}
export function metaRoot(letheRoot) {
  return designRoot(letheRoot);
}
export function modulesDir(letheRoot) { return join(metaRoot(letheRoot), 'modules'); }
export function skillsMetaDir(letheRoot, mod) { return join(metaRoot(letheRoot), 'skills', cleanName(mod, 'Mod 名称')); }
export function passivesMetaDir(letheRoot, mod) { return join(metaRoot(letheRoot), 'passives', cleanName(mod, 'Mod 名称')); }
export function buffsMetaDir(letheRoot, mod) { return join(metaRoot(letheRoot), 'buffs', cleanName(mod, 'Mod 名称')); }

export function normalizeId(id) {
  const s = String(id ?? '').trim();
  if (!/^\d{3,10}$/.test(s)) throw new SafetyError('技能 id 必须是 3–10 位数字');
  return s;
}

function nowIso() { return new Date().toISOString(); }

/** 硬币颜色归一：兼容旧占位 id（normal/red/green/purple）与游戏枚举（GREY/GREEN/PURPLE/RED） */
export function coinColor(value) {
  const raw = String(value ?? '').trim();
  const id = COIN_COLOR_ALIAS[raw] || COIN_COLOR_ALIAS[raw.toLowerCase()] || raw;
  return COIN_COLORS.some((x) => x.id === id) ? id : 'GREY';
}

function padCoins(coins, count) {
  const list = Array.isArray(coins) ? coins.slice(0, count) : [];
  while (list.length < count) list.push({ color: 'GREY', value: 0, modules: [] });
  return list.map((c) => ({
    color: coinColor(c && c.color),
    value: Number(c && c.value) || 0,
    modules: Array.isArray(c && c.modules) ? [...c.modules] : [],
  }));
}

function normalizeSkillMeta(doc, id) {
  const src = doc && typeof doc === 'object' ? doc : {};
  const info = { ...DEFAULT_INFO, ...(src.info || {}) };
  const count = Math.max(1, Math.min(12, Number(info.coinCount) || 1));
  info.coinCount = count;
  const code = src.code && typeof src.code === 'object' ? src.code : {};
  return {
    version: META_VERSION,
    id: String(id),
    updatedAt: src.updatedAt || '',
    createdAt: src.createdAt || '',
    info,
    code: {
      skill: Array.isArray(code.skill) ? code.skill.map(String) : [],
      coins: padCoins(code.coins, count),
    },
    description: typeof src.description === 'string' ? src.description : '',
    coinDescs: padStrings(src.coinDescs, count),
  };
}

function padStrings(list, count) {
  const src = Array.isArray(list) ? list : [];
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(typeof src[i] === 'string' ? src[i] : '');
  return out;
}

export function skillMetaPath(letheRoot, mod, id) {
  return join(skillsMetaDir(letheRoot, mod), `${normalizeId(id)}.json`);
}

export function skillCodePath(letheRoot, mod, id) {
  return join(skillsMetaDir(letheRoot, mod), `${normalizeId(id)}.code.json`);
}

export function readSkillMeta(letheRoot, mod, id) {
  const doc = readJson(skillMetaPath(letheRoot, mod, id), null) || {};
  const codeDoc = readJson(skillCodePath(letheRoot, mod, id), null);
  return normalizeSkillMeta({ ...doc, code: codeDoc && codeDoc.code ? codeDoc.code : (doc.code || {}) }, id);
}

/**
 * 写入技能元数据（草稿）。返回变更记录，可直接交给 EditSession 记录撤销。
 * patch: { info?, code?, description?, touch?: boolean }
 */
export function writeSkillMeta(letheRoot, mod, id, patch = {}) {
  const p = skillMetaPath(letheRoot, mod, id);
  const before = existsSync(p) ? readFileSync(p, 'utf8') : null;
  const prev = normalizeSkillMeta(before ? JSON.parse(before) : null, id);
  const next = normalizeSkillMeta({
    ...prev,
    info: { ...prev.info, ...(patch.info || {}) },
    description: patch.description !== undefined ? patch.description : prev.description,
    coinDescs: patch.coinDescs !== undefined ? patch.coinDescs : prev.coinDescs,
    updatedAt: patch.touch === false ? prev.updatedAt : nowIso(),
  }, id);
  const after = JSON.stringify(next, null, 2);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileAtomic(p, after);
  return { rel: null, abs: p, before, after, doc: next };
}


/** 代码区（模块/硬币）：独立文件，不进撤销栈 */
export function writeSkillCode(letheRoot, mod, id, code = {}) {
  const p = skillCodePath(letheRoot, mod, id);
  const before = existsSync(p) ? readFileSync(p, 'utf8') : null;
  const prev = readJson(p, null) || {};
  const prevCoins = prev.code && Array.isArray(prev.code.coins) ? prev.code.coins : [];
  const count = Math.max(1, Math.min(12, Number(code.coinCount) || (code.coins ? code.coins.length : prevCoins.length) || 1));
  const doc = {
    version: META_VERSION,
    id: String(id),
    updatedAt: nowIso(),
    code: {
      skill: Array.isArray(code.skill) ? code.skill.map(String) : (Array.isArray(prev.code?.skill) ? prev.code.skill : []),
      coins: padCoins(Array.isArray(code.coins) ? code.coins : prevCoins, count),
    },
  };
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileAtomic(p, JSON.stringify(doc, null, 2));
  return { rel: null, abs: p, before, after: JSON.stringify(doc, null, 2), doc: { ...doc } };
}

/* ----------------------------- 被动 / buff 元数据 ----------------------------- */

function normPassiveConds(list, fallback = []) {
  const arr = Array.isArray(list) && list.length ? list : fallback;
  const seen = new Set();
  const out = [];
  for (const c of arr) {
    if (!c || typeof c !== 'object') continue;
    const type = String(c.type || '');
    if (!SIN_TYPES.some((x) => x.id === type)) continue;
    if (seen.has(type)) continue;
    seen.add(type);
    out.push({ type, value: Math.max(1, Math.min(99, Number(c.value) || 1)) });
  }
  return out;
}

function normalizePassiveMeta(doc, id) {
  const src = doc && typeof doc === 'object' ? doc : {};
  const raw = src.info && typeof src.info === 'object' ? src.info : {};
  const info = { ...DEFAULT_PASSIVE_INFO };
  const legacyCond = raw.sin || raw.count
    ? [{ type: String(raw.sin || 'CRIMSON'), value: Math.max(1, Math.min(99, Number(raw.count) || 1)) }]
    : [];
  info.conditionMode = raw.conditionMode === 'stock' || raw.conditionMode === 'resonance'
    ? raw.conditionMode
    : (raw.needCondition ? (raw.conditionType === 'resonance' ? 'resonance' : 'stock') : 'none');
  info.stockConditions = normPassiveConds(raw.stockConditions, info.conditionMode === 'none' ? [] : legacyCond);
  info.resonanceConditions = normPassiveConds(raw.resonanceConditions, []).slice(0, 1);
  if (info.conditionMode === 'stock') info.resonanceConditions = [];
  else if (info.conditionMode === 'resonance') info.stockConditions = [];
  const code = src.code && typeof src.code === 'object' ? src.code : {};
  return {
    version: META_VERSION,
    id: String(id),
    updatedAt: src.updatedAt || '',
    createdAt: src.createdAt || '',
    info,
    code: { modules: Array.isArray(code.modules) ? code.modules.map(String) : [] },
    description: typeof src.description === 'string' ? src.description : '',
  };
}

function normalizeBuffMeta(doc, id) {
  const src = doc && typeof doc === 'object' ? doc : {};
  const info = { ...DEFAULT_BUFF_INFO, ...(src.info || {}) };
  info.maxStack = Math.max(1, Math.min(999, Number(info.maxStack) || 1));
  info.maxTurn = Math.max(-1, Math.min(999, Number(info.maxTurn) || 1));
  if (!BUFF_CLASSES.some((x) => x.id === info.buffClass)) info.buffClass = 'NonvolatileBuff';
  if (!BUFF_TYPES.some((x) => x.id === info.buffType)) info.buffType = 'Positive';
  const code = src.code && typeof src.code === 'object' ? src.code : {};
  return {
    version: META_VERSION,
    id: String(id),
    updatedAt: src.updatedAt || '',
    createdAt: src.createdAt || '',
    info,
    code: { modules: Array.isArray(code.modules) ? code.modules.map(String) : [] },
    description: typeof src.description === 'string' ? src.description : '',
  };
}

function readMetaDoc(p, norm, id) {
  const doc = readJson(p, null) || {};
  return norm(doc, id);
}

function writeMetaDoc(p, norm, id, patch = {}) {
  const before = existsSync(p) ? readFileSync(p, 'utf8') : null;
  const prev = norm(before ? JSON.parse(before) : null, id);
  const next = norm({
    ...prev,
    info: { ...prev.info, ...(patch.info || {}) },
    code: { ...prev.code, ...(patch.code || {}) },
    description: patch.description !== undefined ? patch.description : prev.description,
    updatedAt: patch.touch === false ? prev.updatedAt : nowIso(),
  }, id);
  const after = JSON.stringify(next, null, 2);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileAtomic(p, after);
  return { rel: null, abs: p, before, after, doc: next };
}

export function passiveMetaPath(letheRoot, mod, id) { return join(passivesMetaDir(letheRoot, mod), String(id) + '.json'); }
export function readPassiveMeta(letheRoot, mod, id) { return readMetaDoc(passiveMetaPath(letheRoot, mod, id), normalizePassiveMeta, id); }
export function writePassiveMeta(letheRoot, mod, id, patch = {}) { return writeMetaDoc(passiveMetaPath(letheRoot, mod, id), normalizePassiveMeta, id, patch); }

export function buffMetaPath(letheRoot, mod, id) { return join(buffsMetaDir(letheRoot, mod), String(id) + '.json'); }
export function readBuffMeta(letheRoot, mod, id) { return readMetaDoc(buffMetaPath(letheRoot, mod, id), normalizeBuffMeta, id); }
export function writeBuffMeta(letheRoot, mod, id, patch = {}) { return writeMetaDoc(buffMetaPath(letheRoot, mod, id), normalizeBuffMeta, id, patch); }

/* --------------------------------- 模块库 --------------------------------- */

export const MODULE_KINDS = [
  { id: 'skill', zh: '技能' },
  { id: 'passive', zh: '被动' },
  { id: 'buff', zh: 'Buff' },
];

function safeModuleId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, ''); }
function modulePath(letheRoot, id) { return join(modulesDir(letheRoot), safeModuleId(id) + '.json'); }

/** 首次读取时生成 3 个测试模块；之后不再改动已有模块 */
export function ensureTestModules(letheRoot) {
  const dir = modulesDir(letheRoot);
  mkdirSync(dir, { recursive: true });
  if (existsSync(join(dir, '.no-test-modules'))) return [];
  const created = [];
  TEST_MODULES.forEach((m, i) => {
    const p = modulePath(letheRoot, m.id);
    if (existsSync(p)) return;
    const at = new Date(Date.now() - (TEST_MODULES.length - i) * 60_000).toISOString();
    const doc = { version: META_VERSION, id: m.id, name: m.name, desc: m.desc, prefix: '', kind: 'skill', test: true, editable: false, createdAt: at, updatedAt: at };
    writeFileAtomic(p, JSON.stringify(doc, null, 2));
    created.push(doc);
  });
  return created;
}


/* ------------------------------ 模块积木程序 ------------------------------ */
const PROG_MAX_NODES = 400;
const PROG_MAX_DEPTH = 8;
const BLOCK_KINDS = new Set(['timing', 'loop', 'cons', 'if', 'ifnot', 'continueif', 'assign', 'raw']);
const LOGIC_KINDS = new Set(['none', 'and', 'or', 'xor']);
const VALUE_KINDS = new Set(['acq', 'target', 'var', 'n', 's', 'math']);
const MATH_OPS = new Set(['+', '-', '*', '%', '!', '¡', '?']);
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TARGET_RE = /^[A-Za-z][A-Za-z0-9_]*(?:[+$][A-Za-z0-9_$]*)*$/;

function pushValue(raw, depth, budget) {
  if (!raw || typeof raw !== 'object') return null;
  if (++budget.nodes > PROG_MAX_NODES) throw new SafetyError('模块积木太多');
  const t = String(raw.t || '');
  if (!VALUE_KINDS.has(t)) return null;
  if (t === 'acq') {
    const n = canonicalCommand('acquirer', String(raw.n || ''));
    if (!NAME_RE.test(n)) throw new SafetyError('获取函数名不合法：' + n);
    const args = Array.isArray(raw.a) ? raw.a.map((x) => pushValue(x, depth + 1, budget)) : [];
    return { t, n, a: args.slice(0, 10) };
  }
  if (t === 'math') {
    const first = raw.first ? pushValue(raw.first, depth + 1, budget) : null;
    const rawTail = Array.isArray(raw.tail) ? raw.tail.slice(0, 8) : [];
    const tail = [];
    for (const item of rawTail) {
      if (!item || typeof item !== 'object') continue;
      const op = String(item.op || '+');
      if (!MATH_OPS.has(op)) throw new SafetyError('运算符不合法：' + op);
      tail.push({ op, val: item.val ? pushValue(item.val, depth + 1, budget) : null });
    }
    return { t, first, tail };
  }
  if (t === 'target') {
    const n = String(raw.n || '');
    if (!TARGET_RE.test(n)) throw new SafetyError('目标选择器不合法：' + n);
    const rawC = raw.c === null || raw.c === undefined ? '' : String(raw.c).trim();
    let c = null;
    if (rawC !== '') {
      if (/^VALUE_\d+$/.test(rawC)) c = rawC;
      else {
        const num = Number(rawC);
        if (!Number.isFinite(num)) throw new SafetyError('目标数量不合法：' + rawC);
        c = Math.max(0, Math.min(999, Math.trunc(num)));
      }
    }
    return { t, n, c };
  }
  if (t === 'var') {
    const n = String(raw.n || '');
    if (!/^VALUE_\d+$/.test(n)) throw new SafetyError('VALUE 变量不合法：' + n);
    return { t, n };
  }
  if (t === 'n') {
    const v = Number(raw.v);
    if (!Number.isFinite(v)) throw new SafetyError('数值不合法');
    return { t, v: Math.trunc(v) };
  }
  return { t, v: String(raw.v ?? '').slice(0, 200) };
}

function pushStmt(raw, depth, budget) {
  if (!raw || typeof raw !== 'object') return null;
  if (depth > PROG_MAX_DEPTH) throw new SafetyError('模块积木层级过深');
  if (++budget.nodes > PROG_MAX_NODES) throw new SafetyError('模块积木太多');
  const k = String(raw.k || '');
  if (!BLOCK_KINDS.has(k)) return null;
  if (k === 'timing' || k === 'loop') {
    const v = String(raw.v || '');
    const re = k === 'loop' ? TARGET_RE : NAME_RE;
    if (!re.test(v)) throw new SafetyError((k === 'loop' ? '循环目标不合法：' : '时点名不合法：') + v);
    if (k === 'loop') return { k, v, body: Array.isArray(raw.body) ? raw.body.map((x) => pushStmt(x, depth + 1, budget)).filter(Boolean) : [] };
    const fa = timingArgs(v);
    const out = { k, v };
    if (fa.includes('face')) out.face = ['None', 'Head', 'Tail'].includes(String(raw.face)) ? String(raw.face) : 'None';
    if (fa.includes('crit')) out.crit = ['None', 'Crit', 'NoCrit'].includes(String(raw.crit)) ? String(raw.crit) : 'None';
    if (fa.includes('keyword')) {
      const kw = String(raw.kw || '').trim();
      if (kw && !NAME_RE.test(kw)) throw new SafetyError('关键词不合法：' + kw);
      if (kw) out.kw = kw;
    }
    if (fa.includes('key')) {
      const key = String(raw.key || '').trim();
      if (key && !NAME_RE.test(key)) throw new SafetyError('按键名不合法：' + key);
      if (key) out.key = key;
    }
    if (raw.loop && typeof raw.loop === 'object') {
      const ln = String(raw.loop.n || raw.loop.v || '');
      if (!TARGET_RE.test(ln)) throw new SafetyError('遍历目标不合法：' + ln);
      const rawC = raw.loop.c === null || raw.loop.c === undefined ? '' : String(raw.loop.c).trim();
      let c = null;
      if (rawC !== '') {
        if (/^VALUE_\d+$/.test(rawC)) c = rawC;
        else {
          const num = Number(rawC);
          if (!Number.isFinite(num)) throw new SafetyError('遍历数量不合法：' + rawC);
          c = Math.max(0, Math.min(999, Math.trunc(num)));
        }
      }
      out.loop = { t: 'target', n: ln, c };
    } else {
      out.loop = null;
    }
    out.body = Array.isArray(raw.body) ? raw.body.map((x) => pushStmt(x, depth + 1, budget)).filter(Boolean) : [];
    return out;
  }
  if (k === 'assign') {
    const v = String(raw.var || '');
    if (!/^VALUE_\d+$/.test(v)) throw new SafetyError('VALUE 变量不合法：' + v);
    return { k, var: v, val: raw.val ? pushValue(raw.val, depth + 1, budget) : null };
  }
  if (k === 'cons') {
    const n = canonicalCommand('consequence', String(raw.n || ''));
    if (!NAME_RE.test(n)) throw new SafetyError('函数名不合法：' + n);
    const a = Array.isArray(raw.a) ? raw.a.map((x) => pushValue(x, depth + 1, budget)) : [];
    return { k, n, a: a.slice(0, 12) };
  }
  if (k === 'raw') {
    const text = String(raw.text || '').trim();
    if (!text) return null;
    return { k, text: text.slice(0, 300) };
  }

  // if / ifnot / continueif
  const logic = LOGIC_KINDS.has(String(raw.logic)) ? String(raw.logic) : 'none';
  const rawConds = Array.isArray(raw.conds) && raw.conds.length ? raw.conds : [{ left: raw.left, op: raw.op, right: raw.right }];
  const conds = rawConds.slice(0, 8).map((c) => {
    const cc = c || {};
    const op = ['>', '<', '='].includes(String(cc.op)) ? String(cc.op) : '>';
    return { left: pushValue(cc.left, depth + 1, budget), op, right: pushValue(cc.right, depth + 1, budget) };
  });
  const out = { k, logic, conds };
  if (k !== 'continueif') out.body = Array.isArray(raw.body) ? raw.body.map((x) => pushStmt(x, depth + 1, budget)).filter(Boolean) : [];
  return out;
}

/** 规范化并校验积木程序；非法结构抛 SafetyError */
export function foldLegacyLoops(list) {
  const out = [];
  for (const b of list || []) {
    if (!b) continue;
    if (b.k === 'loop') {
      const host = out.length ? out[out.length - 1] : null;
      const body = Array.isArray(b.body) ? foldLegacyLoops(b.body) : [];
      if (host && host.k === 'timing') {
        host.loop = { t: 'target', n: String(b.v || 'Target'), c: null };
        host.body = (host.body || []).concat(body);
      } else if (body.length) {
        out.push(...body);
      }
      continue;
    }
    if (Array.isArray(b.body)) b.body = foldLegacyLoops(b.body);
    if (b.k === 'timing' && b.loop === undefined) b.loop = null;
    out.push(b);
  }
  return out;
}

/** 规范化并校验积木程序；非法结构抛 SafetyError */
export function normalizeProgram(raw) {
  const budget = { nodes: 0 };
  const blocks = Array.isArray(raw && raw.blocks) ? raw.blocks : [];
  const out = foldLegacyLoops(blocks.map((x) => pushStmt(x, 0, budget)).filter(Boolean));
  const manual = {};
  const src = raw && raw.manual && typeof raw.manual === 'object' ? raw.manual : {};
  let n = 0;
  for (const key of Object.keys(src)) {
    if (n >= 200) break;
    if (!/^\d+$/.test(key)) continue;
    const v = String(src[key] || '');
    if (!v) continue;
    if (v.length > 4000) throw new SafetyError('手改代码过长（上限 4000 字符）');
    manual[key] = v;
    n++;
  }
  return { version: 1, blocks: out, manual };
}

/** 统计程序里的语句块数量（给列表展示用） */
export function countProgramBlocks(program) {
  let n = 0;
  const walk = (list) => {
    for (const b of list || []) {
      n++;
      if (b && Array.isArray(b.body)) walk(b.body);
    }
  };
  walk(program && program.blocks);
  return n;
}

/** 写入模块积木程序（不进撤销栈，纯拖拽产物） */
function denyProgramBlocks(scope, program) {
  const bad = [];
  const walkValue = (v) => {
    if (!v || typeof v !== 'object') return;
    if (v.t === 'acq') {
      if (!commandAllowed(scope, String(v.n))) bad.push(String(v.n));
      for (const x of v.a || []) walkValue(x);
    }
    if (v.t === 'math') { walkValue(v.first); for (const t of v.tail || []) walkValue(t.val); }
  };
  const walk = (list) => {
    for (const b of list || []) {
      if (!b) continue;
      if (b.k === 'timing') { if (!timingAllowed(scope, String(b.v))) bad.push(String(b.v)); }
      else if (b.k === 'cons') { if (!commandAllowed(scope, String(b.n))) bad.push(String(b.n)); for (const x of b.a || []) walkValue(x); }
      else if (b.k === 'if' || b.k === 'ifnot' || b.k === 'continueif') {
        for (const c of b.conds || []) { walkValue(c && c.left); walkValue(c && c.right); }
      }
      if (Array.isArray(b.body)) walk(b.body);
    }
  };
  walk(program.blocks);
  return [...new Set(bad)];
}

export function writeModuleProgram(letheRoot, id, program, opts = {}) {
  const p = modulePath(letheRoot, id);
  const doc = readJson(p, null);
  if (!doc) throw new SafetyError('模块不存在');
  if (opts.expectUpdatedAt && doc.updatedAt && String(doc.updatedAt) !== String(opts.expectUpdatedAt) && !opts.force) {
    const conflict = new SafetyError('模块文件在磁盘上已被修改（可能是本机另一个窗口，或有人直接改了文件）');
    conflict.status = 409;
    throw conflict;
  }
  if (doc.test || doc.editable === false) throw new SafetyError('测试模块不可编辑');
  const clean = normalizeProgram(program);
  const legacy = doc.scope === undefined || doc.scope === null;
  const scope = SCOPE_IDS.includes(doc.scope) ? doc.scope : 'common';
  const bad = legacy ? [] : denyProgramBlocks(scope, clean);
  if (bad.length) throw new SafetyError('「' + scopeZh(scope) + '」用途的模块不能使用：' + bad.join('、'));
  const next = { ...doc, program: clean, blockCount: countProgramBlocks(clean), updatedAt: nowIso() };
  writeFileAtomic(p, JSON.stringify(next, null, 2));
  return moduleDocOf(next);
}

function moduleDocOf(doc) {
  return {
    id: String(doc.id),
    name: String(doc.name || doc.id),
    desc: String(doc.desc || ''),
    prefix: normalizePrefix(doc.prefix),
    kind: String(doc.kind || 'skill'),
    scope: SCOPE_IDS.includes(doc.scope) ? doc.scope : 'common',
    test: Boolean(doc.test),
    editable: doc.editable !== false,
    createdAt: doc.createdAt || '',
    updatedAt: doc.updatedAt || doc.createdAt || '',
    program: doc.program && Array.isArray(doc.program.blocks) ? doc.program : { version: 1, blocks: [] },
    blockCount: Number(doc.blockCount || 0),
  };
}

export function listModules(letheRoot) {
  ensureTestModules(letheRoot);
  const dir = modulesDir(letheRoot);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const doc = readJson(join(dir, f), null);
    if (!doc || !doc.id) continue;
    out.push(moduleDocOf(doc));
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getModule(letheRoot, id) {
  const doc = readJson(modulePath(letheRoot, id), null);
  return doc ? moduleDocOf(doc) : null;
}

export function createModule(letheRoot, { name, desc = '', prefix = '', kind = 'skill', scope = 'common' }) {
  const n = String(name || '').trim();
  if (!n) throw new SafetyError('模块名称不能为空');
  const id = 'mod-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const at = nowIso();
  const sc = SCOPE_IDS.includes(scope) ? scope : 'common';
  const doc = { version: META_VERSION, id, name: n, desc: String(desc), prefix: normalizePrefix(prefix), kind: String(kind || 'skill'), scope: sc, test: false, editable: true, createdAt: at, updatedAt: at };
  writeFileAtomic(modulePath(letheRoot, id), JSON.stringify(doc, null, 2));
  return moduleDocOf(doc);
}

export function updateModule(letheRoot, id, patch = {}) {
  const p = modulePath(letheRoot, id);
  const doc = readJson(p, null);
  if (!doc) throw new SafetyError('模块不存在');
  if (doc.test || doc.editable === false) throw new SafetyError('测试模块不可编辑');
  const next = {
    ...doc,
    name: patch.name !== undefined ? String(patch.name).trim() || doc.name : doc.name,
    desc: patch.desc !== undefined ? String(patch.desc) : doc.desc,
    prefix: patch.prefix !== undefined ? normalizePrefix(patch.prefix) : normalizePrefix(doc.prefix),
    kind: patch.kind !== undefined ? String(patch.kind) : (doc.kind || 'skill'),
    scope: patch.scope !== undefined && SCOPE_IDS.includes(patch.scope) ? patch.scope : (SCOPE_IDS.includes(doc.scope) ? doc.scope : 'common'),
    updatedAt: nowIso(),
  };
  writeFileAtomic(p, JSON.stringify(next, null, 2));
  return moduleDocOf(next);
}

export function deleteModule(letheRoot, id, opts = {}) {
  const p = modulePath(letheRoot, id);
  const doc = readJson(p, null);
  if (!doc) throw new SafetyError('模块不存在');
  if (doc.test || doc.editable === false) {
    if (!opts.allowTest) throw new SafetyError('测试模块不可删除');
    mkdirSync(modulesDir(letheRoot), { recursive: true });
    writeFileAtomic(join(modulesDir(letheRoot), '.no-test-modules'), String(nowIso()));
  }
  unlinkSync(p);
  return { ok: true };
}

