import * as fs from 'node:fs';
import { migrateToLcw, ensureLcwPart } from '../lethe/lcw.mjs';
import { warmupCaches } from '../lethe/warmup.mjs';
import { ARG_COUNTS } from '../knowledge/arg-counts.mjs';
import { dirname, join } from 'node:path';
import { APP_ROOT, USER_DATA_DIR } from '../paths.mjs';
import { configPath, rememberRoot, saveConfig } from '../config.mjs';
import { SafetyError } from '../safety.mjs';
import { locate, scanStats } from '../locate.mjs';
import { createMod, disableMod, dirOf, enableMod, listMods, modDir, modDirSafe, readModPayload, resolveModDir, saveModOrder, deleteModEverywhere } from '../lethe/mods.mjs';
import { listDlls, setDllEnabled } from '../lethe/dlls.mjs';
import { appearanceOptions, appearanceCatalog, writePortrait, deletePersonality, passiveEdit, personalitySource, savePersonalitySource, isSourceLocked,  createPersonality, getPersonality, getPersonalityAny, listPersonalities, materializeVanilla, personalityIdTaken, personalityStats, savePersonality} from '../lethe/personality.mjs';
import { i18nTables } from '../knowledge/personality-i18n.mjs';
import { isUnitIdTaken, searchUnits, unitCounts } from '../lethe/units.mjs';
import { vanillaIndex } from '../lethe/vanilla.mjs';
import { createDllBackup, createUserBackup, listDllBackups, listUserBackups, readBackupPayload, swapBackup } from '../lethe/backups.mjs';
import { autoBackupsDir, journalDir, markCleanExit, markRunning, readSessionMarker, readState, updateState, writeState } from '../lethe/state.mjs';
import { restoreFromSlot, slotInfo } from '../lethe/snapshot.mjs';
import { homeStats } from '../lethe/stats.mjs';
import { createSkill, getSkill, importSkills, listSkills, searchSkillIndex, skillsOfVanillaPersonality } from '../lethe/skills.mjs';
import { BUFF_CLASSES, BUFF_TYPES, COIN_COLORS, DEFAULT_BUFF_INFO, DEFAULT_INFO, DEFAULT_PASSIVE_INFO, MODULE_KINDS, PASSIVE_CONDITION_TYPES, PHYSICAL_TYPES, SIN_TYPES, createModule, deleteModule, getModule, listModules, readSkillMeta, readPassiveMeta, readBuffMeta, updateModule, writeSkillCode, writeSkillMeta, writePassiveMeta, writeBuffMeta, writeModuleProgram, coinColor, skillCodePath } from '../lethe/meta.mjs';
import { createPassive, getPassive, importPassives, listPassives, patchPassiveMeta, searchPassiveIndex } from '../lethe/passives.mjs';
import { createBuff, getBuff, importBuffs, listBuffs, patchBuffMeta, searchBuffIndex } from '../lethe/buffs.mjs';
import { analyzeDescription, buffIconIndex, fromGameText, keywordTables, suggestCandidates, suggestUnknown, toGameText } from '../lethe/keywords.mjs';
import { TIMING_ARGS } from '../knowledge/timing-args.mjs';
import { canonicalCode, parseScripts } from '../lethe/program-parse.mjs';
import { writeScriptSlot, scriptSlotList } from '../lethe/scriptslot.mjs';
import { applyMd, applyMdAll, deleteMd, fromGameEntity, getMd, listMd, mdSchemas, nextMdId, removeLanded, saveMd } from '../lethe/mdtables.mjs';
import { pickKinds, pickRecord, pickSearch } from '../lethe/picker.mjs';
/* MD_IMPORTED_v0_9_0 */
import { ARG_ENUMS } from '../knowledge/arg-enums.mjs';
import { ARG_OPTIONAL } from '../knowledge/arg-optional.mjs';
import { COMMANDS, ACQUIRERS, CONSEQUENCES, modularStats } from '../knowledge/modular-tables.mjs';
import { SCOPES, TIMING_SCOPE, COMMAND_SCOPE, TIMING_CONTAINERS, COMMAND_CONTAINERS } from '../knowledge/scopes.mjs';
import { createApi } from './api-shared.mjs';
import { compileProgram, compileTimingRows } from '../lethe/program.mjs';
import { saveCompiledBuff, saveCompiledPassive, saveCompiledSkill, savePassiveFields, saveSkillFields, saveBuffScripts, saveBuffFields } from '../lethe/apply.mjs';

function ensureRoot(state) {
  if (!state || !state.letheRoot) {
    const e = new Error('还没有定位到私服：先在设置里选择 Lethe 目录');
    e.status = 428;
    throw e;
  }
  return state.letheRoot;
}

/** 模块 → 编译后的脚本（用于识别「这段脚本是哪个模块产出的」） */
const VANILLA_LOCALE_CACHE = new Map();

/** 读取 dumpedData 里的原版 locale 表（按 mtime 缓存）。 */
function vanillaLocaleFile(letheRoot, fileName) {
  const p = join(letheRoot, 'dumpedData', 'limbus_locale', 'EN', fileName);
  let mtime = 0;
  try { mtime = fs.statSync(p).mtimeMs; } catch { return null; }
  const hit = VANILLA_LOCALE_CACHE.get(p);
  if (hit && hit.mtime === mtime) return hit.data;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    VANILLA_LOCALE_CACHE.set(p, { data, mtime });
    return data;
  } catch { return null; }
}

/** 本 Mod 没覆盖时，用游戏原版文案（bufList 优先，其次 keywordList）。 */
function vanillaBuffLocale(letheRoot, id) {
  const buf = vanillaLocaleFile(letheRoot, 'bufList.json');
  const kw = vanillaLocaleFile(letheRoot, 'keywordList.json');
  const hit = (buf && buf[id]) || (kw && kw[id]) || null;
  if (!hit) return null;
  return { name: String(hit.name || ''), desc: String(hit.desc || '') };
}
function isModularScript(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/TIMING:|LOOP:|^Modular\//.test(t)) return true;
  if (/\bVALUE_\d+\s*:/.test(t)) return true;
  if (/\b(IF|IFNOT|CONTINUEIF)\s*\(/.test(t)) return true;
  if (/\b(CLEARVALUES|RESETWHENUSE|LUAMAIN|EXPECTED)\b/.test(t)) return true;
  if (/^[A-Za-z_][A-Za-z0-9_]*\(/.test(t)) return true;
  return false;
}

/**
 * 识别技能里已有的脚本：遍历 **所有** skillData（不止第 1 段）+ 技能动作 + 动作段 + 每枚硬币；
 * 每段单独成组，并匹配到编辑器内的模块。
 */
function skillScriptGroups(letheRoot, entity) {
  const byCode = moduleCodeIndex(letheRoot);
  const sds = Array.isArray(entity && entity.skillData) ? entity.skillData : [];
  const wrap = (list) => {
    const scripts = (list || []).map((x) => String((x && x.scriptName) || '')).filter(Boolean);
    const modular = scripts.filter(isModularScript);
    const plain = scripts.filter((x) => !isModularScript(x));
    const parsed = modular.length ? parseScripts(modular) : { scripts: [], rows: [] };
    return {
      scripts: modular,
      plain,
      parsed,
      matchedModules: modular.map((code) => byCode.get(canonicalCode(code)) || null),
      fileTotal: scripts.length,
    };
  };
  const groups = [];
  sds.forEach((sd, si) => {
    const sdx = si + 1;
    const suffix = si === 0 ? '' : '（第 ' + sdx + ' 段）';
    const top = wrap(sd && sd.abilityScriptList);
    if (top.fileTotal) groups.push({ kind: 'skill', label: '技能级' + suffix, sd: si, index: -1, ...top });
    const act = String((sd && sd.actionScript) || '').trim();
    if (act) {
      const one = wrap([{ scriptName: act }]);
      groups.push({ kind: 'action', label: '技能动作' + suffix, sd: si, index: -1, ...one });
    }
    const actionList = Array.isArray(sd && sd.actionList) ? sd.actionList : [];
    actionList.forEach((a, ai) => {
      const g = wrap(a && a.abilityScriptList);
      if (g.fileTotal) groups.push({ kind: 'actionList', label: '动作段 ' + (ai + 1) + suffix, sd: si, index: ai, ...g });
    });
    const coins = Array.isArray(sd && sd.coinList) ? sd.coinList : [];
    coins.forEach((c, i) => {
      const g = wrap(c && c.abilityScriptList);
      if (g.fileTotal) groups.push({ kind: 'coin', label: '硬币 ' + (i + 1) + suffix, sd: si, index: i, ...g });
    });
  });
  return groups;
}


/** v0.9.18：某实体里「不是编辑器模块」的脚本（未匹配到模块库的原始脚本） */
function unrecSlots(letheRoot, mod, kind, id) {
  let slots = [];
  try { slots = scriptSlotList(letheRoot, { name: mod, kind, id }); } catch (e) { return []; }
  let byCode = new Map();
  try { byCode = moduleCodeIndex(letheRoot); } catch (e) { byCode = new Map(); }
  const out = [];
  for (const s of slots) {
    const text = String(s.text || '').trim();
    if (!text) continue;
    const modular = isModularScript(text);
    if (modular) {
      let key = '';
      try { key = canonicalCode(text); } catch (e) { key = ''; }
      if (key && byCode.has(key)) continue;
    }
    let parseable = false;
    if (modular) { try { const p = parseScripts([text]); parseable = Boolean(p && p.rows && p.rows.length); } catch (e) {} }
    out.push({ where: s.where, coin: s.coin, index: s.index, text, modular, parseable });
  }
  return out;
}

function moduleCodeIndex(letheRoot) {
  const map = new Map();
  try {
    for (const m of listModules(letheRoot)) {
      if (!m || !m.program) continue;
      let codes = [];
      try { codes = compileProgram(m.program); } catch { codes = []; }
      for (const code of codes) {
        const key = canonicalCode(code);
        if (key && !map.has(key)) map.set(key, m.id);
      }
    }
  } catch { /* 模块损坏时忽略，不影响被动读取 */ }
  return map;
}

/** 统计每个模块被多少处技能/被动/Buff 引用（按规范化脚本串精确匹配） */
function moduleUsageCounts(letheRoot) {
  let modules = [];
  try { modules = listModules(letheRoot); } catch { modules = []; }
  const targets = modules.map((m) => {
    let code = '';
    try { code = canonicalCode(compileProgram(m.program)); } catch { code = ''; }
    return { id: m.id, code };
  }).filter((t) => t.code);
  const out = {};
  if (!targets.length) return out;
  const mods = listMods(letheRoot).filter((m) => m.enabled);
  for (const mod of mods) {
    let dir = null;
    try { dir = modDirSafe(letheRoot, mod.name); } catch { dir = null; }
    if (!dir) continue;
    let payload = null;
    try { payload = readModPayload(dir); } catch { payload = null; }
    if (!payload) continue;
    const scripts = [];
    const push = (v) => { if (typeof v === 'string' && v.trim()) scripts.push(v); };
    for (const cat of ['skill', 'passive', 'buff']) {
      for (const row of (payload.data[cat] || [])) {
        const ent = row.entity || {};
        for (const sd of (ent.skillData || [])) {
          for (const a of (sd.abilityScriptList || [])) push(a && a.scriptName);
          for (const c of (sd.coinList || [])) for (const a of (c.abilityScriptList || [])) push(a && a.scriptName);
        }
        for (const s of (ent.requireIDList || [])) push(s);
        for (const l of (ent.list || [])) push(l && l.ability);
      }
    }
    if (!scripts.length) continue;
    const canon = scripts.map((s) => { try { return canonicalCode(String(s)); } catch { return String(s); } });
    for (const t of targets) {
      let n = 0;
      for (const c of canon) if (c === t.code) n += 1;
      if (n) out[t.id] = (out[t.id] || 0) + n;
    }
  }
  return out;
}

export function buildApi(ctx) {
  const { state, log, session, autosave } = ctx;
  const need = () => {
    if (!state.letheRoot) {
      const err = new Error('还没有定位到私服。请先在“设置”里指定 Lethe 目录。');
      err.status = 428;
      throw err;
    }
    return { letheRoot: state.letheRoot, gameRoot: state.gameRoot };
  };

  const keyOf = (q, body) => {
    const mod = body?.name || q?.get('name') || '';
    const key = body?.key || q?.get('key') || '';
    return { mod, key };
  };

  const patchSkillMetaSafe = (letheRoot, mod, id, patch) => {
    const before = readSkillMeta(letheRoot, mod, id);
    const change = writeSkillMeta(letheRoot, mod, id, patch);
    return { before, change };
  };

  const api = {
    'GET /api/health': () => ({ ok: true, app: 'The Lethe Workbench', version: ctx.version }),

    'GET /api/status': () => ({
      ok: true,
      version: ctx.version,
      appRoot: APP_ROOT,
      userDataDir: USER_DATA_DIR,
      configPath: configPath(),
      letheRoot: state.letheRoot,
      gameRoot: state.gameRoot,
      locatedAt: state.locatedAt,
      source: state.source,
      theme: state.config?.theme || 'dark',
      editorName: readState(state.letheRoot || '').editorName || '但丁',
    }),

    'GET /api/home': () => {
      let stats = null;
      if (state.letheRoot) {
        try { stats = homeStats(state.letheRoot, state.gameRoot); } catch (err) { stats = { error: err.message }; }
      }
      return {
        ok: true,
        letheRoot: state.letheRoot || '',
        gameRoot: state.gameRoot || '',
        editorName: readState(state.letheRoot || '').editorName || '但丁',
        stats,
      };
    },

    'POST /api/locate': async (body) => {
      const result = locate({
        explicit: body.path || body.explicit,
        config: state.config,
        quick: body.quick !== false,
        budgetMs: Number(body.budgetMs) || 8000,
      });
      if (result.best) {
        state.letheRoot = result.best.letheRoot;
      migrateToLcw(state.letheRoot, log);
        warmupCaches(state.letheRoot, log).catch(() => {});
        migrateToLcw(state.letheRoot, log);
        warmupCaches(state.letheRoot, log).catch(() => {});
        state.gameRoot = result.best.gameRoot;
        state.locatedAt = new Date().toISOString();
        state.source = result.best.from;
        markRunning(state.letheRoot);
        state.config = rememberRoot(result.best.gameRoot || result.best.letheRoot);
        log?.(`定位成功：${state.letheRoot}`);
      }
      return { ok: Boolean(result.best), best: result.best, candidates: result.candidates, tried: result.tried, stats: { ...scanStats } };
    },

    'POST /api/root': async (body) => {
      const result = locate({ explicit: body.path, config: state.config, quick: true });
      if (!result.best) {
        const err = new Error('这个目录不像 Lethe 的根目录（应包含 mods 或 dumpedData）');
        err.status = 400;
        throw err;
      }
      state.letheRoot = result.best.letheRoot;
      migrateToLcw(state.letheRoot, log);
        warmupCaches(state.letheRoot, log).catch(() => {});
      state.gameRoot = result.best.gameRoot;
      state.locatedAt = new Date().toISOString();
      state.source = 'manual';
      markRunning(state.letheRoot);
      state.config = rememberRoot(result.best.gameRoot || result.best.letheRoot);
      return { ok: true, ...result.best };
    },

    'POST /api/mods/order': (body) => {
      const { letheRoot } = need();
      const order = saveModOrder(letheRoot, body && body.order);
      return { ok: true, order, mods: listMods(letheRoot) };
    },

    'POST /api/mod/delete': (body) => {
      const { letheRoot } = need();
      if (!body || body.confirm !== 'DELETE') throw new SafetyError('删除需要确认：请在弹窗里点「永久删除」');
      const res = deleteModEverywhere(letheRoot, body.name);
      return { ok: true, ...res, mods: listMods(letheRoot) };
    },

    'POST /api/config': async (body) => {
      state.config = saveConfig(body || {});
      if (body && typeof body.editorName === 'string' && state.letheRoot) {
        updateState(state.letheRoot, (st) => ({ ...st, editorName: body.editorName.trim() || '但丁' }));
      }
      return { ok: true, config: state.config };
    },

    'GET /api/mods': () => {
      const { letheRoot } = need();
      return { ok: true, mods: listMods(letheRoot) };
    },

    'GET /api/mod': (q) => {
      const { letheRoot } = need();
      const name = q.get('name');
      const found = resolveModDir(letheRoot, name);
      const payload = readModPayload(found.dir);
      const backups = listUserBackups(letheRoot, name);
      return {
        ok: true,
        name: found.name,
        dir: found.dir,
        enabled: !found.disabled,
        personalities: payload.personalities,
        sprites: payload.sprites,
        dataCategories: Object.keys(payload.data),
        localeCategories: Object.keys(payload.locales.EN || {}),
        backups,
        autoSave: slotInfo(join(autoBackupsDir(letheRoot), found.name)),
      };
    },

    'POST /api/mod/create': async (body) => {
      const { letheRoot } = need();
      const created = createMod(letheRoot, body);
      return { ok: true, mod: created };
    },

    'POST /api/mod/disable': async (body) => {
      const { letheRoot } = need();
      return { ok: true, mod: disableMod(letheRoot, body.name) };
    },

    'POST /api/mod/enable': async (body) => {
      const { letheRoot } = need();
      return { ok: true, mod: enableMod(letheRoot, body.name) };
    },

    'POST /api/mod/backup': async (body) => {
      const { letheRoot } = need();
      return { ok: true, backup: createUserBackup(letheRoot, body.name) };
    },

    'GET /api/backup/read': (q) => {
      const { letheRoot } = need();
      return { ok: true, backup: readBackupPayload(letheRoot, q.get('name'), q.get('label')) };
    },

    'POST /api/mod/swap': async (body) => {
      const { letheRoot } = need();
      const result = swapBackup(letheRoot, body.name, body.label);
      session.clear(body.name);
      autosave.stop(body.name);
      return { ok: true, ...result };
    },

    /* ---------- 编辑会话：撤销 / 重做 / 保存点 ---------- */
    'GET /api/session': (q) => {
      const { letheRoot } = need();
      const { mod, key } = keyOf(q);
      return {
        ok: true,
        session: session.state(mod),
        target: key ? { canUndo: session.canUndo(mod, key), canRedo: session.canRedo(mod, key) } : null,
        autoSave: autosave.slot(mod),
      };
    },

    'POST /api/undo': async (body) => {
      const { mod, key } = keyOf(null, body);
      if (!mod || !key) { const e = new Error('撤销需要指定 Mod 与编辑目标'); e.status = 400; throw e; }
      return { ok: true, ...session.undo(mod, key) };
    },

    'POST /api/redo': async (body) => {
      const { mod, key } = keyOf(null, body);
      if (!mod || !key) { const e = new Error('重做需要指定 Mod 与编辑目标'); e.status = 400; throw e; }
      return { ok: true, ...session.redo(mod, key) };
    },

    'POST /api/autosave/now': async (body) => {
      const { mod } = keyOf(null, body);
      const result = autosave.runNow(mod);
      return { ok: Boolean(result.ok), result, status: autosave.status() };
    },

    'GET /api/autosave': (q) => {
      const { mod } = keyOf(q);
      return { ok: true, status: autosave.status(), slot: mod ? autosave.slot(mod) : null };
    },

    /* ---------- 崩溃恢复 ---------- */
    'GET /api/recover-check': () => {
      const { letheRoot } = need();
      const marker = readSessionMarker(letheRoot);
      const unclean = Boolean(marker && marker.running && marker.pid !== process.pid);
      const mods = [];
      try {
        for (const d of fs.readdirSync(autoBackupsDir(letheRoot), { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          const info = slotInfo(join(autoBackupsDir(letheRoot), d.name));
          if (info) mods.push({ name: d.name, ...info });
        }
      } catch { /* none */ }
      return { ok: true, unclean, marker, mods };
    },

    'POST /api/recover': async (body) => {
      const { letheRoot } = need();
      const mod = body.name;
      const { dir } = resolveModDir(letheRoot, mod);
      const slot = join(autoBackupsDir(letheRoot), mod);
      const safety = join(journalDir(letheRoot), 'recover', `${mod}-${Date.now()}`);
      fs.mkdirSync(join(safety, '..'), { recursive: true });
      fs.cpSync(dir, safety, { recursive: true });
      const result = restoreFromSlot(slot, dir);
      markCleanExit(letheRoot);
      return { ok: true, mod, ...result, safetyCopy: safety };
    },

    /* ---------- DLL ---------- */
    'GET /api/dlls': () => {
      const { gameRoot, letheRoot } = need();
      const dlls = listDlls(gameRoot).map((d) => ({ ...d, backups: listDllBackups(letheRoot, d.file) }));
      return { ok: true, dlls, plugins: join(gameRoot, 'BepInEx', 'plugins') };
    },

    'POST /api/dll/toggle': async (body) => {
      const { gameRoot } = need();
      return { ok: true, dll: setDllEnabled(gameRoot, body.file, Boolean(body.enabled)) };
    },

    'POST /api/dll/backup': async (body) => {
      const { gameRoot, letheRoot } = need();
      return { ok: true, backup: createDllBackup(gameRoot, letheRoot, body.file) };
    },

    'GET /api/dll/backups': (q) => {
      const { letheRoot } = need();
      return { ok: true, backups: listDllBackups(letheRoot, q.get('file') || '') };
    },

    /* ---------- 人格 ---------- */
    'GET /api/personalities': (q) => {
      const { letheRoot } = need();
      const vanilla = vanillaIndex(letheRoot);
      const name = q.get('name');
      const custom = name ? listPersonalities(letheRoot, name) : [];
      return {
        ok: true,
        characters: vanilla.characters.length ? vanilla.characters : fallbackCharacters(),
        custom,
        vanillaCount: vanilla.personalities.length,
        vanillaAvailable: vanilla.available,
      };
    },

    'GET /api/vanilla': (q) => {
      const { letheRoot } = need();
      const idx = vanillaIndex(letheRoot);
      const cid = Number(q.get('characterId') || 0);
      const list = idx.personalities
        .filter((p) => !cid || p.characterId === cid)
        .map((p) => ({ id: p.id, characterId: p.characterId, name: p.name, title: p.title, rank: p.rank }));
      return { ok: true, characters: idx.characters, personalities: list };
    },

  'GET /api/personality/portrait': (q) => {
    const name = String(q.get('name') || '');
    const id = String(q.get('id') || '');
    const md = resolveModDir(state.letheRoot, name).dir;
    const dir = join(md, 'custom_sprites');
    const out = {};
    for (const kind of ['profile', 'cg']) {
      if (!fs.existsSync(dir)) break;
      const hit = fs.readdirSync(dir).find((f) => new RegExp('^' + kind + '_' + id + '\\.(png|webp|jpg|jpeg|gif)$', 'i').test(f));
      if (!hit) continue;
      const buf = fs.readFileSync(join(dir, hit));
      if (buf.length > 16 * 1024 * 1024) continue;
      const ext = (hit.split('.').pop() || 'png').toLowerCase();
      const mime = ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
      out[kind] = { file: hit, dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64') };
    }
    return { ok: true, sprites: out };
  },
  'GET /api/personality/appearance-catalog': (q) => {
    const cid = Number(q.get('characterId') || 0);
    if (!cid) throw new SafetyError('缺少 characterId');
    return { ok: true, ...appearanceCatalog(state.letheRoot, cid) };
  },
  'GET /api/personality/appearance-options': () => {
    ensureRoot(state);
    return { ok: true, options: appearanceOptions(state.letheRoot) };
  },

  'POST /api/personality/portrait': async (body) => {
    ensureRoot(state);
    return {
      ok: true,
      ...writePortrait(state.letheRoot, {
        name: String(body.name || ''),
        id: body.id,
        kind: String(body.kind || 'profile'),
        dataUrl: String(body.dataUrl || ''),
      }),
    };
  },

  'POST /api/personality/delete': async (body) => {
    ensureRoot(state);
    const res = deletePersonality(state.letheRoot, String(body.name || ''), body.id);
    session.clear(String(body.name || ''));
    return { ok: true, ...res };
  },

  'POST /api/personality/passive': async (body) => {
    ensureRoot(state);
    const res = await passiveEdit(state.letheRoot, {
      name: String(body.name || ''),
      id: body.id,
      kind: String(body.kind || 'battle'),
      op: String(body.op || 'add'),
      passiveId: String(body.passiveId || ''),
      level: body.level,
    });
    autosave.touch(String(body.name || ''));
    return { ok: true, ...res };
  },

  'GET /api/personality/source': (q) => {
    ensureRoot(state);
    return { ok: true, ...personalitySource(state.letheRoot, String(q.get('name') || ''), q.get('id')) };
  },

  'POST /api/personality/source': async (body) => {
    ensureRoot(state);
    const res = savePersonalitySource(state.letheRoot, {
      name: String(body.name || ''),
      id: body.id,
      entity: body.entity,
      locale: body.locale,
      entityText: body.entityText,
      passiveText: body.passiveText,
    });
    autosave.touch(String(body.name || ''));
    return { ok: true, ...res };
  },

  'GET /api/personality/i18n': () => {
    const root = state.letheRoot;
    if (!root) return { ok: true, tables: null };
    const t = i18nTables(root);
    return {
      ok: true,
      tables: {
        sins: t.sins,
        skillKeywords: t.skillKeywords,
        rankLabel: t.rankLabel,
        unitKeyword: t.unitKeyword,
        association: t.association,
        unitUse: t.unitUse || {},
        unitApprox: t.unitApprox || [],
        assocApprox: t.assocApprox || [],
        assocUse: t.assocUse || {},
        unitDeprecated: t.unitDeprecated || [],
        assocDeprecated: t.assocDeprecated || [],
      },
    };
  },

  'GET /api/personality/stats': (q) => {
    const root = state.letheRoot;
    if (!root) throw new SafetyError(NOT_LOCATED);
    const stats = personalityStats(root, q.get('name') || state.selected, q.get('id'));
    if (!stats) throw new SafetyError('人格不存在：' + q.get('id'));
    return { ok: true, stats };
  },

  'GET /api/personality/id-taken': (q) => {
    const root = state.letheRoot;
    if (!root) throw new SafetyError(NOT_LOCATED);
    const id = String(q.get('id') || '').trim();
    if (!/^\d{3,10}$/.test(id)) return { ok: true, valid: false, reason: 'id 必须是 3–10 位数字', taken: null };
    return { ok: true, valid: true, taken: personalityIdTaken(root, id) };
  },

  'GET /api/unit-search': (q) => {
    const root = state.letheRoot;
    if (!root) throw new SafetyError(NOT_LOCATED);
    const kind = String(q.get('kind') || 'skill');
    if (!['personality', 'skill', 'passive', 'buff'].includes(kind)) throw new SafetyError('kind 只能是 personality / skill / passive / buff');
    const limit = Math.max(1, Math.min(100, Number(q.get('limit')) || 30));
    return { ok: true, kind, rows: searchUnits(root, kind, q.get('q') || '', limit), counts: unitCounts(root) };
  },

  'GET /api/unit-id-taken': (q) => {
    const root = state.letheRoot;
    if (!root) throw new SafetyError(NOT_LOCATED);
    const kind = String(q.get('kind') || 'personality');
    return { ok: true, taken: isUnitIdTaken(root, kind, q.get('id')) };
  },

  'POST /api/personality/copy-vanilla': async (body) => {
    const root = state.letheRoot;
    if (!root) throw new SafetyError(NOT_LOCATED);
    const name = body.name || state.selected;
    if (!name) throw new SafetyError('请先选择一个 Mod');
    const res = materializeVanilla(root, name, body.vanillaId || body.id);
    session.clear(name, 'personality:' + res.id);
    autosave.touch(name);
    return { ok: true, personality: { id: res.id, entity: res.entity, locale: res.locale }, written: res.written };
  },

  'GET /api/personality': async (q) => {
      const { letheRoot } = need();
      const one = getPersonalityAny(letheRoot, q.get('name'), q.get('id'));
      const locked = one ? isSourceLocked(letheRoot, q.get('name'), String(q.get('id'))) : false;
      if (!one) {
        const err = new Error('找不到这个人格');
        err.status = 404;
        throw err;
      }
      const skillNames = {};
      const passiveNames = {};
      try {
        const { gameSkillIndex } = await import('../lethe/skills.mjs');
        const { passiveIndex } = await import('../lethe/passives.mjs');
        const si = gameSkillIndex(letheRoot);
        const e0 = (one && one.entity) || {};
        const ids = [...new Set([...((e0.attributeList || []).map((r) => String(r && r.skillId))), ...(((e0.defenseSkillIDList) || []).map(String))])];
        for (const sid of ids) {
          const hit = si.byId && si.byId.get(sid);
          if (hit && hit.name) skillNames[sid] = hit.name;
        }
        const st = personalityStats(letheRoot, q.get('name') || state.selected, q.get('id')) || {};
        const pids = new Set();
        for (const g of [...((st.passives && st.passives.battle) || []), ...((st.passives && st.passives.supporter) || [])]) {
          for (const pid of (g && g.ids) || []) pids.add(String(pid));
        }
        const pi = passiveIndex(letheRoot);
        for (const pid of pids) {
          const hit = pi.byId && pi.byId.get(pid);
          if (hit && hit.name) passiveNames[pid] = hit.name;
        }
      } catch (e) { /* 名字解析失败不影响主流程 */ }
      return { ok: true, personality: { ...one, locked, skillNames, passiveNames } };
    },

    /** 编辑即应用：写入变化字段，记录一个撤销步骤 */
    'POST /api/personality/patch': async (body) => {
      const { letheRoot } = need();
      const result = await savePersonality(letheRoot, body);
      const key = `personality:${body.id}`;
      if (result.changed) {
        session.record(body.name, key, `编辑人格 ${body.id}`, result.changes || []);
        autosave.touch(body.name);
      }
      return { ok: true, ...result, session: session.state(body.name) };
    },

    /** 保存点：清空该人格的撤销/重做栈（符合“保存成功后撤销栈清空”） */
    'POST /api/personality/save': async (body) => {
      session.clear(body.name, `personality:${body.id}`);
      return { ok: true, committed: true, session: session.state(body.name) };
    },

    'POST /api/personality/create': async (body) => {
      const { letheRoot } = need();
      const created = createPersonality(letheRoot, body);
      return { ok: true, personality: { id: created.id, entity: created.entity, locale: created.locale }, written: created.written };
    },

    /* ---------- 技能编辑（v0.3） ---------- */
    'GET /api/modular-tables': (q) => {
      const kind = String(q.get('kind') || '').trim();
      const text = String(q.get('q') || '').trim().toLowerCase();
      let rows = COMMANDS;
      if (kind === 'consequence' || kind === 'acquirer') rows = rows.filter((c) => c.kind === kind);
      if (text) {
        rows = rows.filter((c) =>
          c.name.toLowerCase().includes(text) ||
          String(c.cls || '').toLowerCase().includes(text) ||
          String(c.summary || '').toLowerCase().includes(text));
      }
      return {
        ok: true,
        stats: modularStats(),
        counts: { consequences: CONSEQUENCES.length, acquirers: ACQUIRERS.length },
        rows: rows.map((c) => ({
          kind: c.kind, name: c.name, zh: c.zh, cls: c.cls, sig: c.sig, args: c.args,
            aliasOf: c.aliasOf || [],
          summary: c.summary, params: c.params,
        })),
      };
    },
    'GET /api/keywords': () => {
      const { letheRoot } = need();
      const t = keywordTables(letheRoot);
      return {
        ok: true,
        timings: t.timings.map((x) => ({ id: x.id, en: x.en, zh: x.zh })),
        displayTimings: t.displayTimings,
        tags: t.tags,
        sins: t.sins,
        buffs: (() => {
          const icons = buffIconIndex(letheRoot);
          return t.buffs.map((b) => {
            const ids = Array.isArray(b.ids) ? b.ids : (b.id ? [b.id] : []);
            const hit = ids.map((x) => icons.get(String(x))).find(Boolean) || null;
            return hit ? Object.assign({}, b, { icon: hit }) : b;
          });
        })(),
        keywords: t.keywords.map((x) => ({ id: x.id, zh: x.zh })),
        modBuffs: t.modBuffs || [],
        buffOwners: t.buffOwners || [],
        stats: t.stats,
        physical: PHYSICAL_TYPES,
        sin: SIN_TYPES,
        coinColors: COIN_COLORS,
        passiveConditions: PASSIVE_CONDITION_TYPES,
        buffClasses: BUFF_CLASSES,
        buffTypes: BUFF_TYPES,
        moduleKinds: MODULE_KINDS,
        passiveDefaults: DEFAULT_PASSIVE_INFO,
        buffDefaults: DEFAULT_BUFF_INFO,
        timingArgs: TIMING_ARGS, argEnums: ARG_ENUMS,
      argOptional: ARG_OPTIONAL, argCounts: ARG_COUNTS,
      };
    },

    'GET /api/keywords/suggest': (q) => {
      const { letheRoot } = need();
      const text = String(q.get('q') || '').trim();
      const limit = Math.max(1, Math.min(10, Number(q.get('limit')) || 5));
      if (!text) return { ok: true, list: [] };
      return { ok: true, list: suggestCandidates(text, keywordTables(letheRoot), limit) };
    },
    'POST /api/description/check': (body) => {
      const { letheRoot } = need();
      const tables = keywordTables(letheRoot);
      const text = String(body?.text ?? '');
      const res = analyzeDescription(text, tables);
      const suggestions = suggestUnknown(res.unknown || [], tables).slice(0, 1);
      return { ok: true, ...res, suggestions, game: toGameText(text, tables) };
    },

    'GET /api/skills': (q) => {
      const { letheRoot } = need();
      const name = q.get('name') || '';
      return {
        ok: true,
        skills: name ? listSkills(letheRoot, name) : [],
        modules: listModules(letheRoot),
        defaults: DEFAULT_INFO,
      };
    },

    'GET /api/skill': (q) => {
      const { letheRoot } = need();
      const one = getSkill(letheRoot, q.get('name'), q.get('id'));
      if (!one) { const e = new Error('找不到这个技能'); e.status = 404; throw e; }
      const lv = (one.locale && one.locale.levelList) || [];
      const coinSegs = (x) => (((x || {}).coinlist) || []).reduce((n, c) => n + ((((c || {}).coindescs) || []).filter((d) => String((d || {}).desc || '').trim()).length), 0);
      const lvPick = (lv.slice().sort((a, b) => (coinSegs(b) - coinSegs(a)) || (String((b || {}).desc || '').length - String((a || {}).desc || '').length) || (Number((a || {}).level || 1) - Number((b || {}).level || 1)))[0]) || {};
      const name = (lvPick.name) || (one.locale && one.locale.name) || '';
      return {
        ok: true,
        skill: {
          id: one.id,
          rel: one.rel,
          name,
          override: Boolean(one.override),
          hasLocale: Boolean(one.locale),
          updatedAt: one.meta.updatedAt || '',
          info: one.meta.info,
          code: (() => {
            const sd0 = ((((one.entity || {}).skillData) || [])[0]) || {};
            const coins0 = Array.isArray(sd0.coinList) ? sd0.coinList : [];
            const fileCoins = coins0.map((c) => ({
              color: coinColor((c || {}).color),
              value: Number((c || {}).scale) || 0,
            }));
            const codePath = skillCodePath(letheRoot, q.get('name'), one.id);
            const hasCodeFile = fs.existsSync(codePath);
            const draft = (one.meta && one.meta.code) || {};
            const draftCoins = Array.isArray(draft.coins) ? draft.coins : [];
            // 过期草稿判定（两道）：①硬币数与文件不一致；②草稿写盘时间早于技能实体文件（说明文件后来被改过，如加了硬币 / 改了威力）
            let draftFresh = false;
            if (hasCodeFile && draftCoins.length === fileCoins.length) {
              try {
                const codeMs = fs.statSync(codePath).mtimeMs;
                const entMs = fs.statSync(join(modDirSafe(letheRoot, q.get('name')), one.rel)).mtimeMs;
                draftFresh = codeMs >= entMs - 1500;
              } catch (e) { draftFresh = true; }
            }
            if (draftFresh) {
              return {
                ...draft,
                coins: draftCoins.map((c, i) => ({
                  ...c,
                  color: fileCoins[i].color,
                  value: Number.isFinite(Number(c && c.value)) ? Number(c.value) : fileCoins[i].value,
                })),
              };
            }
            return {
              ...draft,
              coins: fileCoins.map((f, i) => ({
                color: f.color,
                value: f.value,
                modules: Array.isArray(draftCoins[i] && draftCoins[i].modules) ? [...draftCoins[i].modules] : [],
              })),
            };
          })(),
          description: one.meta.description,
          coinDescs: one.meta.coinDescs,
          descSource: String(one.meta.description || '') ? 'meta' : (String(lvPick.desc || '') ? 'locale' : 'none'),
          descLevel: Number(lvPick.level || 1),
          localeDesc: String(lvPick.desc || ''),
          localeCoinDescs: (((lvPick.coinlist) || []).map((c) => (((c || {}).coindescs) || []).map((d) => String((d || {}).desc || '')).filter(Boolean).join('\n'))),
          localeCoinSegs: (((lvPick.coinlist) || []).map((c) => (((c || {}).coindescs) || []).filter((d) => String((d || {}).desc || '').trim()).length)),
          localeText: String(lvPick.desc || '') ? fromGameText(String(lvPick.desc), keywordTables(letheRoot)) : '',
          localeCoinTexts: (((lvPick.coinlist) || []).map((c) => (((c || {}).coindescs) || [])
            .map((d) => String((d || {}).desc || '')).filter(Boolean)
            .map((t) => fromGameText(t, keywordTables(letheRoot))).join('\n'))),
          fileInfo: (() => {
            const sd0 = ((((one.entity || {}).skillData) || [])[0]) || {};
            const coins0 = Array.isArray(sd0.coinList) ? sd0.coinList : [];
            const op = String(((coins0[0] || {}).operatorType) || 'ADD').toUpperCase();
            return {
              basePower: Number(sd0.defaultValue) || 0,
              coinCount: coins0.length,
              atkCorrection: Number(sd0.skillLevelCorrection) || 0,
              targetNum: Number(sd0.targetNum) || 1,
              physical: String(sd0.atkType || ''),
              sin: String(sd0.attributeType || ''),
              sign: op === 'SUB' ? 'negative' : 'positive',
              defType: String(sd0.defType || ''),
              skillType: String(one.entity.skillType || ''),
              skillTier: Number(one.entity.skillTier) || 1,
              coinValues: coins0.map((c) => Number((c || {}).scale) || 0),
              coinOps: coins0.map((c) => String((c || {}).operatorType || '').toUpperCase()),
              coinColors: coins0.map((c) => String((c || {}).color || 'GREY').toUpperCase()),
            };
          })(),
          coinTotal: ((((one.entity || {}).skillData) || [])[0] || {}).coinList ? ((((one.entity || {}).skillData) || [])[0].coinList || []).length : 0,
          scriptGroups: skillScriptGroups(letheRoot, one.entity),
          unrec: unrecSlots(letheRoot, q.get('name'), 'skill', one.id),
        },
      };
    },

    'GET /api/skill/icon': (q) => {
      const { letheRoot } = need();
      const mod = String(q.get('name') || '');
      const id = String(q.get('id') || '');
      const dir = modDirSafe(letheRoot, mod);
      const base = join(dir, 'custom_sprites');
      const names = ['skill_' + id + '.png', 'skill_' + id + '_1.png', 'skill_' + id + '.webp'];
      for (const n of names) {
        const p = join(base, n);
        if (fs.existsSync(p) && fs.statSync(p).size <= 4 * 1024 * 1024) {
          const mime = /\.webp$/i.test(n) ? 'image/webp' : 'image/png';
          return { ok: true, dataUrl: 'data:' + mime + ';base64,' + fs.readFileSync(p).toString('base64'), file: n };
        }
      }
      return { ok: true, dataUrl: '', file: null };
    },
    'POST /api/skill/create': (body) => {
      const { letheRoot } = need();
      const created = createSkill(letheRoot, { name: body.name, id: body.id, displayName: body.displayName });
      return { ok: true, skill: { id: created.id, entity: created.entity, locale: created.locale }, written: created.written };
    },

    'POST /api/skill/state': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const res = saveSkillFields(letheRoot, { name: body.name, id, info: body.info || {} });
      if (res.changes && res.changes.length) {
        session.record(body.name, 'skill:' + id, '改技能基础信息 ' + id, res.changes);
        autosave.touch(body.name);
      }
      return { ok: true, info: res.info, session: session.state(body.name) };
    },

    'POST /api/skill/meta': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const patch = {};
      if (body.info) patch.info = body.info;
      if (body.description !== undefined) patch.description = String(body.description);
      if (Array.isArray(body.coinDescs)) patch.coinDescs = body.coinDescs.map((x) => String(x ?? ''));
      const res = patchSkillMetaSafe(letheRoot, body.name, id, patch);
      if (res.change && res.change.before !== res.change.after) {
        session.record(body.name, 'skill:' + id, '编辑技能 ' + id, [{ rel: null, abs: res.change.abs, before: res.change.before, after: res.change.after }]);
        autosave.touch(body.name);
      }
      return { ok: true, meta: res.change.doc, session: session.state(body.name) };
    },

    'POST /api/skill/code': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const meta = readSkillMeta(letheRoot, body.name, id);
      const change = writeSkillCode(letheRoot, body.name, id, { ...(body.code || {}), coinCount: (body.code && body.code.coins ? body.code.coins.length : meta.info.coinCount) });
      const merged = readSkillMeta(letheRoot, body.name, id);
      return { ok: true, meta: merged, changed: change.before !== change.after };
    },

    'POST /api/skill/save': (body) => {
      const id = String(body.id);
      session.clear(body.name, 'skill:' + id);
      return { ok: true, committed: true, session: session.state(body.name) };
    },

    'GET /api/skill-search': (q) => {
      const { letheRoot } = need();
      return { ok: true, results: searchSkillIndex(letheRoot, q.get('q') || '', Number(q.get('limit') || 60)) };
    },

    'GET /api/vanilla-skills': (q) => {
      const { letheRoot } = need();
      return { ok: true, skills: skillsOfVanillaPersonality(letheRoot, q.get('personalityId')) };
    },

    'POST /api/skill/import': (body) => {
      const { letheRoot } = need();
      const res = importSkills(letheRoot, { name: body.name, ids: body.ids, source: body.source || { kind: 'vanilla' } });
      return { ok: true, ...res };
    },


    /* ---------- 模块编辑（v0.4） ---------- */
      'GET /api/scopes': () => ({ ok: true, scopes: SCOPES, timingScope: TIMING_SCOPE, commandScope: COMMAND_SCOPE, timingContainers: TIMING_CONTAINERS, commandContainers: COMMAND_CONTAINERS }),

    'GET /api/modules': () => {
      const { letheRoot } = need();
      const mods = listModules(letheRoot).map((m) => {
        let code = '';
        try { const rows = compileProgram(m.program) || []; code = Array.isArray(rows) ? rows.join('\n') : String(rows || ''); } catch (e) { code = ''; }
        return { ...m, code };
      });
      return { ok: true, modules: mods };
    },

    'GET /api/module/usage': () => {
    const letheRoot = state.letheRoot;
    return { ok: true, usage: moduleUsageCounts(letheRoot), scannedAt: new Date().toISOString() };
  },
  'GET /api/module': (q) => {
      const { letheRoot } = need();
      const one = getModule(letheRoot, q.get('id'));
      if (!one) { const e = new Error('找不到这个模块'); e.status = 404; throw e; }
      return { ok: true, module: one };
    },

    'POST /api/module/create': (body) => {
      const { letheRoot } = need();
      const one = createModule(letheRoot, { name: body.name, desc: body.desc, prefix: body.prefix, kind: body.kind, scope: body.scope });
      return { ok: true, module: one };
    },

    'POST /api/module/save': (body) => {
      const { letheRoot } = need();
      const one = updateModule(letheRoot, body.id, { name: body.name, desc: body.desc, prefix: body.prefix, kind: body.kind, scope: body.scope });
      return { ok: true, module: one };
    },

    'POST /api/module/program': (body) => {
      const { letheRoot } = need();
      const one = writeModuleProgram(letheRoot, body.id, body.program, { expectUpdatedAt: body.expectUpdatedAt, force: !!body.force });
      return { ok: true, module: one };
    },

    'GET /api/module/compiled': (q) => {
      const { letheRoot } = need();
      const one = getModule(letheRoot, q.get('id'));
      if (!one) { const e = new Error('找不到这个模块'); e.status = 404; throw e; }
      return { ok: true, id: one.id, lines: compileProgram(one.program), rows: compileTimingRows(one.program), manual: one.program.manual || {} };
    },

    'POST /api/skill/apply': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const meta = readSkillMeta(letheRoot, body.name, id);
      const res = saveCompiledSkill(letheRoot, {
        name: body.name, id,
        displayName: body.displayName,
        info: meta.info || {}, code: meta.code || {},
        description: meta.description, coinDescs: meta.coinDescs,
      });
      session.clear(body.name, 'skill:' + id);
      autosave.touch(body.name);
      log ? log('[wb] 技能已写回 ' + body.name + '/' + id + '（' + res.scripts + ' 个脚本）') : 0;
      return { ok: true, applied: res.scripts, missing: res.missing || [], backups: res.backups || [], written: res.written || [] };
    },

    'POST /api/passive/apply': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const meta = readPassiveMeta(letheRoot, body.name, id);
      const res = saveCompiledPassive(letheRoot, { name: body.name, id, displayName: body.displayName, info: meta.info || {}, code: meta.code || {}, description: meta.description });
      session.clear(body.name, 'passive:' + id);
      autosave.touch(body.name);
      return { ok: true, applied: res.scripts, missing: res.missing || [], backups: res.backups || [] };
    },

    'POST /api/buff/apply': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const meta = readBuffMeta(letheRoot, body.name, id);
      const res = saveCompiledBuff(letheRoot, { name: body.name, id, displayName: body.displayName, info: meta.info || {}, code: meta.code || {}, description: meta.description });
      session.clear(body.name, 'buff:' + id);
      autosave.touch(body.name);
      return { ok: true, applied: res.scripts, missing: res.missing || [], backups: res.backups || [] };
    },

    'POST /api/module/delete': (body) => {
      const { letheRoot } = need();
      return { ok: true, ...deleteModule(letheRoot, body.id, { allowTest: !!body.allowTest }) };
    },

    /* ---------- 被动编辑（v0.4） ---------- */
    'GET /api/passives': (q) => {
      const { letheRoot } = need();
      const name = q.get('name') || '';
      return {
        ok: true,
        passives: name ? listPassives(letheRoot, name) : [],
        modules: listModules(letheRoot),
        defaults: DEFAULT_PASSIVE_INFO,
      };
    },

    'GET /api/passive': (q) => {
      const { letheRoot } = need();
      const one = getPassive(letheRoot, q.get('name'), q.get('id'));
      if (!one) { const e = new Error('找不到这个被动'); e.status = 404; throw e; }
      const localeDescRaw = String((one.locale && one.locale.desc) || '');
      let descSource = 'meta';
      let descText = String(one.meta.description || '');
      if (!descText && localeDescRaw) {
        try { descText = fromGameText(localeDescRaw, keywordTables(letheRoot)); } catch { descText = localeDescRaw; }
        descSource = 'locale';
      }
      const scripts = Array.isArray(one.entity && one.entity.requireIDList)
        ? one.entity.requireIDList.map((x) => String(x == null ? '' : x)).filter(Boolean)
        : [];
      const parsed = parseScripts(scripts);
      const byCode = moduleCodeIndex(letheRoot);
      const matchedModules = scripts.map((code) => byCode.get(canonicalCode(code)) || null);
      return {
        ok: true,
        passive: {
          id: one.id,
          scripts,
          parsed,
          matchedModules,
      unrec: unrecSlots(letheRoot, q.get('name'), 'passive', one.id),
          rel: one.rel,
          name: (one.locale && one.locale.name) || '',
          localeName: (one.locale && one.locale.name) || '',
          localeDesc: (one.locale && one.locale.desc) || '',
          override: Boolean(one.override),
          hasLocale: Boolean(one.locale),
          updatedAt: one.meta.updatedAt || '',
          info: one.meta.info,
          conditions: {
            stock: Array.isArray(one.entity && one.entity.attributeStockCondition) ? one.entity.attributeStockCondition : [],
            resonance: Array.isArray(one.entity && one.entity.attributeResonanceCondition) ? one.entity.attributeResonanceCondition : [],
          },
          code: one.meta.code,
          description: descText,
          descriptionSource: descSource,
          localeDescRaw,
        },
      };
    },

    'POST /api/passive/create': (body) => {
      const { letheRoot } = need();
      const created = createPassive(letheRoot, { name: body.name, id: body.id, displayName: body.displayName, desc: body.desc });
      return { ok: true, passive: { id: created.id, entity: created.entity, locale: created.locale }, written: created.written };
    },

    'POST /api/passive/meta': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const patch = {};
      if (body.info) patch.info = body.info;
      if (body.description !== undefined) patch.description = String(body.description);
      const before = readPassiveMeta(letheRoot, body.name, id);
      const res = patchPassiveMeta(letheRoot, body.name, id, patch);
      if (res.change && res.change.before !== res.change.after) {
        session.record(body.name, 'passive:' + id, '编辑被动 ' + id, [{ rel: null, abs: res.change.abs, before: res.change.before, after: res.change.after }]);
        autosave.touch(body.name);
      }
      return { ok: true, meta: res.meta, session: session.state(body.name) };
    },

    'POST /api/passive/state': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const res = savePassiveFields(letheRoot, {
        name: body.name,
        id,
        info: body.info || {},
        displayName: body.displayName,
        description: body.description,
      });
      const changes = [];
      if (res.change && res.change.before !== res.change.after) {
        changes.push({ rel: null, abs: res.change.abs, before: res.change.before, after: res.change.after });
      }
      for (const c of (res.changes || [])) {
        if (c.before !== c.after) changes.push({ rel: c.rel, before: c.before, after: c.after });
      }
      if (changes.length) {
        session.record(body.name, 'passive:' + id, '编辑被动 ' + id, changes);
        autosave.touch(body.name);
      }
      return {
        ok: true,
        passive: {
          id,
          entity: res.entity,
          name: String(body.displayName || ''),
          conditions: {
            stock: Array.isArray(res.entity.attributeStockCondition) ? res.entity.attributeStockCondition : [],
            resonance: Array.isArray(res.entity.attributeResonanceCondition) ? res.entity.attributeResonanceCondition : [],
          },
        },
        session: session.state(body.name),
      };
    },

    'POST /api/passive/code': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const change = writePassiveMeta(letheRoot, body.name, id, { code: body.code || {} });
      return { ok: true, meta: change.doc, changed: change.before !== change.after };
    },

    'POST /api/passive/save': (body) => {
      const id = String(body.id);
      session.clear(body.name, 'passive:' + id);
      return { ok: true, committed: true, session: session.state(body.name) };
    },

    'GET /api/passive-search': (q) => {
      const { letheRoot } = need();
      return { ok: true, results: searchPassiveIndex(letheRoot, q.get('q') || '', Number(q.get('limit') || 80)) };
    },

    'POST /api/passive/import': (body) => {
      const { letheRoot } = need();
      const res = importPassives(letheRoot, { name: body.name, ids: body.ids, source: body.source || { kind: 'vanilla' } });
      return { ok: true, ...res };
    },

    /* ---------- Buff 编辑（v0.4） ---------- */
    'GET /api/buffs': (q) => {
      const { letheRoot } = need();
      const name = q.get('name') || '';
      return {
        ok: true,
        buffs: name ? listBuffs(letheRoot, name) : [],
        modules: listModules(letheRoot),
        defaults: DEFAULT_BUFF_INFO,
      };
    },

    'GET /api/buff': (q) => {
      const { letheRoot } = need();
      const one = getBuff(letheRoot, q.get('name'), q.get('id'));
      if (!one) { const e = new Error('找不到这个 Buff'); e.status = 404; throw e; }
      const ent = one.entity || {};
      let localeDescRaw = String((one.locale && one.locale.desc) || '');
      let descSource = 'meta';
      let descText = String(one.meta.description || '');
      let vanillaLocale = null;
      if (!descText && localeDescRaw) {
        try { descText = fromGameText(localeDescRaw, keywordTables(letheRoot)); } catch { descText = localeDescRaw; }
        descSource = 'locale';
      }
      if (!descText) {
        vanillaLocale = vanillaBuffLocale(letheRoot, one.id);
        if (vanillaLocale && vanillaLocale.desc) {
          localeDescRaw = vanillaLocale.desc;
          try { descText = fromGameText(vanillaLocale.desc, keywordTables(letheRoot)); } catch { descText = vanillaLocale.desc; }
          descSource = 'vanilla';
        }
      }
      const scripts = (Array.isArray(ent.list) ? ent.list : [])
        .map((x) => String((x && x.ability) || ''))
        .filter(isModularScript);
      const plainAbilities = (Array.isArray(ent.list) ? ent.list : [])
        .map((x) => String((x && x.ability) || ''))
        .filter((x) => x && !isModularScript(x));
      const parsed = parseScripts(scripts);
      const byCode = moduleCodeIndex(letheRoot);
      const matchedModules = scripts.map((code) => byCode.get(canonicalCode(code)) || null);
      const fileInfo = {
        buffClass: String(ent.buffClass || ''),
        buffType: String(ent.buffType || ''),
        canBeDespelled: ent.canBeDespelled !== false,
        maxStack: ent.maxStack == null ? null : Number(ent.maxStack),
        maxTurn: ent.maxTurn == null ? null : Number(ent.maxTurn),
        iconId: String(ent.iconId || ''),
        destroyableOnZero: ent.destroyableOnZero === true,
        destroyableOnZeroTurn: ent.destroyableOnZeroTurn === true,
        destroyableOnDie: ent.destroyableOnDie === true,
        destroyableOnRetreat: ent.destroyableOnRetreat === true,
        destroyableOnBothZero: ent.destroyableOnBothZero === true,
        attributeType: String(ent.attributeType || ''),
        stackLimitPerTurn: ent.stackLimitPerTurn == null ? null : Number(ent.stackLimitPerTurn),
        totalStack: ent.totalStack == null ? null : Number(ent.totalStack),
        subIdList: Array.isArray(ent.subIdList) ? ent.subIdList.map((x) => String(x)) : [],
        categoryKeywordList: Array.isArray(ent.categoryKeywordList) ? ent.categoryKeywordList.map((x) => String(x)) : [],
        listCount: Array.isArray(ent.list) ? ent.list.length : 0,
        listEntries: (Array.isArray(ent.list) ? ent.list : []).map((x) => String((x && x.ability) || '')),
        listRaw: (Array.isArray(ent.list) ? ent.list : []).map((x) => {
          const item = x && typeof x === 'object' ? x : {};
          try { return JSON.parse(JSON.stringify(item)); } catch { return {}; }
        }),
      };
      return {
        ok: true,
        buff: {
          id: one.id,
          rel: one.rel,
          name: (one.locale && one.locale.name) || (vanillaLocale ? vanillaLocale.name : '') || '',
          localeName: (one.locale && one.locale.name) || (vanillaLocale ? vanillaLocale.name : '') || '',
          localeDesc: (one.locale && one.locale.desc) || '',
          localeDescRaw,
          override: Boolean(one.override),
          hasLocale: Boolean(one.locale),
          updatedAt: one.meta.updatedAt || '',
          info: one.meta.info,
          fileInfo,
          infoSource: 'file',
          code: one.meta.code,
          scripts,
          plainAbilities,
          parsed,
          matchedModules,
      unrec: unrecSlots(letheRoot, q.get('name'), 'buff', one.id),
          description: descText,
          descriptionSource: descSource,
        },
      };
    },

    'POST /api/buff/create': (body) => {
      const { letheRoot } = need();
      const created = createBuff(letheRoot, { name: body.name, id: body.id, displayName: body.displayName, desc: body.desc, info: body.info });
      return { ok: true, buff: { id: created.id, entity: created.entity, locale: created.locale }, written: created.written };
    },

    'POST /api/buff/scripts': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const res = saveBuffScripts(letheRoot, { name: body.name, id, list: body.list });
      session.record(body.name, 'buff:' + id, '编辑 Buff 脚本 ' + id, res.changes || []);
      autosave.touch(body.name);
      return { ok: true, count: res.count, session: session.state(body.name) };
    },

    'POST /api/buff/fields': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const res = saveBuffFields(letheRoot, { name: body.name, id, fields: body.fields || {} });
      if (res.changed) {
        session.record(body.name, 'buff:' + id, '编辑 Buff 文件字段 ' + (res.touched || []).join('/'), res.changes || []);
        autosave.touch(body.name);
      }
      return { ok: true, touched: res.touched || [], changed: Boolean(res.changed), session: session.state(body.name) };
    },

    'POST /api/buff/meta': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const patch = {};
      if (body.info) patch.info = body.info;
      if (body.description !== undefined) patch.description = String(body.description);
      const res = patchBuffMeta(letheRoot, body.name, id, patch);
      if (res.change && res.change.before !== res.change.after) {
        session.record(body.name, 'buff:' + id, '编辑 Buff ' + id, [{ rel: null, abs: res.change.abs, before: res.change.before, after: res.change.after }]);
        autosave.touch(body.name);
      }
      return { ok: true, meta: res.meta, session: session.state(body.name) };
    },

    'POST /api/buff/code': (body) => {
      const { letheRoot } = need();
      const id = String(body.id);
      const change = writeBuffMeta(letheRoot, body.name, id, { code: body.code || {} });
      return { ok: true, meta: change.doc, changed: change.before !== change.after };
    },

    'POST /api/buff/save': (body) => {
      const id = String(body.id);
      session.clear(body.name, 'buff:' + id);
      return { ok: true, committed: true, session: session.state(body.name) };
    },

    'GET /api/buff-search': (q) => {
      const { letheRoot } = need();
      return { ok: true, results: searchBuffIndex(letheRoot, q.get('q') || '', Number(q.get('limit') || 80)) };
    },

    'POST /api/buff/import': (body) => {
      const { letheRoot } = need();
      const res = importBuffs(letheRoot, { name: body.name, ids: body.ids, source: body.source || { kind: 'vanilla' } });
      return { ok: true, ...res };
    },

    /* ---------- 镜牢数据表：卡包 / 饰品（同一个模块，字段表在 lethe/mdtables.mjs） ---------- */
    'GET /api/md/kinds': () => ({ ok: true, kinds: mdSchemas() }),

    'GET /api/md/list': (q) => {
      const { letheRoot } = need();
      const kind = q.get('kind');
      return { ok: true, kind, items: listMd(letheRoot, q.get('name') || '', kind) };
    },

    'GET /api/md/one': (q) => {
      const { letheRoot } = need();
      return { ok: true, ...getMd(letheRoot, q.get('name') || '', q.get('kind'), q.get('id')) };
    },

    'GET /api/md/next': (q) => {
      const { letheRoot } = need();
      return { ok: true, id: nextMdId(letheRoot, q.get('name') || '', q.get('kind')) };
    },

    'POST /api/md/save': (body) => {
      const { letheRoot } = need();
      const doc = saveMd(letheRoot, body.name, body.kind, body);
      autosave.touch('');
      log ? log('[wb] 已保存 ' + body.kind + ' ' + doc.id) : 0;
      return { ok: true, doc: { id: doc.id, updatedAt: doc.updatedAt } };
    },

    'POST /api/md/delete': (body) => {
      const { letheRoot } = need();
      const res = deleteMd(letheRoot, body.name, body.kind, body.id);
      autosave.touch('');
      log ? log('[wb] 已删除 ' + body.kind + ' 草稿 ' + body.id) : 0;
      return { ok: true, ...res };
    },

    'POST /api/md/apply': (body) => {
      const { letheRoot } = need();
      const res = applyMd(letheRoot, body.name, body.kind, body.id);
      autosave.touch('');
      log ? log('[wb] 已落地 ' + body.kind + ' ' + body.id + '：' + res.files.join('、')) : 0;
      return { ok: true, ...res };
    },

    'POST /api/md/remove-landed': (body) => {
      const { letheRoot } = need();
      const res = removeLanded(letheRoot, body.name, body.kind, body.id);
      autosave.touch('');
      log ? log('[wb] 已撤掉落地 ' + body.kind + ' ' + body.id + '：搬走 ' + res.moved.length + ' 个文件') : 0;
      const doc = getMd(letheRoot, body.name, body.kind, body.id);
      return { ok: true, ...res, doc };
    },

    'POST /api/md/apply-all': (body) => {
      const { letheRoot } = need();
      const res = applyMdAll(letheRoot, body.name, body.kind);
      autosave.touch('');
      log ? log('[wb] 批量落地 ' + body.kind + '：成功 ' + res.landed.length + '，失败 ' + res.failed.length) : 0;
      return { ok: true, ...res };
    },

    'GET /api/pick/kinds': () => ({ ok: true, kinds: pickKinds() }),

    'GET /api/pick/list': (q) => {
      const { letheRoot } = need();
      const kind = q.get('kind') || 'skill';
      const res = pickSearch(letheRoot, kind, {
        q: q.get('q') || '',
        limit: Number(q.get('limit')) || 80,
        modOnly: q.get('modOnly') === '1',
        refresh: q.get('refresh') === '1',
      });
      return { ok: true, ...res };
    },

    'POST /api/md/clone': (body) => {
      const { letheRoot } = need();
      const kind = String(body.kind || '');
      const PICK_OF = { enemy: 'unit', mob: 'unit', part: 'part', egogift: 'gift', cardpack: 'pack', battle: 'battle' };
      const found = pickRecord(letheRoot, PICK_OF[kind] || kind, String(body.fromId || ''), { cat: String(body.cat || '') });
      if (!found) throw new Error('游戏与 Mod 里都没有这个 id：' + body.fromId);
      const entity = fromGameEntity(kind, found.entity);
      const id = nextMdId(letheRoot, body.name, kind);
      const spec = mdSchemas().find((x) => x.kind === kind);
      const loc = { name: String(body.name || '') ? '' : '', desc: '', nameZh: '', descZh: '' };
      const doc = saveMd(letheRoot, body.name, kind, { id, entity, locale: { ...loc, name: String(body.label || '') } });
      autosave.touch('');
      log ? log('[wb] 从 ' + found.source + (found.mod ? '/' + found.mod : '') + ' 载入 ' + kind + ' ' + found.entity.id + ' → 新草稿 ' + id) : 0;
      return { ok: true, id: doc.id, from: { source: found.source, mod: found.mod, id: String(found.entity.id) }, zh: spec ? spec.zh : kind };
    },

    /* ---------- v0.9.18：单条脚本槽（未识别模块） ---------- */
    'POST /api/script/slot': (body) => {
      const { letheRoot } = need();
      const res = writeScriptSlot(letheRoot, {
        name: body.name, kind: body.kind, id: body.id,
        where: body.where || 'main', coin: body.coin, index: body.index, text: body.text,
      });
      if (body.name) { try { session.record(body.name, String(body.kind || 'skill') + ':' + body.id, '编辑未识别脚本', res.changes || []); } catch (e) {} }
      return { ok: true, ...res };
    },

    'POST /api/script/parse': (body) => {
      const text = String((body && body.text) || '');
      if (!isModularScript(text)) return { ok: false, parseable: false, error: '这不是 Modular 语法，无法解析成积木' };
      let program = null;
      try { program = parseScripts([text]); } catch (e) { program = null; }
      const rows = (program && program.rows) || [];
      const blocks = (program && program.program && program.program.blocks) || [];
      return { ok: true, parseable: rows.length > 0, program: blocks.length ? { version: 1, blocks } : null, rows: rows.length };
    },

    'POST /api/reveal': async (body) => {      const p = String(body.path || '');
      const { letheRoot } = need();
      const low = p.toLowerCase();
      const insideOf = (base) => Boolean(base) && (low === String(base).toLowerCase() || low.startsWith(String(base).toLowerCase() + '\\'));
      const okRoot = insideOf(letheRoot);
      const okUser = insideOf(USER_DATA_DIR);
      // 插件目录：Lethe 的上级；另兼容 gameRoot 指向 BepInEx 或其上级的两种情形
      const bases = [];
      if (letheRoot) bases.push(dirname(letheRoot));
      if (state.gameRoot) {
        bases.push(join(state.gameRoot, 'BepInEx', 'plugins'));
        bases.push(join(state.gameRoot, 'plugins'));
        bases.push(state.gameRoot);
      }
      const okPlugins = bases.some((b) => insideOf(b));
      if (!okRoot && !okUser && !okPlugins) {
        const err = new Error('只允许打开私服、插件目录或用户数据目录内的路径');
        err.status = 400;
        throw err;
      }
      const { spawn } = await import('node:child_process');
      spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true };
    },
  };

  return createApi(api);
}

export function fallbackCharacters() {
  return [
    { id: 1, name: '李箱' }, { id: 2, name: '浮士德' }, { id: 3, name: '堂吉诃德' },
    { id: 4, name: '良秀' }, { id: 5, name: '默尔索' }, { id: 6, name: '鸿璐' },
    { id: 7, name: '希斯克利夫' }, { id: 8, name: '以实玛利' }, { id: 9, name: '罗佳' },
    { id: 10, name: '辛克莱' }, { id: 11, name: '奥提斯' }, { id: 12, name: '格里高尔' },
  ];
}