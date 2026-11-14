import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeFilesTransactional } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { entitiesOf, findLocaleEntry, modDirSafe, readModPayload } from './mods.mjs';
import { ensureLayout } from './layout.mjs';
import { readBuffMeta, writeBuffMeta } from './meta.mjs';

/** Buff：实体 id 是字符串关键词（如 SkadiVibration），另需 0 字节关键词 txt + locale bufList 才能显示 */

function walkJson(dir, out = [], depth = 0) {
  if (!existsSync(dir) || depth > 4) return out;
  let items = [];
  try { items = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) {
    const p = join(dir, it.name);
    if (it.isDirectory()) walkJson(p, out, depth + 1);
    else if (it.name.toLowerCase().endsWith('.json')) out.push(p);
  }
  return out;
}

const cache = new Map();

function stampOf(letheRoot) {
  const parts = [];
  const push = (p) => { try { parts.push(p + ':' + statSync(p).mtimeMs); } catch { parts.push(p + ':-'); } };
  push(join(letheRoot, 'dumpedData', 'limbus_data', 'buff'));
  push(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'bufList.json'));
  push(join(letheRoot, 'mods'));
  return parts.join('|');
}

export function normalizeBuffId(id) {
  const s = String(id ?? '').trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{1,39}$/.test(s)) throw new SafetyError('Buff id 必须是英文开头、只含字母数字下划线（2–40 字符），例如 BurnMark');
  return s;
}

function vanillaNames(letheRoot) {
  const doc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'bufList.json'), null);
  const map = new Map();
  if (doc && typeof doc === 'object') for (const [k, v] of Object.entries(doc)) map.set(String(k), String((v && v.name) || ''));
  return map;
}

export function buffIndex(letheRoot) {
  const stamp = stampOf(letheRoot);
  const hit = cache.get(letheRoot);
  if (hit && hit.stamp === stamp) return hit.index;
  const byId = new Map();
  const names = vanillaNames(letheRoot);
  for (const file of walkJson(join(letheRoot, 'dumpedData', 'limbus_data', 'buff'))) {
    const doc = readJson(file, null);
    for (const e of entitiesOf(doc)) {
      const id = String(e.id ?? '');
      if (!id || byId.has(id)) continue;
      byId.set(id, { id, source: 'vanilla', mod: '', file, name: names.get(id) || '' });
    }
  }
  let mods = [];
  try { mods = readdirSync(join(letheRoot, 'mods'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch {}
  for (const mod of mods) {
    for (const file of walkJson(join(letheRoot, 'mods', mod, 'custom_limbus_data', 'buff'))) {
      const doc = readJson(file, null);
      for (const e of entitiesOf(doc)) {
        const id = String(e.id ?? '');
        if (!id) continue;
        const prev = byId.get(id);
        if (prev && prev.source === 'vanilla') { prev.overriddenBy = mod; continue; }
        byId.set(id, { id, source: 'mod', mod, file, name: prev ? prev.name : (names.get(id) || '') });
      }
    }
  }
  const index = { byId, letheRoot };
  cache.set(letheRoot, { stamp, index });
  return index;
}

export function buffExistsAnywhere(letheRoot, id) { return buffIndex(letheRoot).byId.has(String(id)); }

export function searchBuffIndex(letheRoot, q, limit = 80) {
  const query = String(q || '').trim().toLowerCase();
  const out = [];
  for (const rec of buffIndex(letheRoot).byId.values()) {
    const name = (rec.name || '').toLowerCase();
    if (query && !rec.id.toLowerCase().includes(query) && !name.includes(query)) continue;
    out.push({ id: rec.id, name: rec.name || '', source: rec.source, mod: rec.mod || '', overriddenBy: rec.overriddenBy || '' });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function buffLocale(payload) {
  const en = (payload.locales && payload.locales.EN) || {};
  return en.buff || en.buf || [];
}

function recOf(payload, id) {
  return (payload.data.buff || []).find((x) => String(x.id) === String(id)) || null;
}

export function listBuffs(letheRoot, modName) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const idx = buffIndex(letheRoot);
  return (payload.data.buff || []).map((x) => {
    const loc = findLocaleEntry(buffLocale(payload), x.id);
    const meta = readBuffMeta(letheRoot, modName, x.id);
    const vanilla = idx.byId.get(String(x.id));
    return {
      id: String(x.id),
      name: String((loc && loc.name) || (vanilla && vanilla.name) || ''),
      desc: String((loc && loc.desc) || ''),
      buffClass: String(x.entity.buffClass || ''),
      buffType: String(x.entity.buffType || ''),
      maxStack: Number(x.entity.maxStack) || 0,
      updatedAt: meta.updatedAt || '',
      override: Boolean(vanilla && vanilla.source === 'vanilla'),
      hasLocale: Boolean(loc),
    };
  });
}

export function getBuff(letheRoot, modName, id) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const rec = recOf(payload, id);
  if (!rec) return null;
  const loc = findLocaleEntry(buffLocale(payload), id);
  const meta = readBuffMeta(letheRoot, modName, id);
  return {
    id: String(rec.id),
    rel: rec.rel,
    entity: rec.entity,
    locale: loc || null,
    meta,
    override: buffIndex(letheRoot).byId.get(String(rec.id))?.source === 'vanilla',
  };
}

export function createBuff(letheRoot, { name, id, displayName = '', desc = '', info = {} }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const bid = normalizeBuffId(id);
  if (buffExistsAnywhere(letheRoot, bid)) throw new SafetyError('Buff id ' + bid + ' 已存在（原版或某个 Mod），请换一个');
  const existing = readModPayload(dir).data.buff || [];
  if (existing.some((x) => String(x.id) === bid)) throw new SafetyError('本 Mod 里已经有 Buff ' + bid + '，请换一个 id');
  const entity = {
    id: bid,
    buffClass: info.buffClass || 'NonvolatileBuff',
    buffType: info.buffType || 'Positive',
    canBeDespelled: info.canBeDespelled !== false,
    destroyableOnZero: false,
    destroyableOnRetreat: false,
    maxStack: Math.max(1, Number(info.maxStack) || 1),
    maxTurn: Math.max(-1, Number(info.maxTurn) || 1),
    iconId: String(info.iconId || ''),
    list: [],
    categoryKeywordList: [],
  };
  const entry = { id: bid, name: displayName || bid, desc: String(desc || '') };
  ensureLayout(dir, 'buff');
  const files = [
    { rel: 'custom_limbus_data/buff/' + bid + '.json', content: JSON.stringify({ list: [entity] }, null, 2) },
    { rel: 'custom_limbus_locale/EN/bufList/' + bid + '.json', content: JSON.stringify({ [bid]: entry }, null, 2) },
    { rel: 'custom_buffs/' + bid + '.txt', content: '' },
  ];
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  writeBuffMeta(letheRoot, modName, bid, {
    touch: true,
    info: {
      buffClass: entity.buffClass,
      buffType: entity.buffType,
      canBeDespelled: entity.canBeDespelled,
      maxStack: entity.maxStack,
      maxTurn: entity.maxTurn,
      iconId: entity.iconId,
      special: '',
    },
  });
  return { id: bid, entity, locale: entry, ...result };
}

function readModBuffLocale(letheRoot, mod) {
  const dir = join(letheRoot, 'mods', mod, 'custom_limbus_locale', 'EN', 'bufList');
  const out = {};
  let names = [];
  try { names = readdirSync(dir); } catch { return out; }
  for (const f of names) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    const doc = readJson(join(dir, f), null);
    if (!doc || typeof doc !== 'object') continue;
    for (const [k, v] of Object.entries(doc)) if (k && v && typeof v === 'object') out[k] = v;
  }
  return out;
}

/** 导入 Buff：保持原 id；缺少关键词 txt 时补一个 0 字节文件 */
export function importBuffs(letheRoot, { name, ids, source = { kind: 'vanilla' } }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const idx = buffIndex(letheRoot);
  const list = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
  if (!list.length) throw new SafetyError('没有选择要导入的 Buff');
  const files = [];
  for (const bid of list) {
    const rec = idx.byId.get(bid);
    if (!rec) throw new SafetyError('找不到 Buff ' + bid);
    if (source.kind === 'mod' && rec.source !== 'mod') throw new SafetyError('Buff ' + bid + ' 不属于自定义 Mod');
    if (source.kind === 'vanilla' && rec.source !== 'vanilla') throw new SafetyError('Buff ' + bid + ' 不是原版 Buff');
    const doc = readJson(rec.file, null);
    const ent = entitiesOf(doc).find((e) => String(e.id) === bid);
    if (!ent) throw new SafetyError('Buff 文件里找不到 ' + bid);
    files.push({ rel: 'custom_limbus_data/buff/' + bid + '.json', content: JSON.stringify({ list: [ent] }, null, 2) });
    const loc = source.kind === 'mod'
      ? readModBuffLocale(letheRoot, rec.mod)[bid]
      : (readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'bufList.json'), null) || {})[bid];
    if (loc) files.push({ rel: 'custom_limbus_locale/EN/bufList/' + bid + '.json', content: JSON.stringify({ [bid]: loc }, null, 2) });
    files.push({ rel: 'custom_buffs/' + bid + '.txt', content: '' });
  }
  ensureLayout(dir, 'buff');
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  for (const bid of list) writeBuffMeta(letheRoot, modName, bid, { touch: true });
  return { imported: list, ...result };
}

/**
 * 写 Buff 图标：只接受 PNG dataURL；落 custom_sprites/buffIcon_<iconId>.png，
 * 并把实体 iconId 指过去；同时保证 custom_buffs/<id>.txt 存在（自定义 buff 必须在这里注册关键词）。
 */
export function writeBuffIcon(letheRoot, modName, id, { dataUrl, iconId }) {
  const mod = String(modName || '');
  const dir = modDirSafe(letheRoot, mod);
  const bid = String(id || '');
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new SafetyError('只接受 PNG 图片');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new SafetyError('只接受 PNG 图片');
  }
  const payload = readModPayload(dir);
  const rows = (payload.data && payload.data.buff) || [];
  const found = rows.find((r) => String(r.id) === bid);
  if (!found) throw new SafetyError('在 Mod 里找不到 Buff ' + bid);
  const absFile = join(dir, ...String(found.rel).split('/'));
  const doc = readJson(absFile, null);
  if (!doc) throw new SafetyError('读取 Buff 文件失败：' + found.rel);
  const list = entitiesOf(doc);
  const ent = list[found.index];
  if (!ent || String(ent.id) !== bid) throw new SafetyError('在 Mod 里找不到 Buff ' + bid);
  const iid = String(iconId || ent.iconId || bid).replace(/[^A-Za-z0-9_]/g, '');
  ent.iconId = iid;
  const files = [{ rel: found.rel, content: JSON.stringify(doc, null, 2) }];
  const txtRel = 'custom_buffs/' + bid + '.txt';
  if (!existsSync(join(dir, txtRel))) files.push({ rel: txtRel, content: '' });
  files.push({ rel: 'custom_sprites/buffIcon_' + iid + '.png', content: buf });
  const res = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod });
  clearBuffCache(letheRoot);
  return { iconId: iid, rel: 'custom_sprites/buffIcon_' + iid + '.png', written: res.written };
}

export function patchBuffMeta(letheRoot, modName, id, patch) {
  const change = writeBuffMeta(letheRoot, modName, id, patch);
  return { change, meta: change.doc };
}

export function clearBuffCache(letheRoot) { cache.delete(letheRoot); }
