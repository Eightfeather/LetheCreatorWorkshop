/* 挑选器数据源：从私服的 dumpedData（原版）与 mods（已加载 Mod）里列出可选的表记录，
   带中英文名字，供编辑器里的「挑」按钮搜索后回填 id。 */
import * as fs from 'node:fs';
import { join } from 'node:path';

const KINDS = {
  skill: {
    zh: '技能',
    cats: ['skill'],
    locale: 'skillList',
    meta: (e) => [e.skillTier ? `tier ${e.skillTier}` : '', e.skillData?.[0]?.atkType || '', e.skillData?.[0]?.attributeType || ''].filter(Boolean).join(' · '),
  },
  unit: {
    zh: '敌人',
    cats: ['abnormality-unit', 'enemy'],
    locale: 'enemyList',
    meta: (e) => [e.classType || '', e.level ? `Lv.${e.level}` : '', e.appearance || ''].filter(Boolean).join(' · '),
  },
  part: {
    zh: '敌人部位',
    cats: ['abnormality-part'],
    locale: null,
    meta: (e) => [e.partType || '', e.hp?.defaultStat != null ? `HP ${e.hp.defaultStat}` : ''].filter(Boolean).join(' · '),
  },
  gift: {
    zh: '饰品',
    cats: ['ego-gift', 'ego-gift-mirrordungeon'],
    locale: 'egoGiftData',
    meta: (e) => [(e.tag || []).join('/'), e.price ? `$${e.price}` : ''].filter(Boolean).join(' · '),
  },
  pack: {
    zh: '卡包',
    cats: ['mirrordungeon-theme-floor'],
    locale: 'mirrorDungeonThemeList',
    meta: (e) => [e.unlockCondition?.unlockCode != null ? `解锁 ${e.unlockCondition.unlockCode}` : ''].filter(Boolean).join(' · '),
  },
  battle: {
    zh: '战斗',
    cats: ['battle-mirrordungeon'],
    locale: null,
    meta: (e) => [e.stageType || '', e.stageLevel ? `Lv.${e.stageLevel}` : ''].filter(Boolean).join(' · '),
  },
};

const CACHE_MS = 30000;
const cache = new Map();

export function pickKinds() {
  return Object.entries(KINDS).map(([kind, k]) => ({ kind, zh: k.zh }));
}

export function pickKind(kind) {
  const spec = KINDS[kind];
  if (!spec) throw new Error('没有这个可挑表：' + kind);
  return spec;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listJsonFiles(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.json') && !e.name.includes('.bak'))
      .map((e) => join(dir, e.name));
  } catch { return []; }
}

/** 静态表：<lethe>/dumpedData/limbus_data/<cat>/*.json，每份 {list:[...]} */
function vanillaEntities(letheRoot, cats) {
  const out = [];
  for (const cat of cats) {
    for (const file of listJsonFiles(join(letheRoot, 'dumpedData', 'limbus_data', cat))) {
      const doc = readJson(file);
      for (const e of doc?.list || []) if (e && e.id != null) out.push({ ...e, __source: 'vanilla', __cat: cat });
    }
  }
  return out;
}

/** 原版 locale：<lethe>/dumpedData/limbus_locale/<lang>/<localeCat>.json（目前只 dump 了 EN） */
function vanillaLocale(letheRoot, localeCat) {
  const out = {};
  if (!localeCat) return out;
  for (const lang of ['EN']) {
    const doc = readJson(join(letheRoot, 'dumpedData', 'limbus_locale', lang, `${localeCat}.json`));
    if (!doc || typeof doc !== 'object') continue;
    for (const [id, rec] of Object.entries(doc)) {
      const name = rec?.name || rec?.levelList?.[0]?.name || rec?.parttitle || '';
      const desc = rec?.desc || rec?.levelList?.[0]?.desc || '';
      if (!name && !desc) continue;
      const slot = (out[id] ||= { name: '', nameZh: '', desc: '' });
      if (lang === 'CN') { slot.nameZh = slot.nameZh || name; } else { slot.name = slot.name || name; slot.desc = slot.desc || desc; }
    }
  }
  return out;
}

/** 已加载 Mod：<lethe>/mods/<mod>/custom_limbus_data/<cat>/*.json + custom_limbus_locale/<lang>/<localeCat>/*.json */
function modEntities(letheRoot, cats, localeCat) {
  const out = [];
  const modsRoot = join(letheRoot, 'mods');
  let mods = [];
  try {
    mods = fs.readdirSync(modsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch { return out; }
  for (const mod of mods) {
    const modDir = join(modsRoot, mod);
    const names = { EN: {}, CN: {} };
    if (localeCat) {
      for (const lang of ['EN']) {
        for (const file of listJsonFiles(join(modDir, 'custom_limbus_locale', lang, localeCat))) {
          const doc = readJson(file);
          if (doc && typeof doc === 'object') Object.assign(names[lang], doc);
        }
      }
    }
    for (const cat of cats) {
      for (const file of listJsonFiles(join(modDir, 'custom_limbus_data', cat))) {
        const doc = readJson(file);
        for (const e of doc?.list || []) {
          if (!e || e.id == null) continue;
          const key = String(e.id);
          out.push({
            ...e,
            __source: 'mod',
            __mod: mod,
            __cat: cat,
            __name: names.EN[key]?.name || names.EN[key]?.parttitle || '',
            __nameZh: names.CN[key]?.name || names.CN[key]?.parttitle || '',
          });
        }
      }
    }
  }
  return out;
}

function buildIndex(letheRoot, kind) {
  const spec = pickKind(kind);
  const vanilla = vanillaEntities(letheRoot, spec.cats);
  const vLoc = vanillaLocale(letheRoot, spec.locale);
  const items = [];
  for (const e of vanilla) {
    const key = String(e.id);
    const loc = vLoc[key] || {};
    items.push({
      id: key,
      name: loc.name || '',
      nameZh: loc.nameZh || '',
      desc: loc.desc || '',
      meta: spec.meta(e),
      cat: e.__cat,
      source: 'vanilla',
      mod: '',
    });
  }
  for (const e of modEntities(letheRoot, spec.cats, spec.locale)) {
    const key = String(e.id);
    items.push({
      id: key,
      name: e.__name || '',
      nameZh: e.__nameZh || '',
      desc: '',
      meta: spec.meta(e),
      cat: e.__cat,
      source: 'mod',
      mod: e.__mod,
    });
  }
  return items;
}

export function pickIndex(letheRoot, kind, { refresh = false } = {}) {
  const key = String(letheRoot) + '|' + kind;
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  const items = buildIndex(letheRoot, kind);
  cache.set(key, { at: Date.now(), items });
  return items;
}

/** 关键词：id / 英文名 / 中文名 都能搜；id 命中排前面 */
export function pickSearch(letheRoot, kind, { q = '', limit = 80, modOnly = false, refresh = false } = {}) {
  const items = pickIndex(letheRoot, kind, { refresh });
  const needle = String(q || '').trim().toLowerCase();
  const scored = [];
  for (const it of items) {
    if (modOnly && it.source !== 'mod') continue;
    if (!needle) { scored.push({ it, score: 5 }); continue; }
    if (it.id === needle) scored.push({ it, score: 0 });
    else if (it.id.startsWith(needle)) scored.push({ it, score: 1 });
    else if ((it.name || '').toLowerCase().startsWith(needle)) scored.push({ it, score: 2 });
    else if ((it.nameZh || '').toLowerCase().startsWith(needle)) scored.push({ it, score: 2 });
    else if (it.id.includes(needle)) scored.push({ it, score: 3 });
    else if ((it.name || '').toLowerCase().includes(needle)) scored.push({ it, score: 3 });
    else if ((it.nameZh || '').toLowerCase().includes(needle)) scored.push({ it, score: 3 });
  }
  scored.sort((a, b) => a.score - b.score || Number(a.it.id) - Number(b.it.id) || String(a.it.id).localeCompare(String(b.it.id)));
  const cap = Math.max(1, Math.min(Number(limit) || 80, 500));
  return {
    kind,
    total: scored.length,
    items: scored.slice(0, cap).map((s) => s.it),
  };
}

/** 把一条原始表记录转成编辑器草稿能吃的形状（敌人/部位/饰品/技能都能直接载入表单） */
export function pickRecord(letheRoot, kind, id, { cat = '' } = {}) {
  const spec = pickKind(kind);
  const key = String(id);
  const cats = cat ? spec.cats.filter((c) => c === cat) : spec.cats;
  for (const c of cats.length ? cats : spec.cats) {
    for (const file of listJsonFiles(join(letheRoot, 'dumpedData', 'limbus_data', c))) {
      const doc = readJson(file);
      for (const e of doc?.list || []) if (String(e?.id) === key) return { source: 'vanilla', mod: '', cat: c, entity: e };
    }
  }
  const modDirRoot = join(letheRoot, 'mods');
  let mods = [];
  try { mods = fs.readdirSync(modDirRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return null; }
  for (const mod of mods) {
    for (const c of cats.length ? cats : spec.cats) {
      for (const file of listJsonFiles(join(modDirRoot, mod, 'custom_limbus_data', c))) {
        const doc = readJson(file);
        for (const e of doc?.list || []) if (String(e?.id) === key) return { source: 'mod', mod, cat: c, entity: e };
      }
    }
  }
  return null;
}
