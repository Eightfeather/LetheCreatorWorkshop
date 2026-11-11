import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeFilesTransactional } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { entitiesOf, findLocaleEntry, modDirSafe, readModPayload } from './mods.mjs';
import { ensureLayout } from './layout.mjs';
import { normalizeId, readSkillMeta, writeSkillMeta } from './meta.mjs';

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
  const push = (p) => { try { parts.push(`${p}:${statSync(p).mtimeMs}`); } catch { parts.push(`${p}:-`); } };
  push(join(letheRoot, 'dumpedData', 'limbus_data', 'skill'));
  push(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'skillList.json'));
  push(join(letheRoot, 'mods'));
  return parts.join('|');
}

function levelName(entry) {
  const levels = entry && Array.isArray(entry.levelList) ? entry.levelList : [];
  const hit = levels.find((l) => l && l.name) || levels[0];
  return String((hit && hit.name) || '');
}

function vanillaLocaleNames(letheRoot) {
  const doc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'skillList.json'), null);
  const map = new Map();
  if (doc && typeof doc === 'object') {
    for (const [k, v] of Object.entries(doc)) map.set(String(k), levelName(v));
  }
  return map;
}

/** 全量技能 id 索引：原版 dumpedData + 所有 Mod 的自定义技能文件（只缓存 id → 来源/文件名） */
export function gameSkillIndex(letheRoot) {
  const stamp = stampOf(letheRoot);
  const hit = cache.get(letheRoot);
  if (hit && hit.stamp === stamp) return hit.index;

  const byId = new Map();
  const names = vanillaLocaleNames(letheRoot);
  const vanillaFiles = walkJson(join(letheRoot, 'dumpedData', 'limbus_data', 'skill'));
  for (const file of vanillaFiles) {
    const doc = readJson(file, null);
    for (const e of entitiesOf(doc)) {
      const id = String(e.id ?? '');
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, { id, source: 'vanilla', mod: '', file, rel: '' });
    }
  }
  let mods = [];
  try { mods = readdirSync(join(letheRoot, 'mods'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch {}
  for (const mod of mods) {
    const base = join(letheRoot, 'mods', mod);
    for (const file of walkJson(join(base, 'custom_limbus_data', 'skill'))) {
      const doc = readJson(file, null);
      for (const e of entitiesOf(doc)) {
        const id = String(e.id ?? '');
        if (!id) continue;
        const prev = byId.get(id);
        byId.set(id, { id, source: prev ? prev.source : 'mod', mod: prev && prev.source === 'vanilla' ? prev.mod : mod, file: prev && prev.source === 'vanilla' ? prev.file : file, overriddenBy: prev && prev.source === 'vanilla' ? mod : '' });
      }
    }
    const locDoc = readModSkillLocale(letheRoot, mod);
    for (const [k, v] of Object.entries(locDoc)) {
      const nm = levelName(v);
      if (nm) names.set(String(k), nm);
    }
  }
  for (const [id, rec] of byId) rec.name = names.get(id) || '';
  const index = { byId, names, letheRoot, builtAt: new Date().toISOString() };
  cache.set(letheRoot, { stamp, index });
  return index;
}

export function skillExistsAnywhere(letheRoot, id) {
  return gameSkillIndex(letheRoot).byId.has(String(id));
}

export function searchSkillIndex(letheRoot, q, limit = 60) {
  const { byId } = gameSkillIndex(letheRoot);
  const query = String(q || '').trim().toLowerCase();
  const out = [];
  for (const rec of byId.values()) {
    const name = (rec.name || '').toLowerCase();
    if (query && !rec.id.includes(query) && !name.includes(query)) continue;
    out.push({ id: rec.id, name: rec.name || '', source: rec.source, mod: rec.mod || '', overriddenBy: rec.overriddenBy || '' });
    if (out.length >= limit) break;
  }
  out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return out;
}

function skillRecOf(payload, id) {
  return (payload.data.skill || []).find((x) => String(x.id) === String(id)) || null;
}

export function listSkills(letheRoot, modName) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const index = gameSkillIndex(letheRoot);
  const vanillaNames = index.names;
  return (payload.data.skill || []).map((x) => {
    const loc = findLocaleEntry(payload.locales.EN?.skill, x.id);
    const meta = readSkillMeta(letheRoot, modName, x.id);
    const vanilla = index.byId.get(String(x.id));
    const sd = (x.entity.skillData || [])[0] || {};
    return {
      id: String(x.id),
      name: (loc && levelName(loc.levelList ? loc : { levelList: loc.levelList })) || loc?.levelList?.[0]?.name || vanillaNames.get(String(x.id)) || '',
      tier: Number(x.entity.skillTier) || 0,
      coins: Array.isArray(sd.coinList) ? sd.coinList.length : 0,
      updatedAt: meta.updatedAt || '',
      override: Boolean(vanilla && vanilla.source === 'vanilla'),
      hasLocale: Boolean(loc),
    };
  });
}

export function getSkill(letheRoot, modName, id) {
  const dir = modDirSafe(letheRoot, modName);
  const payload = readModPayload(dir);
  const rec = skillRecOf(payload, id);
  if (!rec) return null;
  const loc = findLocaleEntry(payload.locales.EN?.skill, id);
  const meta = readSkillMeta(letheRoot, modName, id);
  const index = gameSkillIndex(letheRoot);
  return {
    id: String(rec.id),
    rel: rec.rel,
    entity: rec.entity,
    locale: loc || null,
    meta,
    override: index.byId.get(String(rec.id))?.source === 'vanilla',
  };
}

/** 写技能元数据（草稿，不碰游戏文件），返回可交给 EditSession 的变更 */
export function patchSkillMeta(letheRoot, modName, id, patch) {
  const changed = writeSkillMeta(letheRoot, modName, id, patch);
  return { change: changed, meta: changed.doc };
}

export function createSkill(letheRoot, { name, id, displayName = '' }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const sid = normalizeId(id);
  if (skillExistsAnywhere(letheRoot, sid)) {
    throw new SafetyError(`技能 id ${sid} 已存在（原版或某个 Mod），请换一个`);
  }
  const entity = {
    id: Number(sid),
    skillType: 'SKILL',
    skillTier: 1,
    requireIDList: [],
    skillData: [{
      actionScript: '',
      iconID: '',
      gaksungLevel: 1,
      informationID: -1,
      attributeType: 'NEUTRAL',
      atkType: 'SLASH',
      defType: 'ATTACK',
      skillMotion: 'S1',
      viewType: 'BATTLE',
      parryingCloseType: 'NEAR',
      canDuel: true,
      canChangeTarget: true,
      targetNum: 1,
      defaultValue: 4,
      abilityScriptList: [],
      mpUsage: 0,
      skillLevelCorrection: 0,
      range: -1,
      arearange: -1,
      isRandomAreaAttack: false,
      isManyCoinSkill: false,
      specialDuelIndex: -1,
      skillTargetType: 'FRONT',
      canTeamKill: false,
      coinList: [{ operatorType: 'ADD', color: 'GOLD', grade: 1, scale: 3, prob: 0.5, actionIndex: -1, cutsceneStart: false, abilityScriptList: [] }],
      actionList: [],
      importanceLevel: 0,
      additionalSkillKeywordList: [],
    }],
  };
  const entry = { id: sid, levelList: [{ level: 1, name: displayName || sid, desc: '' }] };
  ensureLayout(dir, 'skill');
  const files = [
    { rel: `custom_limbus_data/skill/${sid}.json`, content: JSON.stringify({ list: [entity] }, null, 2) },
    { rel: `custom_limbus_locale/EN/skillList/${sid}.json`, content: JSON.stringify({ [sid]: entry }, null, 2) },
  ];
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  writeSkillMeta(letheRoot, modName, sid, { touch: true });
  return { id: sid, entity, locale: entry, ...result };
}

/** 导入技能：保持原 id（相当于对原版同 id 覆盖 / 跨 Mod 复制） */
export function importSkills(letheRoot, { name, ids, source = { kind: 'vanilla' } }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  const index = gameSkillIndex(letheRoot);
  const list = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
  if (!list.length) throw new SafetyError('没有选择要导入的技能');

  const files = [];
  const imported = [];
  for (const sid of list) {
    const rec = index.byId.get(sid);
    if (!rec) throw new SafetyError(`找不到技能 ${sid}`);
    if (source.kind === 'mod' && rec.source !== 'mod') throw new SafetyError(`技能 ${sid} 不属于自定义 Mod`);
    if (source.kind === 'vanilla' && rec.source !== 'vanilla') throw new SafetyError(`技能 ${sid} 不是原版技能`);

    const doc = readJson(rec.file, null);
    const arr = entitiesOf(doc);
    const ent = arr.find((e) => String(e.id) === sid);
    if (!ent) throw new SafetyError(`技能文件里找不到 ${sid}`);
    const wrapper = doc && typeof doc === 'object' && !Array.isArray(doc) && Array.isArray(doc.list) ? { list: [ent] } : (Array.isArray(doc) ? [ent] : { list: [ent] });
    files.push({ rel: `custom_limbus_data/skill/${sid}.json`, content: JSON.stringify(wrapper, null, 2) });

    const locDoc = source.kind === 'mod' ? readModSkillLocale(letheRoot, rec.mod) : null;
    if (source.kind === 'vanilla') {
      const names = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'skillList.json'), null);
      const entry = names ? names[sid] : null;
      if (entry) files.push({ rel: `custom_limbus_locale/EN/skillList/${sid}.json`, content: JSON.stringify({ [sid]: entry }, null, 2) });
    } else if (locDoc) {
      const entry = locDoc[sid];
      if (entry) files.push({ rel: `custom_limbus_locale/EN/skillList/${sid}.json`, content: JSON.stringify({ [sid]: entry }, null, 2) });
    }
    imported.push(sid);
  }
  ensureLayout(dir, 'skill');
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  for (const sid of imported) writeSkillMeta(letheRoot, modName, sid, { touch: true });
  return { imported, ...result };
}

/** 读取某 Mod 的 skillList 目录下所有 locale 条目（合并成 id→entry 映射） */
function readModSkillLocale(letheRoot, mod) {
  const dir = join(letheRoot, 'mods', mod, 'custom_limbus_locale', 'EN', 'skillList');
  const out = {};
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return out; }
  for (const f of names) {
    if (!f.toLowerCase().endsWith('.json')) continue;
    const doc = readJson(join(dir, f), null);
    if (!doc || typeof doc !== 'object') continue;
    for (const [k, v] of Object.entries(doc)) if (k && v && typeof v === 'object') out[k] = v;
  }
  return out;
}

/** 某原版人格持有的技能（导入对话框用） */
export function skillsOfVanillaPersonality(letheRoot, personalityId) {
  const idx = vanillaPersonalityIndex(letheRoot);
  const p = idx.find((x) => String(x.id) === String(personalityId));
  if (!p) return [];
  const ids = [];
  for (const a of p.attributeList || []) if (a && a.skillId != null) ids.push(String(a.skillId));
  for (const d of p.defenseSkillIDList || []) ids.push(String(d));
  const names = gameSkillIndex(letheRoot).names;
  return ids.map((id) => ({ id, name: names.get(id) || '' }));
}

const vpCache = new Map();
function vanillaPersonalityIndex(letheRoot) {
  const hit = vpCache.get(letheRoot);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  const list = [];
  for (const file of walkJson(join(letheRoot, 'dumpedData', 'limbus_data', 'personality'))) {
    const doc = readJson(file, null);
    for (const e of entitiesOf(doc)) list.push(e);
  }
  vpCache.set(letheRoot, { at: Date.now(), list });
  return list;
}

export function clearSkillCache(letheRoot) { cache.delete(letheRoot); }