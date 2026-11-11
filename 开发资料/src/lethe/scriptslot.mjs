/**
 * 单条脚本槽位读写：技能/硬币/被动/Buff 里「未识别模块」的原文。
 * 只改目标位置，不触碰其他字段；写入走 writeFilesTransactional（临时→备份→原子替换→失败回滚）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeFilesTransactional } from '../atomic.mjs';
import { readModPayload, modDirSafe } from './mods.mjs';
import { SafetyError } from '../safety.mjs';
import { clearSkillCache } from './skills.mjs';

function entityOf(payload, cat, id) {
  const list = (payload && payload.data && payload.data[cat]) || [];
  const hit = list.find((x) => String(x.entity && x.entity.id) === String(id));
  if (!hit) throw new SafetyError('找不到 ' + cat + ' ' + id);
  return hit;
}

function fileOf(dir, rel) {
  return JSON.parse(readFileSync(join(dir, ...String(rel).split('/')), 'utf8'));
}

function writeDoc(letheRoot, dir, mod, rel, doc) {
  return writeFilesTransactional({ modDir: dir, files: [{ rel, content: JSON.stringify(doc, null, 2) }], root: letheRoot, mod });
}

function wrapList(doc) {
  if (Array.isArray(doc)) return { list: doc };
  if (doc && Array.isArray(doc.list)) return doc;
  return doc;
}

/** where: 'skill' | 'coin' | 'main'; coin 仅技能硬币用；index 为该数组内的下标 */
export function writeScriptSlot(letheRoot, { name, kind, id, where = 'main', coin = 0, index = 0, text = '' } = {}) {
  const mod = String(name || '');
  const dir = modDirSafe(letheRoot, mod);
  const payload = readModPayload(dir);
  const cat = kind === 'skill' ? 'skill' : kind === 'passive' ? 'passive' : kind === 'buff' ? 'buff' : null;
  if (!cat) throw new SafetyError('未知类型：' + kind);
  const found = entityOf(payload, cat, id);
  const doc = wrapList(fileOf(dir, found.rel));
  const list = Array.isArray(doc.list) ? doc.list : [];
  const ent = list.find((x) => String(x && x.id) === String(id));
  if (!ent) throw new SafetyError('文件里找不到实体 ' + id);
  const t = String(text == null ? '' : text).trim();
  if (t.length > 20000) throw new SafetyError('单条脚本太长（上限 20000 字符）');

  if (cat === 'skill') {
    const seg = Array.isArray(ent.skillData) ? ent.skillData[0] : null;
    if (!seg) throw new SafetyError('这个技能没有脚本段');
    let arr;
    if (where === 'coin') {
      const ci = Number(coin);
      if (!Number.isInteger(ci) || ci < 0) throw new SafetyError('硬币序号不合法：' + coin);
      const c = Array.isArray(seg.coinList) ? seg.coinList[ci] : null;
      if (!c) throw new SafetyError('第 ' + (ci + 1) + ' 枚硬币不存在');
      if (!Array.isArray(c.abilityScriptList)) c.abilityScriptList = [];
      arr = c.abilityScriptList;
    } else {
      if (!Array.isArray(seg.abilityScriptList)) seg.abilityScriptList = [];
      arr = seg.abilityScriptList;
    }
    const i = Number(index) || 0;
    if (!t) { if (i >= 0 && i < arr.length) arr.splice(i, 1); }
    else if (i >= 0 && i < arr.length) { const prev = arr[i] && typeof arr[i] === 'object' ? arr[i] : {}; arr[i] = Object.assign({}, prev, { scriptName: t }); }
    else arr.push({ scriptName: t });
  } else if (cat === 'passive') {
    if (!Array.isArray(ent.requireIDList)) ent.requireIDList = [];
    const i = Number(index) || 0;
    if (!t) { if (i >= 0 && i < ent.requireIDList.length) ent.requireIDList.splice(i, 1); }
    else if (i >= 0 && i < ent.requireIDList.length) ent.requireIDList[i] = t;
    else ent.requireIDList.push(t);
  } else {
    if (!Array.isArray(ent.list)) ent.list = [];
    const i = Number(index) || 0;
    if (!t) { if (i >= 0 && i < ent.list.length) ent.list.splice(i, 1); }
    else if (i >= 0 && i < ent.list.length) { const prev = ent.list[i] && typeof ent.list[i] === 'object' ? ent.list[i] : {}; ent.list[i] = Object.assign({}, prev, { ability: t }); }
    else ent.list.push({ ability: t });
  }
  const result = writeDoc(letheRoot, dir, mod, found.rel, doc);
  if (cat === 'skill') clearSkillCache(letheRoot);
  return { ok: true, kind: cat, id: String(id), where, coin: Number(coin) || 0, index: Number(index) || 0, text: t, ...result };
}

/** 读取某个实体里所有「槽位」（技能级 / 每枚硬币 / 被动 / Buff），用于前端把未识别脚本放进置入区 */
export function scriptSlotList(letheRoot, { name, kind, id } = {}) {
  const mod = String(name || '');
  const dir = modDirSafe(letheRoot, mod);
  const payload = readModPayload(dir);
  const cat = kind === 'skill' ? 'skill' : kind === 'passive' ? 'passive' : kind === 'buff' ? 'buff' : null;
  if (!cat) return [];
  const found = entityOf(payload, cat, id);
  const doc = wrapList(fileOf(dir, found.rel));
  const ent = (doc.list || []).find((x) => String(x && x.id) === String(id));
  const out = [];
  if (cat === 'skill') {
    const seg = (ent.skillData || [])[0] || {};
    (seg.abilityScriptList || []).forEach((it, i) => out.push({ where: 'skill', coin: -1, index: i, text: String((it && it.scriptName) || '') }));
    (seg.coinList || []).forEach((c, ci) => (c.abilityScriptList || []).forEach((it, i) => out.push({ where: 'coin', coin: ci, index: i, text: String((it && it.scriptName) || '') })));
  } else if (cat === 'passive') {
    (ent.requireIDList || []).forEach((it, i) => out.push({ where: 'main', coin: -1, index: i, text: String(it || '') }));
  } else {
    (ent.list || []).forEach((it, i) => out.push({ where: 'main', coin: -1, index: i, text: String((it && it.ability) || '') }));
  }
  return out.filter((x) => x.text);
}

/** 用「文本数组」整体回写某个槽位（保留旧条目的其它字段；空数组即清空） */
export function writeSlotTexts(letheRoot, { name, kind, id, where = 'main', coin = -1, texts = [] } = {}) {
  const mod = String(name || '');
  const dir = modDirSafe(letheRoot, mod);
  const payload = readModPayload(dir);
  const cat = kind === 'skill' ? 'skill' : kind === 'passive' ? 'passive' : kind === 'buff' ? 'buff' : null;
  if (!cat) throw new SafetyError('未知类型：' + String(kind));
  const found = entityOf(payload, cat, id);
  const doc = wrapList(fileOf(dir, found.rel));
  const ent = (doc.list || []).find((x) => String(x && x.id) === String(id));
  if (!ent) throw new SafetyError('在 Mod 里找不到这个条目');
  const list = (Array.isArray(texts) ? texts : []).map((t) => String(t == null ? '' : t)).filter((t) => t.trim());
  if (list.length > 400) throw new SafetyError('脚本条数太多（上限 400）');
  if (cat === 'skill') {
    if (!Array.isArray(ent.skillData)) ent.skillData = [];
    const seg = (ent.skillData[0] = ent.skillData[0] || {});
    if (String(where) === 'coin') {
      const ci = Number(coin);
      if (!Number.isInteger(ci) || ci < 0) throw new SafetyError('硬币序号不合法：' + coin);
      if (!Array.isArray(seg.coinList)) seg.coinList = [];
      if (ci >= seg.coinList.length) throw new SafetyError('第 ' + (ci + 1) + ' 枚硬币不存在');
      const c = (seg.coinList[ci] = seg.coinList[ci] || {});
      const old = Array.isArray(c.abilityScriptList) ? c.abilityScriptList : [];
      c.abilityScriptList = list.map((t, i) => (old[i] && String(old[i].scriptName || '') === t ? old[i] : { scriptName: t }));
    } else {
      const old = Array.isArray(seg.abilityScriptList) ? seg.abilityScriptList : [];
      seg.abilityScriptList = list.map((t, i) => (old[i] && String(old[i].scriptName || '') === t ? old[i] : { scriptName: t }));
    }
  } else if (cat === 'passive') {
    ent.requireIDList = list.slice();
  } else {
    const old = Array.isArray(ent.list) ? ent.list : [];
    ent.list = list.map((t, i) => {
      const prev = old[i] && typeof old[i] === 'object' ? old[i] : {};
      if (String(prev.ability || '') === t) return prev;
      return Object.assign({}, prev, { ability: t });
    });
  }
  const result = writeDoc(letheRoot, dir, mod, found.rel, doc);
  if (cat === 'skill') clearSkillCache(letheRoot);
  return { ok: true, kind: cat, id: String(id), where: String(where), coin: Number(coin) || -1, count: list.length, ...result };
}
