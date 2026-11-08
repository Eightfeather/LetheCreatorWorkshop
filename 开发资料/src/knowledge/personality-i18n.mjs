import { join, dirname } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
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

/* 第二来源：私服自带的汉化包 LimbusCompany_Data/Lang/LLC_zh-CN（{dataList:[{id,content}]}）。
   只用来补 uiList 里缺的中文名，不覆盖 uiList 已有条目。 */
function langDirs(letheRoot) {
  const out = [];
  const gameRoot = dirname(dirname(dirname(letheRoot)));
  for (const p of [join(gameRoot, 'LimbusCompany_Data', 'Lang', 'LLC_zh-CN'), join(gameRoot, 'Lang', 'LLC_zh-CN')]) {
    if (!out.includes(p) && existsSync(p)) out.push(p);
  }
  return out;
}

function readLangNames(letheRoot, kind) {
  const prefix = kind === 'unit' ? ['UnitKeyword_'] : ['associationName_', 'formation_name_filter_Etc_'];
  const map = {};
  for (const dir of langDirs(letheRoot)) {
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => /^(UnitKeyword|AssociationName|FormationNameEtcFilter)/i.test(f) && /\.json$/i.test(f));
    } catch { continue; }
    for (const f of files) {
      const doc = readJson(join(dir, f), null);
      const list = (doc && Array.isArray(doc.dataList) && doc.dataList) || [];
      for (const e of list) {
        const id = String((e && e.id) || '');
        const text = String((e && e.content) || '');
        if (!id || !text) continue;
        for (const pre of prefix) {
          if (!id.startsWith(pre)) continue;
          const key = id.slice(pre.length);
          if (!key || /_title$|_desc$/i.test(key)) continue;
          if (!map[key]) map[key] = text.replace(/<[^>]*>/g, '').trim();
        }
      }
    }
  }
  return map;
}

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
  const FIXED_TAGS = { SMALL: '小体型', LARGE: '大体型' };
  const association = {};
  try {
    const modsDir = join(letheRoot, 'mods');
    for (const mod of readdirSync(modsDir)) {
      const loc = join(modsDir, mod, 'custom_limbus_locale', 'EN');
      let cats = [];
      try { cats = readdirSync(loc); } catch (e) { continue; }
      for (const cat of cats) {
        if (!/^(keywordList|bufList|uiList)$/i.test(cat)) continue;
        let files = [];
        try { files = readdirSync(join(loc, cat)).filter((f) => /\.json$/i.test(f)); } catch (e) { continue; }
        for (const f of files) {
          let doc = null;
          try { doc = JSON.parse(readFileSync(join(loc, cat, f), 'utf8')); } catch (e) { continue; }
          const walk = (obj) => {
            for (const [k, v] of Object.entries(obj || {})) {
              const id = (v && v.id) || k;
              const nm = v && (v.name || v.content);
              if (id && nm && /^[A-Za-z][A-Za-z0-9_]*$/.test(String(id))) {
                if (!unitKeyword[id]) unitKeyword[id] = String(nm);
                if (!association[id]) association[id] = String(nm);
              }
            }
          };
          if (doc && typeof doc === 'object') walk(doc);
        }
      }
    }
  } catch (e) {}
  for (const [id, zh] of Object.entries(FIXED_TAGS)) {
    if (!unitKeyword[id]) unitKeyword[id] = zh;
    if (!association[id]) association[id] = zh;
  }
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
  /* 汉化包兜底：uiList 里没有的 id 用它补中文名（不覆盖已有） */
  const langUnit = readLangNames(letheRoot, 'unit');
  const langAssoc = readLangNames(letheRoot, 'assoc');
  const fillLang = (map, lang) => {
    let n = 0;
    for (const [id, zh] of Object.entries(lang)) {
      if (!zh) continue;
      if (!(id in map) || !map[id]) { map[id] = zh; n += 1; }
    }
    return n;
  };
  const langFilledUnit = fillLang(unitKeyword, langUnit);
  const langFilledAssoc = fillLang(association, langAssoc);

  /* 交叉补齐：「单位关键词」与「阵营」共用同一套 id 空间（如 FAMILY_GA / MOLAR 在
     UnitKeyword_ 里才有中文），两边互填缺失，避免同一个 id 一边有名字一边空着。 */
  for (const [id, zh] of Object.entries(unitKeyword)) {
    if (zh && !association[id]) association[id] = zh;
  }
  for (const [id, zh] of Object.entries(association)) {
    if (zh && !unitKeyword[id]) unitKeyword[id] = zh;
  }

  /* 近似归一（v0.9.9）：Mod 常把官方规范 id 写成变体，官方只注册规范 id。
     仅在精确 id 缺失时兜底，并记录供界面标注「≈ 近似」。 */
  const TAG_ALIASES = {
    Abyssal_Hunter: 'ABYSSAL_HUNTERS',
    CROSSED_Aegir: 'AEGIR',
    SPIDER_HOUSE_FATHER: 'SPIDER_HOUSE',
    PEQUOD_CAPTAIN: 'PEQUOD_CREW',
    WILD_HUNT_HEATH: 'WILD_HUNT',
  };
  const unitApprox = [];
  const assocApprox = [];
  for (const [aid, to] of Object.entries(TAG_ALIASES)) {
    if (unitKeyword[aid] || association[aid]) continue;
    const zh0 = unitKeyword[to] || association[to] || '';
    if (!zh0) continue;
    unitKeyword[aid] = zh0;
    association[aid] = zh0;
    unitApprox.push(aid);
    assocApprox.push(aid);
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

  cache = {
    sins, skillKeywords, rankLabel: RANK_LABEL, unitKeyword, association, unitUse, assocUse, unitApprox, assocApprox,
    unitDeprecated, assocDeprecated,
    lang: { dirs: langDirs(letheRoot), filledUnit: langFilledUnit, filledAssoc: langFilledAssoc },
    at: new Date().toISOString(),
  };
  cacheAt = now;
  return cache;
}

export function unitKeywordLabel(tables, key) {
  return (tables.unitKeyword && tables.unitKeyword[key]) || '';
}

export function associationLabel(tables, key) {
  return (tables.association && tables.association[key]) || '';
}