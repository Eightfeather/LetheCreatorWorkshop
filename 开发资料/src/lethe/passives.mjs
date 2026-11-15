import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeFilesTransactional } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { entitiesOf, findLocaleEntry, modDirSafe, readModPayload } from './mods.mjs';
import { ensureLayout } from './layout.mjs';
import { passiveMetaPath, readPassiveMeta, writePassiveMeta } from './meta.mjs';

/** 被动：实体 {id, attributeResonanceCondition[], requireIDList[]}；描述在 locale passiveList/<id> */

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
  push(join(letheRoot, 'dumpedData', 'limbus_data', 'passive'));
  push(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'passiveList.json'));
  push(join(letheRoot, 'mods'));
  return parts.join('|');
}

export function normalizePassiveId(id) {
  const s = String(id ?? '').trim();
  if (!/^\d{4,10}$/.test(s)) throw new SafetyError('被动 id 必须是 4–10 位数字');
  return s;
}

function vanillaNames(letheRoot) {
  const doc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'passiveList.json'), null);
  const map = new Map();
  if (doc && typeof doc === 'object') {
    for (const [k, v] of Object.entries(doc)) map.set(String(k), String((v && v.name) || ''));
  }
  return map;
}

/** 全量被动索引：原版 dumpedData + 所有 Mod */
export function passiveIndex(letheRoot) {
  const stamp = stampOf(letheRoot);
  const hit = cache.get(letheRoot);
  if (hit && hit.stamp === stamp) return hit.index;
  const byId = new Map();
  const names = vanillaNames(letheRoot);
  for (const file of walkJson(join(letheRoot, 'dumpedData', 'limbus_data', 'passive'))) {
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
    for (const file of walkJson(join(letheRoot, 'mods', mod, 'custom_limbus_data', 'passive'))) {
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

export function passiveExistsAnywhere(letheRoot, id) { return passiveIndex(letheRoot).byId.has(String(id)); }

export function searchPassiveIndex(letheRoot, q, limit = 80) {
  const query = String(q || '').trim().toLowerCase();
  const out = [];
  for (const rec of passiveIndex(letheRoot).byId.values()) {
    const name = (rec.name || '').toLowerCase();
    if (query && !rec.id.includes(query) && !name.includes(query)) continue;
    out.push({ id: rec.id, name: rec.name || '', source: rec.source, mod: rec.mod || '', overriddenBy: rec.overriddenBy || '' });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function recOf(payload, id) {
  return (payload.data.passive || []).find((x) => String(x.id) === String(id)) || null;
}

function scriptCount(entity) {
  return Array.isArray(entity && entity.requireIDList) ? entity.requireIDList.length : 0;
}

export function listPassives(letheRoot, modName) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const idx = passiveIndex(letheRoot);
  return (payload.data.passive || []).map((x) => {
    const loc = findLocaleEntry(payload.locales.EN?.passive, x.id);
    const meta = readPassiveMeta(letheRoot, modName, x.id);
    const vanilla = idx.byId.get(String(x.id));
    return {
      id: String(x.id),
      name: String((loc && loc.name) || (vanilla && vanilla.name) || ''),
      desc: String((loc && loc.desc) || ''),
      scripts: scriptCount(x.entity),
      updatedAt: meta.updatedAt || '',
      override: Boolean(vanilla && vanilla.source === 'vanilla'),
      hasLocale: Boolean(loc),
    };
  });
}

export function getPassive(letheRoot, modName, id) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const rec = recOf(payload, id);
  if (!rec) return null;
  const loc = findLocaleEntry(payload.locales.EN?.passive, id);
  const meta = readPassiveMeta(letheRoot, modName, id);
  return {
    id: String(rec.id),
    rel: rec.rel,
    entity: rec.entity,
    locale: loc || null,
    meta,
    override: passiveIndex(letheRoot).byId.get(String(rec.id))?.source === 'vanilla',
  };
}

export function createPassive(letheRoot, { name, id, displayName = '', desc = '' }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const pid = normalizePassiveId(id);
  if (passiveExistsAnywhere(letheRoot, pid)) throw new SafetyError('被动 id ' + pid + ' 已存在（原版或某个 Mod），请换一个');
  const existing = readModPayload(dir).data.passive || [];
  if (existing.some((x) => String(x.id) === pid)) throw new SafetyError('本 Mod 里已经有被动 ' + pid + '，请换一个 id');
  const entity = { id: Number(pid), attributeResonanceCondition: [], requireIDList: [] };
  const entry = { id: pid, name: displayName || pid, desc: String(desc || ''), summary: '', flavor: '' };
  ensureLayout(dir, 'passive');
  const files = [
    { rel: 'custom_limbus_data/passive/' + pid + '.json', content: JSON.stringify({ list: [entity] }, null, 2) },
    { rel: 'custom_limbus_locale/EN/passiveList/' + pid + '.json', content: JSON.stringify({ [pid]: entry }, null, 2) },
  ];
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  writePassiveMeta(letheRoot, modName, pid, { touch: true });
  return { id: pid, entity, locale: entry, ...result };
}

function readModPassiveLocale(letheRoot, mod) {
  const dir = join(letheRoot, 'mods', mod, 'custom_limbus_locale', 'EN', 'passiveList');
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

/** 导入被动：保持原 id（原版覆盖 / 跨 Mod 复制） */
export function importPassives(letheRoot, { name, ids, source = { kind: 'vanilla' } }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const idx = passiveIndex(letheRoot);
  const list = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
  if (!list.length) throw new SafetyError('没有选择要导入的被动');
  const files = [];
  for (const pid of list) {
    const rec = idx.byId.get(pid);
    if (!rec) throw new SafetyError('找不到被动 ' + pid);
    if (source.kind === 'mod' && rec.source !== 'mod') throw new SafetyError('被动 ' + pid + ' 不属于自定义 Mod');
    if (source.kind === 'vanilla' && rec.source !== 'vanilla') throw new SafetyError('被动 ' + pid + ' 不是原版被动');
    const doc = readJson(rec.file, null);
    const ent = entitiesOf(doc).find((e) => String(e.id) === pid);
    if (!ent) throw new SafetyError('被动文件里找不到 ' + pid);
    const wrapper = doc && !Array.isArray(doc) && Array.isArray(doc.list) ? { list: [ent] } : { list: [ent] };
    files.push({ rel: 'custom_limbus_data/passive/' + pid + '.json', content: JSON.stringify(wrapper, null, 2) });
    const loc = source.kind === 'mod'
      ? readModPassiveLocale(letheRoot, rec.mod)[pid]
      : (readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'passiveList.json'), null) || {})[pid];
    if (loc) files.push({ rel: 'custom_limbus_locale/EN/passiveList/' + pid + '.json', content: JSON.stringify({ [pid]: loc }, null, 2) });
  }
  ensureLayout(dir, 'passive');
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  for (const pid of list) writePassiveMeta(letheRoot, modName, pid, { touch: true });
  return { imported: list, ...result };
}

export function patchPassiveMeta(letheRoot, modName, id, patch) {
  const change = writePassiveMeta(letheRoot, modName, id, patch);
  return { change, meta: change.doc };
}

export function deletePassive(letheRoot, modName, id) {
  const mod = String(modName || '');
  const dir = modDirSafe(letheRoot, mod);
  const theId = String(id || '');
  const payload = readModPayload(dir);
  const row = ((payload.data && payload.data.passive) || []).find((r) => String(r.id) === theId);
  if (!row) throw new SafetyError('在 Mod 里找不到 passive ' + theId);
  const absFile = join(dir, ...String(row.rel).split('/'));
  const doc = readJson(absFile, null);
  const list = entitiesOf(doc);
  const files = [];
  if (list.length > 1 && row.index >= 0) {
    const rest = list.slice();
    rest.splice(row.index, 1);
    const nextDoc = Array.isArray(doc) ? rest : { ...doc, list: rest };
    files.push({ rel: row.rel, content: JSON.stringify(nextDoc, null, 2) });
  } else {
    files.push({ rel: row.rel, content: null });
  }
  const localeRel = 'custom_limbus_locale/EN/passiveList/' + theId + '.json';
  if (existsSync(join(dir, ...localeRel.split('/')))) files.push({ rel: localeRel, content: null });
  writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod });
  try { rmSync(passiveMetaPath(letheRoot, mod, theId), { force: true }); } catch (e) { /* ignore */ }
  clearPassiveCache(letheRoot);
  return { deleted: theId, files: files.length };
}

export function clearPassiveCache(letheRoot) { cache.delete(letheRoot); }
export function clearPassiveCacheAll() { cache.clear(); }
