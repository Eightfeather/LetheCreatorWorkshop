import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_TIMINGS } from '../knowledge/timings.mjs';

/**
 * 描述里 `[xxx]` 前缀的来源（互不重合，分别维护）：
 *  1) 引擎时点（timing）：86 条 Modular 时点（TIMING:<name|id> 用），13 条游戏内置中文名 + 12 条教程可读名
 *  2) 显示时点（displayTiming）：skillTagList.json 里「带时/后/开始时/结束时/前」的段落标签，
 *     如 [正面命中时]=OnSucceedAttackHead、[击杀敌方时]=EnemyKill。它们是描述里的时点分段，
 *     但不在 86 条引擎时点里（不能直接写进 TIMING:），语义上仍属「时点」而非普通标签。
 *  3) 技能标签（tag）：skillTagList.json 里剩下的非时点标签（[群体技能]/[无法拼点]/[正面]/[常驻] 等）
 *  4) Buff（buff）：bufList.json + 各 Mod 的 bufList/keywordList + custom_buffs/*.txt
 *  5) 关键词（keyword）：keywordList.json + 各 Mod 的 keywordList
 * 另有 9 条罪孽名（sins）来自 skillTagList 的 CRIMSON…BLACK，属性下拉里单独使用，不参与描述分段。
 * 同一个中文名可能对应多个 id（如「苦难」有 24 个 id），这里保留全部候选：
 *  tokens[].candidates 给出全部 id，tokens[].id 给出默认（第一个）候选。
 */

const strip = (s) => String(s ?? '')
  .replace(/<[^>]*>/g, '')
  .replace(/^\[/, '')
  .replace(/\]$/, '')
  .trim();

function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function entriesOf(doc) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc.list)) return doc.list;
  if (typeof doc !== 'object') return [];
  return Object.entries(doc).map(([k, v]) => (v && typeof v === 'object' ? { id: k, ...v } : { id: k, name: v }));
}

const hasCjk = (s) => /[\u3400-\u9fff]/.test(s);

const cache = new Map();

function stampOf(letheRoot) {
  const parts = [];
  const push = (p) => {
    try { const s = statSync(p); parts.push(`${p}:${s.mtimeMs}`); } catch { parts.push(`${p}:-`); }
  };
  const en = join(letheRoot, 'dumpedData', 'limbus_locale', 'EN');
  push(join(en, 'skillTagList.json'));
  push(join(en, 'bufList.json'));
  push(join(en, 'keywordList.json'));
  push(join(en, 'attributeList.json'));
  push(join(letheRoot, 'mods'));
  return parts.join('|');
}

function pushName(map, name, id) {
  const key = strip(name);
  if (!key || !hasCjk(key)) return;
  if (String(id || '') === key) return;
  const cur = map.get(key);
  if (!cur) map.set(key, [String(id)]);
  else if (!cur.includes(String(id))) cur.push(String(id));
}

export function keywordTables(letheRoot) {
  const stamp = stampOf(letheRoot);
  const hit = cache.get(letheRoot);
  if (hit && hit.stamp === stamp) return hit.tables;

  const en = join(letheRoot, 'dumpedData', 'limbus_locale', 'EN');
  const tagById = new Map();
  for (const e of entriesOf(readJsonSafe(join(en, 'skillTagList.json')))) {
    const id = String(e.id ?? '');
    const zh = strip(e.name);
    if (id) tagById.set(id, zh);
  }

  const timings = ENGINE_TIMINGS.map((t) => ({ id: t.id, en: t.en, zh: t.zh || tagById.get(t.en) || '' }));
  const timingIds = new Set(timings.map((t) => t.en));

  // 技能标签：skillTagList 里去掉 86 条引擎时点与罪孽名（罪孽在属性下拉里单独给）。
  // 其中「带时/后/开始时/结束时/前/计数/阶段」的是**显示时点**（描述分段用，不能写进 TIMING:），
  // 单独成表；剩下的才是真正的技能标签（[群体技能]/[无法拼点]/[正面]/[常驻]…）。
  // 少数标签没有中文名（如 TabExplain 的 name 为空），它们是合法的「纯 id 标签」，
  // 在描述里以 [TabExplain] 出现，因此保留 id、zh 置空。
  const sinNames = new Set(['暴怒', '色欲', '怠惰', '暴食', '忧郁', '傲慢', '嫉妒', '疯狂', '哀叹']);
  const TIMING_LIKE = /时$|后$|开始时$|结束时$|前$|计数$|阶段$/;
  const displayTimings = [];
  const tags = [];
  const sins = [];
  for (const [id, zh] of tagById) {
    if (timingIds.has(id)) continue;
    if (sinNames.has(zh)) { sins.push({ id, zh }); continue; }
    const clean = String(zh || '').replace(/^\[|\]$/g, '').trim();
    if (clean && TIMING_LIKE.test(clean)) { displayTimings.push({ id, zh: clean }); continue; }
    tags.push({ id, zh });
  }
  displayTimings.sort((a, b) => String(a.zh).localeCompare(String(b.zh), 'zh'));
  tags.sort((a, b) => (a.zh || '~').localeCompare(b.zh || '~', 'zh'));
  sins.sort((a, b) => String(a.zh).localeCompare(String(b.zh), 'zh'));

  // Buff：原版 bufList + 各 Mod 的 bufList/keywordList + custom_buffs 注册文件
  const buffNameIds = new Map();
  const buffIds = new Map();       // id -> zh（可空：custom_buffs 只有 id）
  const buffNative = new Map();    // id -> 原文名（可能是韩文/英文，给没有中文名的 buff 兜底显示）
  const buffSource = new Map();
  const buffMod = new Map();
  const modBuffIds = new Map(); // Mod 名 -> Set(id)
  const buffOwners = new Map(); // id -> Set(Mod 名)
  const own = (modName, id) => {
    const key = String(id || '').trim();
    if (!modName || !key) return;
    if (!modBuffIds.has(modName)) modBuffIds.set(modName, new Set());
    modBuffIds.get(modName).add(key);
    if (!buffOwners.has(key)) buffOwners.set(key, new Set());
    buffOwners.get(key).add(modName);
  };
  const addBuff = (id, name, source, modName) => {
    const key = String(id || '').trim();
    if (!key) return;
    if (!buffSource.has(key)) buffSource.set(key, source || 'vanilla');
    if (modName && !buffMod.has(key)) buffMod.set(key, modName);
    const raw = strip(name);
    if (raw && !buffNative.has(key)) buffNative.set(key, raw);
    const zh = hasCjk(raw) ? raw : '';
    if (!buffIds.has(key)) buffIds.set(key, zh);
    if (zh) pushName(buffNameIds, zh, key);
  };
  for (const e of entriesOf(readJsonSafe(join(en, 'bufList.json')))) addBuff(e.id, e.name, 'vanilla');

  let modNames = [];
  try { modNames = readdirSync(join(letheRoot, 'mods'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch {}
  for (const mod of modNames) {
    const base = join(letheRoot, 'mods', mod);
    for (const dir of ['bufList', 'keywordList']) {
      const p = join(base, 'custom_limbus_locale', 'EN', dir);
      if (!existsSync(p)) continue;
      for (const f of readdirSync(p)) {
        for (const e of entriesOf(readJsonSafe(join(p, f)))) { addBuff(e.id, e.name, 'mod', mod); own(mod, e.id); }
      }
    }
    // Mod 数据文件里声明的 Buff 实体（没有 locale 名时用 id 兜底，保证"能检测到就一定列出来"）
    try {
      const bdir = join(base, 'custom_limbus_data', 'buff');
      if (existsSync(bdir)) {
        for (const f of readdirSync(bdir)) {
          if (!/\.json$/i.test(f)) continue;
          const doc = readJsonSafe(join(bdir, f));
          const arr = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.list) ? doc.list : (doc && doc.id ? [doc] : []));
          for (const e of arr) if (e && e.id) { addBuff(e.id, e.name || '', 'mod', mod); own(mod, e.id); }
        }
      }
    } catch { /* 坏文件忽略 */ }
    const cb = join(base, 'custom_buffs');
    if (existsSync(cb)) {
      for (const f of readdirSync(cb)) if (/\.txt$/i.test(f)) { const bid = f.replace(/\.txt$/i, ''); addBuff(bid, '', 'mod', mod); own(mod, bid); }
    }
  }

  // 关键词：原版 keywordList + 各 Mod 的 keywordList
  const kwNameIds = new Map();
  const kwIds = new Map();
  const addKw = (id, name) => {
    const key = String(id || '').trim();
    if (!key) return;
    const zh = strip(name);
    if (zh && !kwIds.has(key)) kwIds.set(key, zh);
    if (zh) pushName(kwNameIds, zh, key);
  };
  for (const e of entriesOf(readJsonSafe(join(en, 'keywordList.json')))) addKw(e.id, e.name);
  for (const mod of modNames) {
    const p = join(letheRoot, 'mods', mod, 'custom_limbus_locale', 'EN', 'keywordList');
    if (!existsSync(p)) continue;
    for (const f of readdirSync(p)) for (const e of entriesOf(readJsonSafe(join(p, f)))) addKw(e.id, e.name);
  }

  const namedIds = new Set([...buffNameIds.values()].flat());
  const buffs = [...buffNameIds.entries()]
    .map(([zh, ids]) => ({ zh, id: ids[0], ids, native: buffNative.get(ids[0]) || zh, source: buffSource.get(ids[0]) || 'vanilla', mod: buffMod.get(ids[0]) || '', panic: /(_panic|_lowmorale)/i.test(ids[0]) || /(_\u6050\u614c|_\u4f4e\u7406\u667a)/.test(zh) }))
    .concat([...buffIds.keys()]
      .filter((id) => !namedIds.has(id))
      .map((id) => ({ zh: '', native: buffNative.get(id) || '', id, ids: [id], source: buffSource.get(id) || 'vanilla', mod: buffMod.get(id) || '', panic: /(_panic|_lowmorale)/i.test(id) })))
    .sort((a, b) => String(a.zh || a.native || a.id).localeCompare(String(b.zh || b.native || b.id), 'zh'));
  const keywords = [...kwNameIds.entries()]
    .map(([zh, ids]) => ({ zh, id: ids[0], ids }))
    .sort((a, b) => a.zh.localeCompare(b.zh, 'zh'));

  const tables = {
    timings,
    displayTimings,
    tags,
    sins,
    buffs,
    keywords,
    buffIds: [...buffIds.entries()].map(([id, zh]) => ({ id, zh })),
    modBuffs: [...modBuffIds.entries()].map(([mod, set]) => ({ mod, ids: [...set].sort((a, b) => a.localeCompare(b)) })),
    buffOwners: [...buffOwners.entries()].map(([id, set]) => ({ id, mods: [...set] })),
    keywordIds: [...kwIds.entries()].map(([id, zh]) => ({ id, zh })),
    stats: {
      timings: timings.length,
      timingsWithZh: timings.filter((t) => t.zh).length,
      displayTimings: displayTimings.length,
      tags: tags.length,
      sins: sins.length,
      buffNames: buffs.length,
      buffIds: buffIds.size,
      keywordNames: keywords.length,
      keywordIds: kwIds.size,
      ambiguousBuffNames: buffs.filter((b) => b.ids.length > 1).length,
      ambiguousKeywordNames: keywords.filter((k) => k.ids.length > 1).length,
    },
  };
  cache.set(letheRoot, { stamp, tables });
  return tables;
}

const TOKEN = /\[([^\[\]\r\n]{1,80})\]/g;

export function analyzeDescription(text, tables) {
  const timingByZh = new Map();
  const timingByEn = new Map();
  for (const t of tables.timings) {
    if (t.zh) timingByZh.set(t.zh, t);
    timingByEn.set(t.en, t);
  }
  const tagByZh = new Map(tables.tags.map((t) => [t.zh, t]));
  const tagById = new Map(tables.tags.map((t) => [t.id, t]));
  const dTimingByZh = new Map((tables.displayTimings || []).filter((t) => t.zh).map((t) => [t.zh, t]));
  const dTimingById = new Map((tables.displayTimings || []).map((t) => [t.id, t]));
  const buffByZh = new Map(tables.buffs.map((b) => [b.zh, b]));
  const buffById = new Map(tables.buffIds.map((b) => [b.id, b]));
  const kwByZh = new Map(tables.keywords.map((k) => [k.zh, k]));
  const kwById = new Map(tables.keywordIds.map((k) => [k.id, k]));

  const tokens = [];
  const unknown = [];
  const counts = { timing: 0, tag: 0, buff: 0, keyword: 0, unknown: 0 };
  String(text ?? '').replace(TOKEN, (raw, name) => {
    const key = name.trim();
    let kind = 'unknown';
    let id = '';
    let candidates = [];
    let sub = false;
    const t = timingByZh.get(key) || timingByEn.get(key);
    if (t) { kind = 'timing'; id = t.en; candidates = [t.en]; }
    else {
      const dt = dTimingByZh.get(key) || dTimingById.get(key);
      if (dt) { kind = 'timing'; id = dt.id; candidates = [dt.id]; sub = true; }
    }
    if (kind === 'unknown') {
      const g = tagByZh.get(key) || tagById.get(key);
      if (g) { kind = 'tag'; id = g.id; candidates = [g.id]; }
      else {
        const b = buffByZh.get(key);
        if (b) { kind = 'buff'; id = b.id; candidates = b.ids; }
        else if (buffById.has(key)) { kind = 'buff'; id = key; candidates = [key]; }
        else {
          const k = kwByZh.get(key);
          if (k) { kind = 'keyword'; id = k.id; candidates = k.ids; }
          else if (kwById.has(key)) { kind = 'keyword'; id = key; candidates = [key]; }
        }
      }
    }
    counts[kind] = (counts[kind] || 0) + 1;
    tokens.push({ raw, name: key, kind, id, candidates, ...(sub ? { sub: true } : {}) });
    if (kind === 'unknown') unknown.push(key);
    return raw;
  });
  return { tokens, unknown: [...new Set(unknown)], counts };
}

export function toGameText(text, tables) {
  const display = tables.displayTimings || [];
  // 先放显示时点、再放引擎时点：同一中文名（如 [使用时]）时引擎优先，
  // 避免把 [使用时] 写成 WhenUse_Force / OnStartBehaviour 这类显示变体。
  const timingByZh = new Map([
    ...display.filter((t) => t.zh).map((t) => [t.zh, t.id]),
    ...tables.timings.filter((t) => t.zh).map((t) => [t.zh, t.en]),
  ]);
  const knownIds = new Set([
    ...tables.timings.map((t) => t.en),
    ...display.map((t) => t.id),
    ...tables.tags.map((t) => t.id),
    ...tables.buffIds.map((b) => b.id),
    ...tables.keywordIds.map((k) => k.id),
  ]);
  const buffByZh = new Map(tables.buffs.map((b) => [b.zh, b.id]));
  const tagByZh = new Map(tables.tags.map((t) => [t.zh, t.id]));
  const kwByZh = new Map(tables.keywords.map((k) => [k.zh, k.id]));
  return String(text ?? '').replace(TOKEN, (raw, name) => {
    const key = name.trim();
    if (timingByZh.has(key)) return `[${timingByZh.get(key)}]`;
    if (knownIds.has(key)) return `[${key}]`;
    if (tagByZh.has(key)) return `[${tagByZh.get(key)}]`;
    if (buffByZh.has(key)) return `[${buffByZh.get(key)}]`;
    if (kwByZh.has(key)) return `[${kwByZh.get(key)}]`;
    return raw;
  });
}

export function clearKeywordCache() { cache.clear(); }

// 本 Mod 自定义 Buff 图标：custom_sprites/buffIcon_<id>.(png|webp)
export function buffIconIndex(letheRoot) {
  const map = new Map();
  const rootMods = join(letheRoot, 'mods');
  if (!existsSync(rootMods)) return map;
  for (const name of readdirSync(rootMods)) {
    const sp = join(rootMods, name, 'custom_sprites');
    if (!existsSync(sp)) continue;
    let files = [];
    try { files = readdirSync(sp); } catch (_) { continue; }
    for (const f of files) {
      const m = /^buffIcon_(.+)\.(png|webp)$/i.exec(f);
      if (!m) continue;
      if (!map.has(m[1])) map.set(m[1], { mod: name, file: f });
    }
  }
  return map;
}


/**
 * 游戏写法 → 编辑器显示写法：把 [英文id] 还原成 [中文名]。
 * 用于「识别被动文件里已有的描述」——那些描述是游戏格式（[Combustion]/[WhenUse]），
 * 直接显示给用户看不懂；这里只做显示层还原，保存时仍由 toGameText 转回去。
 */
export function fromGameText(text, tables) {
  const src = String(text === undefined || text === null ? '' : text);
  if (!src) return '';
  const zh = new Map();
  const put = (id, name) => {
    const k = String(id || '');
    const v = String(name || '');
    if (!k || !v || zh.has(k)) return;
    zh.set(k, v);
  };
  // 优先级：显示时点 → 引擎时点 → 技能标签 → 罪孽 → 关键词 → Buff
  for (const t of tables.displayTimings || []) put(t.id, t.zh);
  for (const t of tables.timings || []) put(t.en, t.zh);
  for (const t of tables.tags || []) put(t.id, t.zh);
  for (const s of tables.sins || []) put(s.id || s.en, s.zh);
  for (const k of tables.keywordIds || []) put(k.id, k.zh);
  for (const b of tables.buffIds || []) put(b.id, b.zh);
  return src.replace(/\[([^\[\]\r\n]{1,80})\]/g, (whole, inner) => {
    const id = String(inner).trim();
    const hit = zh.get(id);
    return hit ? '[' + hit + ']' : whole;
  });
}

/* v0.9.10：未识别关键词的「最佳匹配」建议（供保存提示用） */
function editDist(a, b) {
  const s1 = String(a); const s2 = String(b);
  const m = s1.length; const n = s2.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}

function suggestionPool(tables) {
  const out = [];
  const push = (name, kind) => {
    const v = String(name || '').trim();
    if (!v || v.length > 24) return;
    out.push({ name: v, kind });
  };
  for (const t of (tables.timings || [])) push(t.zh, 'timing');
  for (const b of (tables.buffs || [])) push(b.zh, 'buff');
  for (const k of (tables.keywords || [])) push(k.zh, 'keyword');
  for (const g of (tables.tags || [])) push(g.zh, 'tag');
  const seen = new Set();
  return out.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
}

/** 给一个未识别的词，返回最接近的已注册中文名（相似度 0–1）。 */
export function suggestName(token, tables) {
  const t = String(token || '').trim();
  if (!t) return null;
  const pool = suggestionPool(tables);
  let best = null;
  for (const c of pool) {
    const d = editDist(t, c.name);
    const score = 1 - d / Math.max(t.length, c.name.length);
    const bonus = (c.name.includes(t) || t.includes(c.name)) ? 0.18 : 0;
    const total = score + bonus;
    if (!best || total > best.score) best = { tok: t, best: c.name, kind: c.kind, score: Number(total.toFixed(3)) };
  }
  if (!best || best.score < 0.45) return null;
  return best;
}

/** 批量：给 analyzeDescription 的 unknown 列表配建议。 */
/** 描述输入时的候选（prefix/includes/编辑距离），返回 [{kind,id,zh,name,score}] */
export function suggestCandidates(q, tables, limit = 5) {
  const query = String(q || '').trim();
  if (!query) return [];
  const t = tables || {};
  const pool = [];
  const push = (kind, id, zh, name) => { if (id) pool.push({ kind, id: String(id), zh: String(zh || ''), name: String(name || id) }); };
  for (const x of t.timings || []) push('timing', x.en, x.zh, x.zh || x.en);
  for (const x of t.tags || []) push('tag', x.id, x.zh, x.zh || x.id);
  for (const b of t.buffs || []) push('buff', (b.ids && b.ids[0]) || b.id, b.zh, b.zh || b.native || b.id);
  for (const k of t.keywords || []) push('keyword', (k.ids && k.ids[0]) || k.id, k.zh, k.zh || k.native || k.id);
  const seen = new Set();
  const out = [];
  const lq = query.toLowerCase();
  for (const c of pool) {
    const zh = c.zh.toLowerCase();
    const id = c.id.toLowerCase();
    let score = 0;
    if (zh === lq || id === lq) score = 1;
    else if (zh.startsWith(lq) || id.startsWith(lq)) score = 0.92;
    else if (zh.includes(lq) || id.includes(lq)) score = 0.78;
    else { const sm = suggestName(query, { timings: [], buffs: [{ zh: c.zh, ids: [c.id] }], keywords: [], tags: [] }) || []; score = Math.max((sm[0] && sm[0].score) || 0, 0); }
    if (score < 0.45) continue;
    const key = c.kind + ':' + c.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

export function suggestUnknown(unknown, tables) {
  const list = (unknown || []).map((u) => suggestName(u, tables)).filter(Boolean);
  return list.slice(0, 6);
}
