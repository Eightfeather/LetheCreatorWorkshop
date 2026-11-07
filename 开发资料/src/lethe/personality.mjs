import * as fs from 'node:fs';
import { join } from 'node:path';
import { readJson, readJsonFile, writeFilesTransactional } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { entitiesOf, findLocaleEntry, localeEntriesOf, modDirSafe, readModPayload } from './mods.mjs';
import { ensureLayout } from './layout.mjs';
import { vanillaTemplate } from './vanilla.mjs';
import { isUnitIdTaken } from './units.mjs';
import { projectsDir } from './lcw.mjs';

const ENTITY_FIELDS = ['appearance', 'rank', 'hp', 'defCorrection', 'minSpeedList', 'maxSpeedList',
  'uniqueAttribute', 'panicType', 'panicSkillOnErosion', 'attributeList', 'defenseSkillIDList',
  'mentalConditionInfo', 'breakSection', 'resistInfo', 'unitKeywordList', 'associationList',
  'skillKeywordList', 'slotWeightConditionList', 'season', 'initBuffList', 'unitScriptID'];
const LOCALE_FIELDS = ['name', 'title', 'desc', 'oneLineTitle', 'acquisitionMethod', 'skinItemTitle', 'skinItemDesc'];
const ATK_TYPES = ['SLASH', 'PENETRATE', 'HIT'];
const SIN_IDS = ['CRIMSON', 'SCARLET', 'AMBER', 'SHAMROCK', 'AZURE', 'INDIGO', 'VIOLET', 'WHITE', 'BLACK'];

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj && Object.hasOwn(obj, f)) out[f] = obj[f];
  return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const intIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function bad(msg) { throw new SafetyError(msg); }

function strList(v, field, maxLen = 40, maxItems = 60) {
  if (!Array.isArray(v)) bad(`${field} 必须是字符串数组`);
  if (v.length > maxItems) bad(`${field} 条目过多（上限 ${maxItems}）`);
  for (const x of v) {
    if (typeof x !== 'string') bad(`${field} 里只能放字符串`);
    if (x.length > maxLen) bad(`${field} 单条过长（上限 ${maxLen} 字）`);
  }
  return v.map((x) => x.trim()).filter(Boolean);
}

/** 校验并归一化可编辑字段（只校验用户提交的键）。 */
export function normalizePersonalityPatch(entity = {}) {
  const out = {};
  for (const [k, v] of Object.entries(pick(entity, ENTITY_FIELDS))) {
    switch (k) {
      case 'rank': if (!intIn(v, 1, 3)) bad('稀有度只能是 1 / 2 / 3'); out[k] = v; break;
      case 'hp': {
        if (!v || typeof v !== 'object') bad('血量必须是对象');
        if (v.defaultStat !== undefined && (!isNum(v.defaultStat) || v.defaultStat < 1 || v.defaultStat > 99999)) bad('基础血量必须是正数');
        if (v.incrementByLevel !== undefined && (!isNum(v.incrementByLevel) || v.incrementByLevel < 0 || v.incrementByLevel > 999)) bad('每级成长必须是 0–999 的数字');
        out[k] = v; break;
      }
      case 'defCorrection': if (!isNum(v) || v < -999 || v > 999) bad('防御修正值必须是 -999 ~ +999 的数字'); out[k] = v; break;
      case 'minSpeedList': case 'maxSpeedList': {
        if (!Array.isArray(v) || v.length < 1 || v.length > 4) bad('速度必须是 1–4 个数字');
        for (const n of v) if (!isNum(n) || n < 1 || n > 999) bad('速度必须是 1–999 的数字');
        out[k] = v; break;
      }
      case 'uniqueAttribute': if (v === '' || v == null) break; if (!SIN_IDS.includes(v)) bad('罪孽属性只能是 ' + SIN_IDS.join(' / ')); out[k] = v; break;
      case 'breakSection': {
        if (!v || !Array.isArray(v.sectionList) || v.sectionList.length < 1 || v.sectionList.length > 9) bad('混乱阈值必须是 1–9 个百分比');
        let prev = 101;
        for (const n of v.sectionList) {
          if (!isNum(n) || n <= 0 || n > 100) bad('混乱阈值必须是 0–100 的百分比');
          if (n >= prev) bad('混乱阈值必须从高到低递减');
          prev = n;
        }
        out[k] = { sectionList: v.sectionList }; break;
      }
      case 'resistInfo': {
        if (!v || !Array.isArray(v.atkResistList)) bad('物理抗性必须是列表');
        if (v.atkResistList.length > 3) bad('物理抗性最多三行');
        const seen = new Set();
        const rows = v.atkResistList.map((r) => {
          if (!r || !ATK_TYPES.includes(r.type)) bad('物理抗性类型只能是 SLASH / PENETRATE / HIT');
          if (seen.has(r.type)) bad('物理抗性类型重复：' + r.type);
          seen.add(r.type);
          if (!isNum(r.value) || r.value < 0 || r.value > 10) bad('抗性倍率必须是 0–10 的数字');
          return { type: r.type, value: r.value };
        });
        out[k] = { ...v, atkResistList: rows }; break;
      }
      case 'attributeList': {
        if (!Array.isArray(v) || v.length > 12) bad('技能列表最多 12 条');
        out[k] = v.map((r) => {
          if (!r || !Number.isInteger(Number(r.skillId)) || Number(r.skillId) <= 0) bad('技能 id 必须是正整数');
          const number = r.number === undefined || r.number === null ? 1 : Number(r.number);
          if (!Number.isInteger(number) || number < 0 || number > 99) bad('技能数量必须是 0–99 的整数');
          return { skillId: Number(r.skillId), number };
        }); break;
      }
      case 'defenseSkillIDList': {
        if (!Array.isArray(v) || v.length > 6) bad('守备技能最多 6 条');
        out[k] = v.map((x) => {
          if (!Number.isInteger(Number(x)) || Number(x) <= 0) bad('守备技能 id 必须是正整数');
          return Number(x);
        }); break;
      }
      case 'appearance': if (typeof v !== 'string' || v.length > 160) bad('外观资源名必须是 1–160 字符的文本'); out[k] = v.trim(); break;
      case 'unitKeywordList': case 'associationList': case 'skillKeywordList':
        out[k] = strList(v, k); break;
      case 'initBuffList': {
        if (!Array.isArray(v) || v.length > 4) bad('初始 Buff 的升阶组最多 4 组');
        out[k] = v.map((g) => {
          if (!g || !intIn(Number(g.level), 1, 4)) bad('初始 Buff 的 level 必须是 1–4');
          if (!Array.isArray(g.list) || g.list.length > 12) bad('每组初始 Buff 最多 12 条');
          return {
            level: Number(g.level),
            list: g.list.map((b) => {
              if (!b || typeof b.buff !== 'string' || !b.buff.trim()) bad('初始 Buff 必须填写 buff id');
              const item = { buff: b.buff.trim() };
              if (b.stack !== undefined && b.stack !== null && b.stack !== '') {
                if (!intIn(Number(b.stack), 0, 999)) bad('初始 Buff 的强度必须是 0–999');
                item.stack = Number(b.stack);
              } else item.stack = 0;
              if (b.turn !== undefined && b.turn !== null && b.turn !== '') {
                if (!intIn(Number(b.turn), 0, 999)) bad('初始 Buff 的层数必须是 0–999');
                item.turn = Number(b.turn);
              }
              return item;
            }),
          };
        }); break;
      }
      case 'unitScriptID': if (typeof v !== 'string' || v.length > 20) bad('unitScriptID 必须是文本'); out[k] = v; break;
      default: out[k] = v;
    }
  }
  return out;
}

function readVanillaPersonality(letheRoot, id) {
  const dir = join(letheRoot, 'dumpedData', 'limbus_data', 'personality');
  let hit = null;
  const walk = (d) => {
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      if (hit) return;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.json$/i.test(e.name)) {
        const doc = readJson(p, null);
        for (const ent of entitiesOf(doc)) if (ent && String(ent.id) === String(id)) { hit = ent; return; }
      }
    }
  };
  walk(dir);
  if (!hit) return null;
  const loc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'personalityList.json'), {}) || {};
  const entry = Array.isArray(loc.list) ? loc.list.find((x) => String(x.id) === String(id)) : loc[String(id)];
  return { entity: hit, locale: entry || null };
}

export function getPersonality(letheRoot, name, id) {
  const dir = modDirSafe(letheRoot, name);
  const p = readModPayload(dir);
  const entry = (p.data.personality || []).find((x) => String(x.id) === String(id));
  if (!entry) return null;
  const loc = findLocaleEntry(p.locales.EN?.personality, id);
  return { id: entry.id, entity: entry.entity, locale: loc, rel: entry.rel, hasLocale: Boolean(loc), inMod: true };
}

/** 读人格：Mod 内没有时回退到原版（用于「点原版人格直接编辑」）。 */
export function getPersonalityAny(letheRoot, name, id) {
  const inMod = getPersonality(letheRoot, name, id);
  if (inMod) return inMod;
  const van = readVanillaPersonality(letheRoot, id);
  if (!van) return null;
  return { id: Number(id), entity: van.entity, locale: van.locale, rel: null, hasLocale: Boolean(van.locale), inMod: false, vanilla: true };
}

export function listPersonalities(letheRoot, name) {
  const dir = modDirSafe(letheRoot, name);
  const p = readModPayload(dir);
  return (p.data.personality || []).map((x) => {
    const loc = findLocaleEntry(p.locales.EN?.personality, x.id) || {};
    return {
      id: x.id,
      characterId: Number(x.entity.characterId) || 0,
      name: loc.name || '',
      title: loc.title || '',
      appearance: x.entity.appearance || '',
      rank: x.entity.rank,
      skillIds: skillIdsOf(x.entity),
      hasLocale: loc.name !== undefined,
    };
  });
}

export function skillIdsOf(entity) {
  const ids = [];
  for (const a of entity?.attributeList || []) if (a && a.skillId != null) ids.push(a.skillId);
  for (const d of entity?.defenseSkillIDList || []) ids.push(d);
  return ids;
}

/** 首次编辑原版人格时，把它整份复制进 Mod（原 id 覆盖）。 */
export function materializeVanilla(letheRoot, name, id) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  if (!fs.existsSync(dir)) throw new SafetyError(`Mod 不存在：${name}`);
  const van = readVanillaPersonality(letheRoot, id);
  if (!van) throw new SafetyError(`找不到原版人格：${id}`);
  const pid = String(id);
  // 统一命名：<id>.json（与新建人格一致，便于用户预期与备份比对）
  const stem = String(pid);
  const entity = {
    ...JSON.parse(JSON.stringify(van.entity)),
    id: Number(pid),
    updatedDate: Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
  };
  const entry = van.locale ? JSON.parse(JSON.stringify(van.locale)) : { id: pid, name: String(pid), title: '', desc: '' };
  // 从原版复制时不要自动带称号/描述（文档 17 第 10 条）：名称与 id 保留，称号/描述清空
  entry.id = pid;
  if (!entry.name) entry.name = String(pid);
  entry.title = '';
  entry.desc = '';
  entry.oneLineTitle = '';
  ensureLayout(dir, 'personality');
  const files = [
    { rel: `custom_limbus_data/personality/${stem}.json`, content: JSON.stringify({ list: [entity] }, null, 2) },
    { rel: `custom_limbus_locale/EN/personalityList/${stem}.json`, content: JSON.stringify({ [pid]: entry }, null, 2) },
  ];
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  return { id: pid, entity, locale: entry, materialized: true, ...result };
}

/**
 * 保存人格：只写真正变化的字段（未知字段原样保留）。
 * 若该 id 只存在于原版，会先把原版整份复制进 Mod（原 id 覆盖），再打补丁。
 */
/** 手改源码后的锁定记录：LCW/projects/personalities/<Mod>/<id>.json */
function sourceLockPath(letheRoot, modName, id) {
  return join(projectsDir(letheRoot), 'personalities', modName, id + '.json');
}
function readMetaDoc(letheRoot, modName, id) {
  try {
    const doc = JSON.parse(fs.readFileSync(sourceLockPath(letheRoot, modName, id), 'utf8'));
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}
export function isSourceLocked(letheRoot, modName, id) {
  try {
    const doc = JSON.parse(fs.readFileSync(sourceLockPath(letheRoot, modName, id), 'utf8'));
    return doc && doc.sourceLocked === true;
  } catch {
    return false;
  }
}
function setSourceLocked(letheRoot, modName, id, locked) {
  const file = sourceLockPath(letheRoot, modName, id);
  fs.mkdirSync(join(file, '..'), { recursive: true });
  const prev = readMetaDoc(letheRoot, modName, String(id));
  fs.writeFileSync(file, JSON.stringify({ ...prev, sourceLocked: !!locked, at: new Date().toISOString() }, null, 2), 'utf8');
}

export async function savePersonality(letheRoot, { name, id, entity = {}, locale = {}, ignoreLock = false }) {
  const lockMod = cleanName(name, 'Mod 名称');
  if (!ignoreLock && isSourceLocked(letheRoot, lockMod, String(id))) {
    throw new SafetyError('这个人格的源码已被手动修改并锁定：请到「查看源代码」里修改，或删除该人格后重建');
  }
  // R1：原版人格默认只读，服务端直接拒绝写入（不依赖前端拦截）
  {
    const any = getPersonalityAny(letheRoot, name, id);
    if (any && any.vanilla) {
      throw new SafetyError('这个人格属于原版、当前是只读查看；要修改请先点「导出到本 Mod 并编辑」');
    }
  }
  // 文本字段上限（前置校验，避免长文本被静默写入）
  {
    const LIMIT = { name: 120, title: 200, oneLineTitle: 200, desc: 2000, acquisitionMethod: 300, skinItemTitle: 200, skinItemDesc: 500 };
    for (const [k, v] of Object.entries(pick(locale, LOCALE_FIELDS))) {
      if (typeof v !== 'string') bad('本地化字段必须是字符串');
      const max = LIMIT[k] || 500;
      if (v.length > max) bad('「' + k + '」过长：最多 ' + max + ' 字');
      if (k === 'name' && !v.trim()) bad('人格名字不能为空');
    }
  }
  const dir = modDirSafe(letheRoot, name);
  let p = readModPayload(dir);
  let found = (p.data.personality || []).find((x) => String(x.id) === String(id));
  let materialized = false;
  if (!found) {
    materializeVanilla(letheRoot, name, id);
    materialized = true;
    p = readModPayload(dir);
    found = (p.data.personality || []).find((x) => String(x.id) === String(id));
    if (!found) throw new SafetyError(`人格不存在：${id}`);
  }

  const files = [];
  const labels = [];
  const entPatch = normalizePersonalityPatch(entity);
  const entDiff = {};
  for (const [k, v] of Object.entries(entPatch)) {
    if (!same(found.entity?.[k], v)) entDiff[k] = v;
  }
  // 引用校验：技能/守备 id 必须存在（原版或本 Mod），外观必须是已知资源
  {
    const { skillExistsAnywhere } = await import('./skills.mjs');
    for (const row of (entPatch.attributeList || [])) {
      if (!skillExistsAnywhere(letheRoot, row.skillId)) bad('技能 id 不存在：' + row.skillId);
    }
    for (const sid of (entPatch.defenseSkillIDList || [])) {
      if (!skillExistsAnywhere(letheRoot, sid)) bad('守备技能 id 不存在：' + sid);
    }
    const app = entPatch.appearance;
    if (typeof app === 'string' && app && !app.startsWith('!')) {
      if (!allAppearanceStrings(letheRoot).includes(app)) bad('外观资源名不存在：' + app);
    }
  }
  // 速度互检：同一档 min <= max
  {
    const ent = { ...(found.entity || {}), ...entDiff };
    const mins = ent.minSpeedList || [];
    const maxs = ent.maxSpeedList || [];
    for (let i = 0; i < Math.max(mins.length, maxs.length); i++) {
      const a = Number(mins[i]); const b = Number(maxs[i]);
      if (Number.isFinite(a) && Number.isFinite(b) && a > b) bad('第 ' + (i + 1) + ' 档最小速度不能大于最大速度');
    }
  }
  // R4：有任何实体改动就刷新 updatedDate（游戏/其它工具用它判断新旧）
  if (Object.keys(entDiff).length) {
    const d = new Date();
    entDiff.updatedDate = Number(String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'));
  }
  if (Object.keys(entDiff).length) {
    const doc = readJson(join(dir, found.rel), null);
    if (!doc) throw new SafetyError(`无法读取数据文件：${found.rel}`);
    const arr = entitiesOf(doc);
    arr[found.index] = { ...arr[found.index], ...entDiff };
    files.push({ rel: found.rel, content: JSON.stringify(doc, null, 2) });
    labels.push(...Object.keys(entDiff));
  }

  const locEntry = findLocaleEntry(p.locales.EN?.personality, id);
  const locPatch = pick(locale, LOCALE_FIELDS);
  /* 称号 / 简介不再使用：保存时强制清空（旧数据也一并清掉） */
  locPatch.title = '';
  locPatch.desc = '';
  const locDiff = {};
  for (const [k, v] of Object.entries(locPatch)) {
    if (typeof v !== 'string') bad('本地化字段必须是字符串');
    const LIMIT = { name: 120, title: 200, oneLineTitle: 200, desc: 2000, acquisitionMethod: 300, skinItemTitle: 200, skinItemDesc: 500 };
    const max = LIMIT[k] || 500;
    if (v.length > max) bad('「' + k + '」过长：最多 ' + max + ' 字');
    if (!locEntry || !same(locEntry[k], v)) locDiff[k] = v;
  }
  if (Object.keys(locDiff).length) {
    if (!locEntry) throw new SafetyError('该人格没有本地化条目，无法写文本字段');
    const locRef = (p.locales.EN.personality || []).find((x) => String(x.key) === String(id));
    const doc = readJson(join(dir, locRef.rel), null);
    if (!doc || typeof doc !== 'object') throw new SafetyError(`无法读取本地化文件：${locRef.rel}`);
    if (Array.isArray(doc.list)) {
      const hit = doc.list.find((e) => String(e.id) === String(id));
      if (!hit) throw new SafetyError('本地化条目丢失');
      Object.assign(hit, locDiff);
    } else {
      doc[String(id)] = { ...(doc[String(id)] || {}), ...locDiff };
    }
    files.push({ rel: locRef.rel, content: JSON.stringify(doc, null, 2) });
    labels.push(...Object.keys(locDiff));
  }

  if (!files.length) return { changed: false, changes: [], fields: [], materialized };
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: cleanName(name) });
  return { changed: true, fields: labels, materialized, ...result };
}

export function personalityIdTaken(letheRoot, id) {
  return isUnitIdTaken(letheRoot, 'personality', id);
}

/**
 * 新建人格：以原版同罪人实体为模板（保证字段合法），清空技能引用，写入本 Mod。
 * id 必须由用户填写，且全局唯一（原版 + 全部 Mod，含被禁用）。
 */
export function createPersonality(letheRoot, { name, characterId, id, displayName, title = '', desc = '', appearance = '', rank, hp }) {
  const modName = cleanName(name, 'Mod 名称');
  const dir = modDirSafe(letheRoot, modName);
  if (!fs.existsSync(dir)) throw new SafetyError(`Mod 不存在：${name}`);
  const cid = Number(characterId);
  if (!Number.isInteger(cid) || cid <= 0) throw new SafetyError('characterId 必须是正整数');
  const pid = String(id == null ? '' : id).trim();
  if (!/^\d{3,10}$/.test(pid)) throw new SafetyError('人格 id 必须手填 3–10 位数字');
  const taken = personalityIdTaken(letheRoot, pid);
  if (taken) throw new SafetyError(`人格 id ${pid} 已被占用（${taken.source === 'vanilla' ? '原版' : taken.mod}）`);

  const tmpl = vanillaTemplate(letheRoot, cid);
  if (!tmpl) throw new SafetyError('找不到可用的原版模板（dumpedData 未导出？）');

  const entity = {
    ...JSON.parse(JSON.stringify(tmpl.entity)),
    id: Number(pid),
    characterId: cid,
    updatedDate: Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')),
    appearance: appearance || tmpl.appearance || '',
    attributeList: [],
    defenseSkillIDList: [],
    rank: rank != null ? Number(rank) : 3,
    uniqueAttribute: 'CRIMSON',
  };
  if (hp && typeof hp === 'object') entity.hp = { ...entity.hp, ...hp };

  const entry = {
    id: String(pid),
    name: displayName || '',
    title,
    desc,
    oneLineTitle: title,
    acquisitionMethod: 'Custom',
    skinItemTitle: '',
    skinItemDesc: '',
  };

  ensureLayout(dir, 'personality');
  const created = ensureLayout(dir, 'appearance').filter((x) => x.startsWith('custom_sprites') || x.startsWith('custom_appearance'));
  const files = [
    { rel: `custom_limbus_data/personality/${pid}.json`, content: JSON.stringify({ list: [entity] }, null, 2) },
    { rel: `custom_limbus_locale/EN/personalityList/${pid}.json`, content: JSON.stringify({ [pid]: entry }, null, 2) },
  ];
  const result = writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod: modName });
  return { id: pid, entity, locale: entry, created, ...result };
}

/** 吸顶标题区所需派生数据：Lv65 血量、混乱阈值血量、被动分档、技能数量。 */
export function personalityStats(letheRoot, name, id) {
  const one = getPersonalityAny(letheRoot, name, id);
  if (!one) return null;
  const e = one.entity || {};
  const d = Number(e.hp?.defaultStat) || 0;
  const inc = Number(e.hp?.incrementByLevel) || 0;
  const hp65 = Math.round(d + inc * 64);
  const pct = (e.breakSection?.sectionList || []).map((p) => ({ pct: Number(p), hp: Math.round((hp65 * Number(p)) / 100) }));
  const sp = passiveSetOf(letheRoot, name, id);
  return {
    id: one.id,
    vanilla: Boolean(one.vanilla),
    inMod: Boolean(one.inMod),
    hp65,
    thresholds: pct,
    rank: e.rank,
    defCorrection: e.defCorrection,
    minSpeed: e.minSpeedList || [],
    maxSpeed: e.maxSpeedList || [],
    resist: e.resistInfo?.atkResistList || [],
    skills: { attack: (e.attributeList || []).length, defense: (e.defenseSkillIDList || []).length },
    passives: sp,
  };
}

function readPassiveSet(letheRoot, name, id) {
  const pick = (doc) => {
    for (const ent of entitiesOf(doc)) if (ent && String(ent.personalityID) === String(id)) return ent;
    return null;
  };
  const dir = modDirSafe(letheRoot, name);
  const p = readModPayload(dir);
  for (const row of p.data['personality-passive'] || []) {
    const hit = pick(readJson(join(dir, row.rel), null));
    if (hit) return hit;
  }
  const vdir = join(letheRoot, 'dumpedData', 'limbus_data', 'personality-passive');
  let found = null;
  const walk = (d) => {
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const en of list) {
      if (found) return;
      const q = join(d, en.name);
      if (en.isDirectory()) walk(q);
      else if (/\.json$/i.test(en.name)) { const hit = pick(readJson(q, null)); if (hit) { found = hit; return; } }
    }
  };
  walk(vdir);
  return found;
}

function passiveSetOf(letheRoot, name, id) {
  const set = readPassiveSet(letheRoot, name, id);
  const norm = (list) => (list || []).map((g) => ({ level: Number(g.level) || 1, ids: (g.passiveIDList || []).map(Number) }));
  const battle = norm(set?.battlePassiveList);
  const supporter = norm(set?.supporterPassiveList);
  return {
    battle,
    supporter,
    counts: {
      battle: battle.reduce((n, g) => n + g.ids.length, 0),
      supporter: supporter.reduce((n, g) => n + g.ids.length, 0),
    },
  };
}

export { localeEntriesOf, readJsonFile };

function pWalk(dir) {
  const out = [];
  const walk = (d) => {
    let names = [];
    try { names = fs.readdirSync(d); } catch { return; }
    for (const n of names) {
      const abs = join(d, n);
      let st = null;
      try { st = fs.statSync(abs); } catch { continue; }
      if (st.isDirectory()) walk(abs);
      else if (/\.json$/i.test(n)) out.push(abs);
    }
  };
  walk(dir);
  return out;
}
function pRelOf(md, abs) { return String(abs).slice(String(md).length + 1).split('\\').join('/'); }
function pIdOf(id) {
  const p = String(id == null ? '' : id).trim();
  if (!/^\d{4,10}$/.test(p)) throw new SafetyError('人格 id 必须是 4–10 位数字');
  return p;
}

/* --------------------------- 细节能力：外观、立绘、删除、被动、源码 --------------------------- */

/** 当前私服所有原版人格用到的外观名（去重、按名字排序） */
export function appearanceOptions(letheRoot) {
  const dir = join(letheRoot, 'dumpedData', 'limbus_data', 'personality');
  const set = new Set();
  for (const f of pWalk(dir)) {
    const payload = readJson(f, null);
    for (const e of entitiesOf(payload)) {
      const a = e.appearance;
      if (a && typeof a === 'string' && !a.startsWith('!')) set.add(a);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}


/* 原版外观目录：人格实体 + 全量数据里扫到的 appearance 资源名（含皮肤 / EGO 同化） */
let _appAll = null;
export function allAppearanceStrings(letheRoot) {
  const root = join(letheRoot, 'dumpedData');
  if (!fs.existsSync(root)) return [];
  let stamp = '';
  try { stamp = String(fs.statSync(root).mtimeMs); } catch (e) { stamp = '0'; }
  if (_appAll && _appAll.root === root && _appAll.stamp === stamp) return _appAll.list;
  const set = new Set();
  const re = /[0-9]{5,6}_[A-Za-z][A-Za-z0-9_]*Appearance/g;
  const walk = (dir) => {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    for (const f of names) {
      const a = join(dir, f);
      let st;
      try { st = fs.statSync(a); } catch (e) { continue; }
      if (st.isDirectory()) { walk(a); continue; }
      if (!/\.(json|txt)$/i.test(f)) continue;
      let s = '';
      try { s = fs.readFileSync(a, 'utf8'); } catch (e) { continue; }
      let m;
      while ((m = re.exec(s))) set.add(m[0]);
    }
  };
  walk(root);
  const list = [...set].sort();
  _appAll = { root, stamp, list };
  return list;
}

export function appearanceCatalog(letheRoot, characterId) {
  const cid = Number(characterId) || 0;
  const loc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', 'personalityList.json'), {}) || {};
  const zhOf = (pid) => {
    const e = loc[String(pid)] || {};
    const title = String(e.title || '').replace(/\s*\n\s*/g, ' ').trim();
    const nm = String(e.name || '').trim();
    if (title && nm) return title + ' ' + nm;
    return title || nm || '';
  };
  const items = [];
  const seen = new Set();
  for (const f of pWalk(join(letheRoot, 'dumpedData', 'limbus_data', 'personality'))) {
    const payload = readJson(f, null);
    for (const e of entitiesOf(payload)) {
      if (Number(e.characterId) !== cid) continue;
      const ap = String(e.appearance || '');
      if (!ap || ap.startsWith('!') || seen.has(ap)) continue;
      seen.add(ap);
      items.push({ appearance: ap, id: e.id, zh: zhOf(e.id), source: 'personality' });
    }
  }
  const p3 = cid < 10 ? '10' + cid : '1' + cid;
  for (const ap of allAppearanceStrings(letheRoot)) {
    if (seen.has(ap)) continue;
    const num = ap.split('_')[0];
    const hit = num.startsWith(p3) || (num.startsWith('400') && Number(num.slice(3, 5)) === cid);
    if (!hit) continue;
    seen.add(ap);
    items.push({ appearance: ap, id: Number(num), zh: '', source: 'extra' });
  }
  items.sort((a, b) => String(a.id).localeCompare(String(b.id)) || a.appearance.localeCompare(b.appearance));
  return { characterId: cid, items, total: items.length };
}

/** 写立绘：kind = profile | cg，dataUrl 必须是 png（游戏只认 png 命名） */
export function writePortrait(letheRoot, { name, id, kind, dataUrl }) {
  const p = pIdOf(id);
  if (kind !== 'profile' && kind !== 'cg') bad('立绘类型只能是 profile 或 cg');
  const mm = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!mm) bad('只接受 PNG 图片（base64 data URL）');
  const buf = Buffer.from(mm[1], 'base64');
  if (buf.length > 12 * 1024 * 1024) bad('图片过大（上限 12 MB）');
  const target = modDirSafe(letheRoot, name);
  ensureLayout(target, 'appearance');
  const sprites = join(target, 'custom_sprites');
  const file = `${kind}_${p}.png`;
  for (const f of fs.readdirSync(sprites)) {
    if (new RegExp('^' + kind + '_' + p + '\\.[a-z]+$', 'i').test(f)) fs.rmSync(join(sprites, f), { force: true });
  }
  fs.writeFileSync(join(sprites, file), buf);
  return { file, bytes: buf.length, rel: 'custom_sprites/' + file };
}

/** 删除人格：实体 + 该 id 在所有语言 locale 里的条目 + personality-passive + profile/cg 贴图 */
export function deletePersonality(letheRoot, name, id) {
  const p = pIdOf(id);
  const md = modDirSafe(letheRoot, name);
  const files = [];
  for (const f of pWalk(join(md, 'custom_limbus_data', 'personality'))) {
    const payload = readJson(f, null);
    const list = entitiesOf(payload);
    if (!list.some((e) => String(e.id) === p)) continue;
    if (payload && Array.isArray(payload.list) && payload.list.length > 1) {
      files.push({ rel: pRelOf(md, f), content: JSON.stringify({ ...payload, list: payload.list.filter((e) => String(e.id) !== p) }, null, 2) });
    } else {
      files.push({ rel: pRelOf(md, f), content: null });
    }
  }
  const locRoot = join(md, 'custom_limbus_locale');
  for (const langDir of fs.existsSync(locRoot) ? fs.readdirSync(locRoot) : []) {
    for (const f of pWalk(join(locRoot, langDir))) {
      const payload = readJson(f, null);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) continue;
      if (!Object.prototype.hasOwnProperty.call(payload, p)) continue;
      const next = { ...payload };
      delete next[p];
      if (Object.keys(next).length === 0) files.push({ rel: pRelOf(md, f), content: null });
      else files.push({ rel: pRelOf(md, f), content: JSON.stringify(next, null, 2) });
    }
  }
  for (const f of pWalk(join(md, 'custom_limbus_data', 'personality-passive'))) {
    const payload = readJson(f, null);
    const list = entitiesOf(payload);
    if (!list.some((e) => String(e.personalityID) === p)) continue;
    if (payload && Array.isArray(payload.list) && payload.list.length > 1) {
      files.push({ rel: pRelOf(md, f), content: JSON.stringify({ ...payload, list: payload.list.filter((e) => String(e.personalityID) !== p) }, null, 2) });
    } else {
      files.push({ rel: pRelOf(md, f), content: null });
    }
  }
  const sprites = join(md, 'custom_sprites');
  if (fs.existsSync(sprites)) {
    for (const f of fs.readdirSync(sprites)) {
      if (new RegExp('^(profile|cg)_' + p + '\\.[a-z]+$', 'i').test(f)) files.push({ rel: 'custom_sprites/' + f, content: null });
    }
  }
  if (!files.length) bad('没有找到这个人格的可删文件');
  const wrote = writeFilesTransactional({ modDir: md, files, root: letheRoot, mod: name, backup: true });
  return { id: p, removed: files.filter((f) => f.content === null).map((f) => f.rel), wrote: wrote.written };
}

/** 被动挂接：kind = battle | supporter；默认写「同步等级 4」档 */
export async function passiveEdit(letheRoot, { name, id, kind = 'battle', op = 'add', passiveId = '', level = 4 }) {
  if (op === 'add') {
    const { passiveExistsAnywhere } = await import('./passives.mjs');
    if (!passiveExistsAnywhere(letheRoot, passiveId)) throw new SafetyError('被动 id 不存在：' + passiveId);
  }
  const p = pIdOf(id);
  if (kind !== 'battle' && kind !== 'supporter') bad('被动类型只能是 battle 或 supporter');
  const lv = intIn(Number(level), 1, 4) ? Number(level) : 4;
  const md = modDirSafe(letheRoot, name);
  const dir = join(md, 'custom_limbus_data', 'personality-passive');
  ensureLayout(md, 'passive');
  let file = null;
  let payload = null;
  for (const f of pWalk(dir)) {
    const pl = readJson(f, null);
    const list = entitiesOf(pl);
    if (list.some((e) => String(e.personalityID) === p)) { file = f; payload = pl; break; }
  }
  if (!file) {
    file = join(dir, p + '.json');
    payload = { list: [{ personalityID: Number(p), battlePassiveList: [], supporterPassiveList: [] }] };
  }
  const list = Array.isArray(payload.list) ? payload.list : [payload];
  const ent = list.find((e) => String(e.personalityID) === p) || { personalityID: Number(p) };
  if (!Array.isArray(ent.battlePassiveList)) ent.battlePassiveList = [];
  if (!Array.isArray(ent.supporterPassiveList)) ent.supporterPassiveList = [];
  if (!list.includes(ent)) list.push(ent);
  const groups = kind === 'battle' ? ent.battlePassiveList : ent.supporterPassiveList;
  let g = groups.find((x) => Number(x.level) === lv);
  if (!g) { g = { level: lv, passiveIDList: [] }; groups.push(g); groups.sort((a, b) => Number(a.level) - Number(b.level)); }
  if (!Array.isArray(g.passiveIDList)) g.passiveIDList = [];
  if (op === 'add') {
    const pid = String(passiveId || '').trim();
    if (!/^\d{4,12}$/.test(pid)) bad('被动 id 必须是 4–12 位数字');
    if (g.passiveIDList.map(String).includes(pid)) bad('这一档里已经挂了这个被动');
    g.passiveIDList.push(pid);
  } else if (op === 'rm') {
    const pid = String(passiveId || '').trim();
    const idx = g.passiveIDList.map(String).indexOf(pid);
    if (idx < 0) bad('这一档里没有这个被动');
    g.passiveIDList.splice(idx, 1);
  } else bad('op 只能是 add 或 rm');
  const wrote = writeFilesTransactional({
    modDir: md,
    files: [{ rel: pRelOf(md, file), content: JSON.stringify({ ...payload, list }, null, 2) }],
    root: letheRoot,
    mod: name,
    backup: true,
  });
  return { kind, level: lv, passiveId: String(passiveId || ''), wrote: wrote.written };
}

/** 源码页：读「人格数据文件」与「被动挂接文件」两份原样 JSON + 定位信息 */
export function personalitySource(letheRoot, name, id) {
  const p = pIdOf(id);
  const one = getPersonalityAny(letheRoot, name, p);
  const md = modDirSafe(letheRoot, name);
  const passives = passiveSetOf(letheRoot, name, p);

  /* 人格数据文件：原版人格在 Mod 里还没有文件 → 用「如果导出会写成什么」的形态给出 */
  let entityDoc = null;
  let entityDocRel = one.rel || '';
  if (!one.vanilla && one.rel) {
    entityDoc = readJson(join(md, one.rel.split('/').join('\\')), null);
  }
  if (!entityDoc) {
    entityDoc = { list: [one.entity] };
    if (!entityDocRel) entityDocRel = 'custom_limbus_data/personality/' + p + '.json';
  }

  /* 被动挂接文件：存在则原样返回整份（可能含其他人格），不存在则给空骨架 */
  let passiveDoc = null;
  let passiveDocRel = passives.rel || ('custom_limbus_data/personality-passive/' + p + '.json');
  if (passives.rel) passiveDoc = readJson(join(md, passives.rel.split('/').join('\\')), null);
  if (!passiveDoc) {
    passiveDoc = { list: [{ personalityID: Number(p), battlePassiveList: [], supporterPassiveList: [] }] };
  }

  return {
    id: p,
    entityRel: one.rel || '',
    entity: one.entity,
    locale: one.locale,
    localeRel: one.localeRel || '',
    passives: passives.entity || null,
    passivesRel: passives.rel || '',
    vanilla: Boolean(one.vanilla),
    entityDoc,
    entityDocText: JSON.stringify(entityDoc, null, 2),
    entityDocRel,
    passiveDoc,
    passiveDocText: JSON.stringify(passiveDoc, null, 2),
    passiveDocRel,
  };
}

/* 校验并抽出「这份人格」的实体（允许文件里有其他实体） */
function pickEntityFromDoc(doc, p) {
  const list = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.list) ? doc.list : null);
  if (!list) bad('人格数据必须是 {"list":[ ... ]} 或数组');
  const hit = list.find((e) => e && String(e.id) === String(p));
  if (!hit) bad('这份数据里没有 id=' + p + ' 的人格实体');
  return hit;
}

/* 校验被动挂接文档：personalityID / level / passiveIDList */
function checkPassiveDoc(doc, p) {
  const list = Array.isArray(doc) ? doc : (doc && Array.isArray(doc.list) ? doc.list : null);
  if (!list) bad('被动挂接必须是 {"list":[ {personalityID, battlePassiveList, supporterPassiveList} ]}');
  if (!list.some((e) => e && String(e.personalityID) === String(p))) bad('被动挂接里没有 personalityID=' + p + ' 的条目');
  for (const e of list) {
    if (!e || typeof e !== 'object') bad('被动挂接的每一项目都必须是对象');
    for (const k of ['battlePassiveList', 'supporterPassiveList']) {
      const groups = e[k];
      if (groups === undefined) continue;
      if (!Array.isArray(groups)) bad(k + ' 必须是数组');
      for (const g of groups) {
        if (!g || typeof g !== 'object') bad(k + ' 的每一项必须是 {level, passiveIDList}');
        const lv = Number(g.level);
        if (!intIn(lv, 1, 4)) bad(k + ' 的 level 只能是 1–4');
        if (!Array.isArray(g.passiveIDList)) bad(k + ' 的 passiveIDList 必须是数组');
        for (const pid of g.passiveIDList) {
          if (!/^\d{4,12}$/.test(String(pid))) bad('被动 id 必须是 4–12 位数字：' + pid);
        }
      }
    }
  }
  return list;
}

/** 源码页保存：两份文件按原版位置与结构写回（实体仍走白名单校验） */
export function savePersonalitySource(letheRoot, { name, id, entity, locale, entityText, passiveText }) {
  const modName = cleanName(name, 'Mod 名称');
  const p = pIdOf(id);

  let ent = entity && typeof entity === 'object' ? entity : null;
  if (!ent && typeof entityText === 'string' && entityText.trim()) {
    let doc = null;
    try { doc = JSON.parse(entityText); } catch { bad('人格数据 JSON 解析失败（检查括号与引号）'); }
    ent = pickEntityFromDoc(doc, p);
  }

  let passiveList = null;
  if (typeof passiveText === 'string' && passiveText.trim()) {
    let doc = null;
    try { doc = JSON.parse(passiveText); } catch { bad('被动挂接 JSON 解析失败（检查括号与引号）'); }
    passiveList = checkPassiveDoc(doc, p);
  }

  const patch = {};
  if (ent) patch.entity = ent;
  if (locale && typeof locale === 'object') patch.locale = locale;
  const result = savePersonality(letheRoot, { name, id, ...patch, ignoreLock: true });

  if (passiveList) {
    const md = modDirSafe(letheRoot, name);
    ensureLayout(md, 'passive');
    const rel = 'custom_limbus_data/personality-passive/' + p + '.json';
    writeFilesTransactional({
      modDir: md,
      files: [{ rel, content: JSON.stringify({ list: passiveList }, null, 2) }],
      root: letheRoot,
      mod: modName,
      backup: true,
    });
  }

  setSourceLocked(letheRoot, modName, String(p), true);
  return { ...result, locked: true, wrotePassive: Boolean(passiveList) };
}

