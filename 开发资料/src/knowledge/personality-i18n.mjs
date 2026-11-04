import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { readJson } from '../atomic.mjs';

/**
 * 人格相关枚举的中英对照。来源全部是游戏导出的 locale（不硬编码中文）：
 * - 罪孽属性：limbus_locale/EN/attributeList.json
 * - 技能关键词（7 个基础 status）：limbus_locale/EN/bufList.json
 * - 单位词条 / 阵营词条：limbus_locale/EN/uiList.json 的 UnitKeyword_* / associationName_*
 */
const SKILL_KEYWORD_IDS = ['Combustion', 'Laceration', 'Vibration', 'Burst', 'Sinking', 'Charge', 'Breath'];
const RANK_LABEL = { 1: '0', 2: '00', 3: '000' };

let cache = null;
let cacheAt = 0;
const TTL = 60 * 1000;

export function i18nTables(letheRoot, force = false) {
  const now = Date.now();
  if (!force && cache && now - cacheAt < TTL) return cache;
  const dir = join(letheRoot, 'dumpedData', 'limbus_locale', 'EN');
  const attrs = readJson(join(dir, 'attributeList.json'), {}) || {};
  const buf = readJson(join(dir, 'bufList.json'), {}) || {};
  const ui = readJson(join(dir, 'uiList.json'), {}) || {};

  const SIN_FALLBACK = [
    { id: 'CRIMSON', zh: '\u66b4\u6012' }, { id: 'SCARLET', zh: '\u8272\u6b32' }, { id: 'AMBER', zh: '\u6020\u60f0' },
    { id: 'SHAMROCK', zh: '\u66b4\u98df' }, { id: 'AZURE', zh: '\u5fe7\u90c1' }, { id: 'INDIGO', zh: '\u50b2\u6162' },
    { id: 'VIOLET', zh: '\u5ac9\u5992' }, { id: 'WHITE', zh: '\u75af\u72c2' }, { id: 'BLACK', zh: '\u54c0\u53f9' },
  ];
  const sinsFound = Object.values(attrs).map((x) => ({ id: x.id, zh: x.name || x.id }));
  const sins = sinsFound.length ? sinsFound : SIN_FALLBACK;
  const skillKeywords = SKILL_KEYWORD_IDS.map((id) => ({ id, zh: (buf[id] && buf[id].name) || id }));

  /* 词条表：显示名取 uiList 的 content，去掉富文本标签；同时在用 id 从真实人格数据里统计，
     表里没有的 id（原版未命名 / Mod 自建）补成空名，保证「只能选已注册 id」但不会漏项。 */
  const plainText = (t) => String(t).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const isDeprecated = (t) => /<s>|<\/s>/i.test(String(t));
  const unitKeyword = {};
  const association = {};
  const unitDeprecated = [];
  const assocDeprecated = [];
  const put = (map, dep, id, text) => {
    const t = plainText(text);
    if (!t || /[{}]/.test(t) || id in map) return;
    map[id] = t;
    if (isDeprecated(text)) dep.push(id);
  };
  for (const [k, v] of Object.entries(ui)) {
    const text = typeof v === 'string' ? v : (v && (v.content || v.name)) || '';
    if (!text) continue;
    if (k.startsWith('UnitKeyword_')) put(unitKeyword, unitDeprecated, k.slice('UnitKeyword_'.length), text);
    else if (k.startsWith('associationName_')) put(association, assocDeprecated, k.slice('associationName_'.length), text);
    else if (k.startsWith('formation_name_filter_Etc_')) put(association, assocDeprecated, k.slice('formation_name_filter_Etc_'.length), text);
  }
  const unitUse = {};
  const assocUse = {};
  const scanDoc = (doc) => {
    const list = Array.isArray(doc) ? doc : (Array.isArray(doc && doc.list) ? doc.list : [doc]);
    for (const e of list) {
      if (!e || typeof e !== 'object') continue;
      for (const u of e.unitKeywordList || []) {
        const id = String(u && u.id !== undefined ? u.id : u);
        unitUse[id] = (unitUse[id] || 0) + 1;
        if (!(id in unitKeyword)) unitKeyword[id] = '';
      }
      for (const a of e.associationList || []) {
        const id = String(a && a.id !== undefined ? a.id : a);
        assocUse[id] = (assocUse[id] || 0) + 1;
        if (!(id in association)) association[id] = '';
      }
    }
  };
  const scanDir = (d) => {
    let es = [];
    try { es = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = join(d, e.name);
      if (e.isDirectory()) scanDir(p);
      else if (/\.json$/i.test(e.name)) { const doc = readJson(p, null); if (doc) scanDoc(doc); }
    }
  };
  scanDir(join(letheRoot, 'dumpedData', 'limbus_data', 'personality'));
  let mods = [];
  try { mods = readdirSync(join(letheRoot, 'mods'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { mods = []; }
  for (const m of mods) scanDir(join(letheRoot, 'mods', m, 'custom_limbus_data', 'personality'));

  cache = { sins, skillKeywords, rankLabel: RANK_LABEL, unitKeyword, association, unitUse, assocUse, unitDeprecated, assocDeprecated, at: new Date().toISOString() };
  cacheAt = now;
  return cache;
}

export function unitKeywordLabel(tables, key) {
  return (tables.unitKeyword && tables.unitKeyword[key]) || '';
}

export function associationLabel(tables, key) {
  return (tables.association && tables.association[key]) || '';
}