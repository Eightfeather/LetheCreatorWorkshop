/**
 * 镜牢数据表编辑：卡包（theme floor）/ 饰品（ego gift）/ 战斗 / 敌人（异想体）/ 敌人（普通）/ 敌人部位。
 *
 * 与技能 / 被动 / Buff 同一套逻辑：
 *   草稿（编辑器自己的）→ 保存在 <Lethe>/LCW/projects/<draftDir>/<Mod>/<id>.json
 *   落地（游戏能读的）→ 写到 <Mod>/custom_limbus_data/<gameCat>/*.json
 *                      + <Mod>/custom_limbus_locale/{EN,CN}/<localeCat>/*.json
 *
 * 字段名以 <Lethe>/dumpedData/limbus_data 的实测样本为准；字段表集中在 MD_KINDS，
 * 游戏侧一旦变化只改这里，UI 由 /api/md/kinds 下发的 schema 渲染。
 */

import { existsSync, readdirSync, unlinkSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readJson, writeFileAtomic, writeFilesTransactional } from '../atomic.mjs';
import { cleanName, SafetyError } from '../safety.mjs';
import { findLocaleEntry, modDirSafe, readModPayload } from './mods.mjs';
import { metaRoot } from './meta.mjs';

const MD_VERSION = 2;
const LOCALES = ['EN', 'CN'];

const F = (key, zh, type, extra = {}) => ({ key, zh, type, ...extra });

const SIN = [
  { id: 'CRIMSON', zh: '暴怒' }, { id: 'SCARLET', zh: '色欲' }, { id: 'AMBER', zh: '怠惰' },
  { id: 'SHAMROCK', zh: '忧郁' }, { id: 'AZURE', zh: '傲慢' }, { id: 'INDIGO', zh: '嫉妒' },
  { id: 'VIOLET', zh: '暴食' }, { id: 'WHITE', zh: '脑叶' }, { id: 'BLACK', zh: '色欲2' },
  { id: 'NEUTRAL', zh: '无属性' },
];
const PHYSICAL = [
  { id: 'SLASH', zh: '斩击' }, { id: 'PENETRATE', zh: '突刺' }, { id: 'HIT', zh: '打击' },
];

const POOL_KEYS = ['bossPool', 'battlePool', 'abBattlePool', 'hardBattlePool', 'hardAbBattlePool', 'eventPool'];

/** 卡包：镜牢主题层（mirrordungeon-theme-floor），决定这一层刷什么 */
const CARDPACK = {
  kind: 'cardpack',
  zh: '镜牢卡包',
  sub: 'MIRROR PACK',
  ico: '▦',
  gameCat: 'mirrordungeon-theme-floor',
  localeCat: 'mirrorDungeonThemeList',
  draftDir: 'packs',
  idBase: 9700,
  idType: 'number',
  idHint: '卡包 id（官方 9500 段在用，自定义建议 9700 起）',
  fields: [
    F('desc', '内部说明', 'text', { hint: '写进游戏数据的 desc 字段，不是玩家看到的名称' }),
    F('unlockCode', '解锁条件码', 'number', { min: 0, max: 9999, hint: '官方样例 108，0＝默认解锁' }),
    F('hiddenThemeRate', '隐藏主题概率', 'number', { min: 0, max: 1 }),
    F('fixedRewardEgoGifts', '固定奖励饰品', 'nums', { hint: '饰品 id，逗号分隔' }),
    F('egoGiftPool', '饰品池', 'nums', { hint: '这一层能刷到的饰品 id，逗号分隔' }),
    F('mapGenOption', '地图生成池', 'pools', {
      cols: POOL_KEYS.map((k) => ({ key: k, zh: { bossPool: 'Boss 池', battlePool: '普通战池', abBattlePool: '异想体战池', hardBattlePool: '困难战池', hardAbBattlePool: '困难异想体池', eventPool: '事件池' }[k] })),
    }),
    F('exceptionConditions', '例外条件', 'rows', {
      cols: [{ key: 'selectableFloors', zh: '可选层', type: 'nums' }, { key: 'dungeonIdx', zh: '镜牢序号', type: 'number' }],
      hint: '每行：哪些层 + 对哪个镜牢生效',
    }),
  ],
  defaults: () => ({
    desc: '',
    unlockCode: 0,
    hiddenThemeRate: 0,
    fixedRewardEgoGifts: [],
    egoGiftPool: [],
    mapGenOption: Object.fromEntries(POOL_KEYS.map((k) => [k, []])),
    exceptionConditions: [],
  }),
};

/** 饰品：镜牢 E.G.O 礼物（ego-gift-mirrordungeon） */
const EGOGIFT = {
  kind: 'egogift',
  zh: '镜牢饰品',
  sub: 'EGO GIFT',
  ico: '✧',
  gameCat: 'ego-gift-mirrordungeon',
  localeCat: 'egoGiftData',
  draftDir: 'gifts',
  idBase: 9300,
  idType: 'number',
  idHint: '饰品 id（官方 9000 段很挤，自定义建议 9300 起）',
  fields: [
    F('attributeType', '罪孽属性', 'enum', { options: 'SIN' }),
    F('tag', '标签', 'tags', { hint: '例如 TIER_4, STARTER（大写）' }),
    F('keyword', '关键词', 'text', { hint: '脚本里引用这个饰品用，例如 Sinking' }),
    F('price', '价格', 'number', { min: 0, max: 9999 }),
    F('lockType', '锁定类型', 'bool', { hint: '一般关掉' }),
    F('upgradeDataList', '强化档', 'rows', {
      cols: [
        { key: 'upgradeLevel', zh: '强化等级', type: 'number' },
        { key: 'localizeID', zh: '文案 id', type: 'number' },
        { key: 'abilityIDList', zh: '能力 id', type: 'nums' },
      ],
      hint: '每行：强化等级 + 文案 id + 能力 id（逗号分隔）',
    }),
  ],
  defaults: () => ({ attributeType: 'NEUTRAL', tag: [], keyword: '', price: 0, lockType: false, upgradeDataList: [{ upgradeLevel: 0, localizeID: 0, abilityIDList: [] }] }),
};

/** 战斗节点：镜牢里的一场仗（battle-mirrordungeon） */
const BATTLE = {
  kind: 'battle',
  zh: '战斗节点',
  sub: 'BATTLE',
  ico: '⚔',
  gameCat: 'battle-mirrordungeon',
  localeCat: null,
  draftDir: 'battles',
  idBase: 2000000,
  idType: 'number',
  idHint: '战斗 id（镜牢惯例 2000000 起）',
  fields: [
    F('stageLevel', '关卡等级', 'number', { min: 0, max: 99 }),
    F('stageType', '关卡类型', 'enum', { options: [{ id: 'Normal', zh: '普通' }, { id: 'Abnormality', zh: '异想体' }] }),
    F('participantInfo', '出战人数', 'object', { cols: [{ key: 'min', zh: '最少', type: 'number' }, { key: 'max', zh: '最多', type: 'number' }] }),
    F('battleCameraInfo', '镜头位置', 'object', { cols: [{ key: 'defaultPosX', zh: 'X', type: 'number' }, { key: 'defaultPosY', zh: 'Y', type: 'number' }, { key: 'defaultPosZ', zh: 'Z', type: 'number' }] }),
    F('waveList', '波次', 'waves', { hint: '每波：地图 / 出怪 / BGM / 双方站位' }),
    F('staminaCost', '消耗体力', 'number', { min: 0, max: 99 }),
    F('recommendedLevel', '推荐等级', 'number', { min: 0, max: 99 }),
    F('turnLimit', '回合上限', 'number', { min: 1, max: 999 }),
    F('attackType', '敌人攻击属性', 'enum', { options: [{ id: '', zh: '不限' }, ...PHYSICAL] }),
    F('attributeType', '敌人罪孽属性', 'enum', { options: 'SIN' }),
    F('questlist', '悬赏任务', 'rows', {
      cols: [{ key: 'localizeId', zh: '任务文案 id', type: 'number' }, { key: 'args', zh: '参数', type: 'text' }],
      hint: '参数逗号分隔，例如 10',
    }),
    F('rewardList', '通关奖励', 'rows', {
      cols: [
        { key: 'type', zh: '类型', type: 'enum', options: [{ id: 'EGO_GIFT', zh: 'E.G.O饰品' }] },
        { key: 'rewardId', zh: '奖励 id', type: 'number' },
        { key: 'num', zh: '数量', type: 'number' },
        { key: 'prob', zh: '概率', type: 'number' },
      ],
      hint: '镜牢战斗的原版奖励只用到 EGO_GIFT 一种；奖励 id 可以用旁边的「挑」从饰品表里选',
    }),
  ],
  defaults: () => ({
    stageLevel: 1,
    stageType: 'Normal',
    participantInfo: { min: 1, max: 5 },
    battleCameraInfo: { defaultPosX: 0, defaultPosY: 0.5, defaultPosZ: 10 },
    waveList: [{ mapName: '', mapSize: 0, bgm: '', enemyPositionID: 0, allyPositionID: 0, units: [{ unitID: 0, unitCount: 1, unitLevel: 1 }], subUnits: [] }],
    staminaCost: 0,
    recommendedLevel: 1,
    turnLimit: 20,
    attackType: '',
    attributeType: 'CRIMSON',
    questlist: [],
  }),
};

/** 敌人：异想体单位（abnormality-unit） */
const ENEMY = {
  kind: 'enemy',
  zh: '敌人',
  sub: 'ENEMY',
  ico: '☠',
  gameCat: 'abnormality-unit',
  localeCat: 'enemyList',
  draftDir: 'enemies',
  idBase: 700000,
  idType: 'number',
  idHint: '敌人 id（自定义建议 700000 起）',
  fields: [
    F('appearance', '外观资源', 'text', { hint: '外观 bundle 里的资源名，例如 !custom_iori' }),
    F('nameID', 'nameID', 'number', { hint: '游戏里按这个取名字；0＝用 locale 的 enemyList' }),
    F('level', '等级', 'number', { min: 1, max: 99 }),
    F('classType', '危险等级', 'enum', {
      options: [{ id: 'ZAYIN', zh: 'ZAYIN' }, { id: 'TETH', zh: 'TETH' }, { id: 'HE', zh: 'HE' }, { id: 'WAW', zh: 'WAW' }, { id: 'ALEPH', zh: 'ALEPH' }],
    }),
    F('attributeType', '罪孽属性', 'enum', { options: 'SIN' }),
    F('hp', '血量', 'object', { cols: [{ key: 'defaultStat', zh: '基础', type: 'number' }, { key: 'incrementByLevel', zh: '每级加成', type: 'number' }] }),
    F('patternID', '行动模式', 'text', { hint: '例如 AutoPick / PickByPattern_Abnormality_UptoActionSlotCnt' }),
    F('startActionSlotNum', '初始行动槽', 'number', { min: 1, max: 9 }),
    F('maxActionSlotNum', '最大行动槽', 'number', { min: 1, max: 9 }),
    F('abnormalityPartList', '部位 id', 'nums', { hint: 'abnormality-part 的 id，逗号分隔' }),
    F('attributeList', '技能配置', 'rows', { cols: [{ key: 'skillId', zh: '技能 id', type: 'number' }, { key: 'number', zh: '数量', type: 'number' }] }),
    F('unitKeywordList', '单位标签', 'tags', { hint: '例如 FIXER,MACHINE' }),
    F('associationList', '关联列表', 'ids', { hint: '一般留空；用于关联其它单位' }),
    F('hasMp', '启用 MP', 'bool'),
  ],
  defaults: () => ({
    appearance: '', nameID: 0, level: 1, classType: 'TETH', attributeType: 'CRIMSON',
    hp: { defaultStat: 50, incrementByLevel: 5 }, patternID: 'AutoPick',
    startActionSlotNum: 1, maxActionSlotNum: 1, abnormalityPartList: [], attributeList: [],
    unitKeywordList: [], associationList: [], hasMp: false,
  }),
};

/** 敌人：普通敌人（enemy）——镜牢里成片刷的小怪 */
const MOB = {
  kind: 'mob',
  zh: '普通敌人',
  sub: 'ENEMY MOB',
  ico: '⛨',
  gameCat: 'enemy',
  localeCat: 'enemyList',
  draftDir: 'mobs',
  idBase: 700200,
  idType: 'number',
  idHint: '敌人 id（自定义建议 700200 起）',
  fields: [
    F('sdPortrait', '立绘 id', 'text', { hint: '例如 90006；留空＝不改' }),
    F('appearance', '外观资源', 'text', { hint: '例如 90006_backstreet_hitmobAppearance' }),
    F('unitKeywordList', '单位标签', 'tags'),
    F('level', '等级', 'number', { min: 1, max: 99 }),
    F('slotWeightConditionList', '权重标签', 'tags', { hint: '默认 Default1' }),
    F('hp', '血量', 'object', { cols: [{ key: 'defaultStat', zh: '基础', type: 'number' }, { key: 'incrementByLevel', zh: '每级加成', type: 'number' }] }),
    F('defCorrection', '防御修正', 'number', { min: -9, max: 9 }),
    F('minSpeedList', '最小速度', 'nums'),
    F('maxSpeedList', '最大速度', 'nums'),
    F('breakSection', '混乱阈值', 'nums', { hint: '百分比，从右往左数' }),
    F('mp', 'MP', 'number', { min: 0, max: 999 }),
    F('lowMorale', '士气阈值', 'number', { min: -999, max: 0 }),
    F('panic', '恐慌阈值', 'number', { min: -999, max: 0 }),
    F('panicType', '恐慌类型 id', 'number'),
    F('patternID', '行动模式', 'text', { hint: '例如 99004' }),
    F('mentalConditionInfo', '精神状态加成', 'mental', { hint: '每行：add / min + 等级 + 条件 id' }),
    F('attributeList', '技能配置', 'rows', { cols: [{ key: 'skillId', zh: '技能 id', type: 'number' }, { key: 'number', zh: '数量', type: 'number' }] }),
  ],
  defaults: () => ({
    sdPortrait: '', appearance: '', unitKeywordList: [], level: 1, slotWeightConditionList: ['Default1'],
    hp: { defaultStat: 80, incrementByLevel: 0.19 }, defCorrection: 0, minSpeedList: [1], maxSpeedList: [3],
    breakSection: [], mp: 0, lowMorale: -15, panic: -20, panicType: 0, patternID: '',
    mentalConditionInfo: [], attributeList: [],
  }),
};

/** 敌人部位（abnormality-part）：异想体要打的身体部位 */
const PART = {
  kind: 'part',
  zh: '敌人部位',
  sub: 'ENEMY PART',
  ico: '◍',
  gameCat: 'abnormality-part',
  localeCat: 'stagePart',
  draftDir: 'parts',
  idBase: 700100,
  idType: 'number',
  idHint: '部位 id（自定义建议 700100 起）',
  fields: [
    F('partType', '部位类型', 'enum', {
      options: ['BODY', 'HEAD', 'LEFT_ARM', 'RIGHT_ARM', 'LEG', 'TAIL', 'BACK', 'BACK_HEAD', 'LEFT_EYE', 'RIGHT_EYE', 'HEAD_PLATE'].map((id) => ({ id, zh: id })),
    }),
    F('hp', '血量', 'object', { cols: [{ key: 'defaultStat', zh: '基础', type: 'number' }, { key: 'incrementByLevel', zh: '每级加成', type: 'number' }] }),
    F('defCorrection', '防御修正', 'number', { min: -9, max: 9 }),
    F('minSpeedList', '最小速度', 'nums'),
    F('maxSpeedList', '最大速度', 'nums'),
    F('breakSection', '混乱阈值', 'nums', { hint: '百分比，从右往左数，例如 85,40,20' }),
    F('atkResist', '物理抗性', 'rows', { cols: [{ key: 'type', zh: '属性', type: 'enum', options: 'PHYSICAL' }, { key: 'value', zh: '倍率', type: 'number' }] }),
    F('attrResist', '罪孽抗性', 'rows', { cols: [{ key: 'type', zh: '罪孽', type: 'enum', options: 'SIN' }, { key: 'value', zh: '倍率', type: 'number' }] }),
    F('slotWeightConditionList', '权重标签', 'tags', { hint: '默认 Default1' }),
    F('isDestroyable', '可破坏', 'boolstr'),
    F('skillCancelable', '可打断技能', 'boolstr'),
    F('canVanish', '会消失', 'boolstr'),
    F('canChangeSpriteOnDestoryed', '破坏后换贴图', 'boolstr'),
    F('canUseSkillOnDestroyed', '破坏后仍可用技能', 'boolstr'),
    F('spreadMpEffectToAbnormality', 'MP 效果传导本体', 'boolstr'),
    F('attributeList', '技能配置', 'rows', { cols: [{ key: 'skillId', zh: '技能 id', type: 'number' }, { key: 'number', zh: '数量', type: 'number' }] }),
  ],
  defaults: () => ({
    partType: 'BODY', hp: { defaultStat: 26, incrementByLevel: 0.62 }, defCorrection: -3,
    minSpeedList: [1], maxSpeedList: [1], breakSection: [50],
    atkResist: [{ type: 'SLASH', value: 1 }, { type: 'PENETRATE', value: 1 }, { type: 'HIT', value: 1 }],
    attrResist: [{ type: 'CRIMSON', value: 1 }, { type: 'SCARLET', value: 1 }, { type: 'AMBER', value: 1 }, { type: 'SHAMROCK', value: 1 }, { type: 'AZURE', value: 1 }, { type: 'INDIGO', value: 1 }, { type: 'VIOLET', value: 1 }, { type: 'WHITE', value: 1 }, { type: 'BLACK', value: 1 }],
    slotWeightConditionList: ['Default1'],
    isDestroyable: 'true', skillCancelable: 'true', canVanish: 'false',
    canChangeSpriteOnDestoryed: 'false', canUseSkillOnDestroyed: 'false', spreadMpEffectToAbnormality: 'true',
    attributeList: [],
  }),
};

export const MD_KINDS = { cardpack: CARDPACK, egogift: EGOGIFT, battle: BATTLE, enemy: ENEMY, mob: MOB, part: PART };

export const MD_ENUMS = { SIN, PHYSICAL };

export function mdKind(kind) {
  const spec = MD_KINDS[String(kind || '')];
  if (!spec) throw new SafetyError('没有这个镜牢表：' + kind);
  return spec;
}

/** 前端用的 schema（去掉函数，附带默认值） */
export function mdSchemas() {
  return Object.values(MD_KINDS).map((s) => ({
    kind: s.kind, zh: s.zh, sub: s.sub, ico: s.ico, idBase: s.idBase, idHint: s.idHint,
    fields: s.fields, defaults: s.defaults(), locales: LOCALES,
  }));
}

function draftDir(letheRoot, kind, mod) {
  const spec = mdKind(kind);
  return join(metaRoot(letheRoot), spec.draftDir, cleanName(mod, 'Mod 名称'));
}

function draftPath(letheRoot, kind, mod, id) {
  return join(draftDir(letheRoot, kind, mod), `${cleanId(id)}.json`);
}

export function cleanId(id) {
  const s = String(id ?? '').trim();
  if (!/^\d{1,9}$/.test(s)) throw new SafetyError('id 只能是 1–9 位数字');
  return s;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function strList(v) {
  return (Array.isArray(v) ? v : String(v ?? '').split(/[\s,，]+/)).map((x) => String(x).trim()).filter(Boolean);
}

function numList(v) {
  return strList(v).map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

function boolStr(v) {
  if (v === true || v === 'true' || v === 1) return 'true';
  return 'false';
}

/** 行编辑器：按列类型清洗（number / nums / enum / text） */
function rowVal(v, cols) {
  return (Array.isArray(v) ? v : []).map((row) => {
    const out = {};
    for (const c of cols || []) {
      if (c.type === 'number') out[c.key] = num(row?.[c.key], 0);
      else if (c.type === 'nums') out[c.key] = numList(row?.[c.key]);
      else out[c.key] = String(row?.[c.key] ?? '');
    }
    return out;
  });
}

function unitRows(v) {
  return (Array.isArray(v) ? v : []).map((u) => ({
    unitID: num(u?.unitID, 0),
    unitCount: Math.max(1, num(u?.unitCount, 1)),
    unitLevel: Math.max(1, num(u?.unitLevel, 1)),
  }));
}

function waveRows(v) {
  return (Array.isArray(v) ? v : []).map((w) => ({
    mapName: String(w?.mapName ?? ''),
    mapSize: Math.max(0, num(w?.mapSize, 0)),
    bgm: String(w?.bgm ?? ''),
    enemyPositionID: num(w?.enemyPositionID, 0),
    allyPositionID: num(w?.allyPositionID, 0),
    units: unitRows(w?.units),
    subUnits: unitRows(w?.subUnits),
  }));
}

function poolVal(v, keys = POOL_KEYS) {
  const out = {};
  for (const k of keys) out[k] = numList(v?.[k]);
  return out;
}

/** 精神状态：{add:[{level,conditionIDList:[{conditionID}]}],min:[…]} ⇄ 扁平行 */
function mentalRows(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const group of ['add', 'min']) {
    for (const g of v.filter((x) => (x?.group || 'add') === group)) {
      out.push({ group, level: num(g?.level, 1), conditionIDs: strList(g?.conditionIDs) });
    }
  }
  return out;
}

export function normalizeMd(kind, input = {}) {
  const spec = mdKind(kind);
  const base = spec.defaults();
  const src = { ...base, ...(input.entity || {}) };
  const entity = {};
  for (const f of spec.fields) {
    const v = src[f.key];
    switch (f.type) {
      case 'number': entity[f.key] = num(v, base[f.key] ?? 0); break;
      case 'bool': entity[f.key] = v === true || v === 'true' || v === 1; break;
      case 'boolstr': entity[f.key] = boolStr(v); break;
      case 'ids': entity[f.key] = strList(v); break;
      case 'nums': entity[f.key] = numList(v); break;
      case 'tags': entity[f.key] = strList(v).map((x) => x.toUpperCase()); break;
      case 'scripts': entity[f.key] = strList(v); break;
      case 'nodes': entity[f.key] = (Array.isArray(v) ? v : []).map((x) => ({ type: String(x?.type || 'BATTLE'), count: Math.max(1, num(x?.count, 1)) })); break;
      case 'waves': entity[f.key] = waveRows(v); break;
      case 'pools': entity[f.key] = poolVal(v, (f.cols || []).map((c) => c.key)); break;
      case 'mental': entity[f.key] = mentalRows(v); break;
      case 'object': {
        const out = {};
        for (const c of f.cols || []) out[c.key] = c.type === 'number' ? num(v?.[c.key], num(base?.[f.key]?.[c.key], 0)) : String(v?.[c.key] ?? '');
        entity[f.key] = out;
        break;
      }
      case 'rows': entity[f.key] = rowVal(v, f.cols); break;
      default: entity[f.key] = String(v ?? '');
    }
  }
  return {
    id: cleanId(input.id ?? ''),
    entity,
    locale: {
      name: String(input.locale?.name ?? '').slice(0, 80),
      desc: String(input.locale?.desc ?? '').slice(0, 2000),
      nameZh: String(input.locale?.nameZh ?? '').slice(0, 80),
      descZh: String(input.locale?.descZh ?? '').slice(0, 2000),
    },
  };
}

/* ---------- 草稿形状 → 游戏文件形状 ---------- */

function cardpackToGame(e, id) {
  return {
    id: Number(id),
    unlockCondition: { unlockCode: num(e.unlockCode, 0) },
    desc: String(e.desc || ''),
    hiddenThemeRate: num(e.hiddenThemeRate, 0),
    fixedRewardEgoGifts: numList(e.fixedRewardEgoGifts),
    exceptionConditions: rowVal(e.exceptionConditions, [{ key: 'selectableFloors', type: 'nums' }, { key: 'dungeonIdx', type: 'number' }])
      .map((r) => ({ selectableFloors: r.selectableFloors, dungeonIdx: r.dungeonIdx })),
    mapGenOption: poolVal(e.mapGenOption),
    egoGiftPool: numList(e.egoGiftPool),
  };
}
function cardpackFromGame(r = {}) {
  return {
    desc: String(r.desc || ''),
    unlockCode: num(r.unlockCondition?.unlockCode, 0),
    hiddenThemeRate: num(r.hiddenThemeRate, 0),
    fixedRewardEgoGifts: numList(r.fixedRewardEgoGifts),
    egoGiftPool: numList(r.egoGiftPool),
    mapGenOption: poolVal(r.mapGenOption),
    exceptionConditions: (r.exceptionConditions || []).map((c) => ({ selectableFloors: numList(c?.selectableFloors), dungeonIdx: num(c?.dungeonIdx, 0) })),
  };
}

function egogiftToGame(e, id) {
  return {
    id: Number(id),
    attributeType: String(e.attributeType || 'NEUTRAL'),
    upgradeDataList: rowVal(e.upgradeDataList, [{ key: 'upgradeLevel', type: 'number' }, { key: 'localizeID', type: 'number' }, { key: 'abilityIDList', type: 'nums' }])
      .map((r) => ({ upgradeLevel: r.upgradeLevel, localizeID: r.localizeID, abilityIDList: r.abilityIDList })),
    tag: strList(e.tag).map((x) => x.toUpperCase()),
    keyword: String(e.keyword || ''),
    lockType: e.lockType === true || e.lockType === 'true',
    price: num(e.price, 0),
  };
}
function egogiftFromGame(r = {}) {
  return {
    attributeType: String(r.attributeType || 'NEUTRAL'),
    tag: strList(r.tag),
    keyword: String(r.keyword || ''),
    price: num(r.price, 0),
    lockType: r.lockType === true || r.lockType === 'true',
    upgradeDataList: (r.upgradeDataList || []).map((u) => ({ upgradeLevel: num(u?.upgradeLevel, 0), localizeID: num(u?.localizeID, 0), abilityIDList: numList(u?.abilityIDList) })),
  };
}

function gameWave(w) {
  const wave = {
    battleMapInfo: { mapName: String(w?.mapName || ''), mapSize: num(w?.mapSize, 0) },
    unitList: unitRows(w?.units).map((u) => ({ unitID: u.unitID, unitCount: u.unitCount, unitLevel: u.unitLevel })),
  };
  const subs = unitRows(w?.subUnits);
  if (subs.length) wave.subUnitList = subs.map((u) => ({ unitID: u.unitID, unitCount: u.unitCount, unitLevel: u.unitLevel }));
  wave.bgmList = String(w?.bgm || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  wave.enemyPositionID = num(w?.enemyPositionID, 0);
  if (num(w?.allyPositionID, 0)) wave.allyPositionID = num(w.allyPositionID, 0);
  return wave;
}

function battleToGame(e, id) {
  return {
    id: Number(id),
    stageLevel: num(e.stageLevel, 1),
    stageType: String(e.stageType || 'Normal'),
    participantInfo: { min: num(e.participantInfo?.min, 1), max: num(e.participantInfo?.max, 1) },
    battleCameraInfo: { defaultPosX: num(e.battleCameraInfo?.defaultPosX, 0), defaultPosY: num(e.battleCameraInfo?.defaultPosY, 0.5), defaultPosZ: num(e.battleCameraInfo?.defaultPosZ, 10) },
    waveList: waveRows(e.waveList).map(gameWave),
    staminaCost: num(e.staminaCost, 0),
    recommendedLevel: num(e.recommendedLevel, 1),
    turnLimit: num(e.turnLimit, 20),
    attackType: String(e.attackType || ''),
    attributeType: String(e.attributeType || ''),
    questlist: rowVal(e.questlist, [{ key: 'localizeId', type: 'number' }, { key: 'args', type: 'text' }])
      .map((r) => ({ args: String(r.args || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean), localizeId: r.localizeId })),
    rewardList: rowVal(e.rewardList, [{ key: 'type', type: 'text' }, { key: 'rewardId', type: 'number' }, { key: 'num', type: 'number' }, { key: 'prob', type: 'number' }])
      .map((r) => ({ type: String(r.type || 'EGO_GIFT'), rewardId: num(r.rewardId, 0), num: num(r.num, 1), prob: r.prob == null || r.prob === '' ? 1 : num(r.prob, 1) })),
  };
}
function battleFromGame(r = {}) {
  return {
    stageLevel: num(r.stageLevel, 1),
    stageType: String(r.stageType || 'Normal'),
    participantInfo: { min: num(r.participantInfo?.min, 1), max: num(r.participantInfo?.max, 1) },
    battleCameraInfo: { defaultPosX: num(r.battleCameraInfo?.defaultPosX, 0), defaultPosY: num(r.battleCameraInfo?.defaultPosY, 0.5), defaultPosZ: num(r.battleCameraInfo?.defaultPosZ, 10) },
    waveList: (r.waveList || []).map((w) => ({
      mapName: String(w?.battleMapInfo?.mapName || ''),
      mapSize: num(w?.battleMapInfo?.mapSize, 0),
      bgm: (w?.bgmList || []).join(','),
      enemyPositionID: num(w?.enemyPositionID, 0),
      allyPositionID: num(w?.allyPositionID, 0),
      units: unitRows(w?.unitList),
      subUnits: unitRows(w?.unitSubList || w?.subUnitList),
    })),
    staminaCost: num(r.staminaCost, 0),
    recommendedLevel: num(r.recommendedLevel, 1),
    turnLimit: num(r.turnLimit, 20),
    attackType: String(r.attackType || ''),
    attributeType: String(r.attributeType || ''),
    questlist: (r.questlist || []).map((q) => ({ localizeId: num(q?.localizeId, 0), args: (q?.args || []).join(',') })),
    rewardList: (r.rewardList || []).map((x) => ({ type: String(x?.type || 'EGO_GIFT'), rewardId: num(x?.rewardId, 0), num: num(x?.num, 1), prob: x?.prob == null ? 1 : num(x.prob, 1) })),
  };
}

function enemyToGame(e, id) {
  return {
    id: Number(id),
    appearance: String(e.appearance || ''),
    nameID: num(e.nameID, 0) || undefined,
    unitKeywordList: strList(e.unitKeywordList),
    level: num(e.level, 1),
    classType: String(e.classType || 'TETH'),
    attributeType: String(e.attributeType || 'CRIMSON'),
    hp: { defaultStat: num(e.hp?.defaultStat, 50), incrementByLevel: num(e.hp?.incrementByLevel, 5) },
    patternID: String(e.patternID || 'AutoPick'),
    startActionSlotNum: num(e.startActionSlotNum, 1),
    maxActionSlotNum: num(e.maxActionSlotNum, 1),
    abnormalityPartList: numList(e.abnormalityPartList),
    attributeList: rowVal(e.attributeList, [{ key: 'skillId', type: 'number' }, { key: 'number', type: 'number' }])
      .map((r) => ({ skillId: r.skillId, number: Math.max(1, r.number) })),
    associationList: strList(e.associationList),
    hasMp: e.hasMp === true || e.hasMp === 'true',
  };
}
function enemyFromGame(r = {}) {
  return {
    appearance: String(r.appearance || ''),
    nameID: num(r.nameID, 0),
    level: num(r.level, 1),
    classType: String(r.classType || 'TETH'),
    attributeType: String(r.attributeType || 'CRIMSON'),
    hp: { defaultStat: num(r.hp?.defaultStat, 50), incrementByLevel: num(r.hp?.incrementByLevel, 5) },
    patternID: String(r.patternID || 'AutoPick'),
    startActionSlotNum: num(r.startActionSlotNum, 1),
    maxActionSlotNum: num(r.maxActionSlotNum, 1),
    abnormalityPartList: numList(r.abnormalityPartList),
    attributeList: (r.attributeList || []).map((a) => ({ skillId: num(a?.skillId, 0), number: num(a?.number, 1) })),
    unitKeywordList: strList(r.unitKeywordList),
    associationList: strList(r.associationList),
    hasMp: r.hasMp === true || r.hasMp === 'true',
  };
}

function mentalToGame(rows) {
  const out = { add: [], min: [] };
  for (const r of mentalRows(rows)) {
    out[r.group].push({ level: r.level, conditionIDList: r.conditionIDs.map((id) => ({ conditionID: id })) });
  }
  return out;
}
function mentalFromGame(src) {
  const out = [];
  for (const group of ['add', 'min']) {
    for (const g of src?.[group] || []) {
      out.push({ group, level: num(g?.level, 1), conditionIDs: (g?.conditionIDList || []).map((c) => String(c?.conditionID || '')).filter(Boolean) });
    }
  }
  return out;
}

function mobToGame(e, id) {
  return {
    id: Number(id),
    sdPortrait: String(e.sdPortrait || ''),
    appearance: String(e.appearance || ''),
    unitKeywordList: strList(e.unitKeywordList),
    level: num(e.level, 1),
    slotWeightConditionList: strList(e.slotWeightConditionList),
    hp: { defaultStat: num(e.hp?.defaultStat, 80), incrementByLevel: num(e.hp?.incrementByLevel, 0.19) },
    defCorrection: num(e.defCorrection, 0),
    minSpeedList: numList(e.minSpeedList),
    maxSpeedList: numList(e.maxSpeedList),
    breakSection: { sectionList: numList(e.breakSection) },
    mp: num(e.mp, 0),
    lowMorale: num(e.lowMorale, 0),
    panic: num(e.panic, 0),
    panicType: num(e.panicType, 0),
    patternID: String(e.patternID || ''),
    mentalConditionInfo: mentalToGame(e.mentalConditionInfo),
    attributeList: rowVal(e.attributeList, [{ key: 'skillId', type: 'number' }, { key: 'number', type: 'number' }])
      .map((r) => ({ skillId: r.skillId, number: Math.max(1, r.number) })),
  };
}
function mobFromGame(r = {}) {
  return {
    sdPortrait: String(r.sdPortrait || ''),
    appearance: String(r.appearance || ''),
    unitKeywordList: strList(r.unitKeywordList),
    level: num(r.level, 1),
    slotWeightConditionList: strList(r.slotWeightConditionList),
    hp: { defaultStat: num(r.hp?.defaultStat, 80), incrementByLevel: num(r.hp?.incrementByLevel, 0.19) },
    defCorrection: num(r.defCorrection, 0),
    minSpeedList: numList(r.minSpeedList),
    maxSpeedList: numList(r.maxSpeedList),
    breakSection: numList(r.breakSection?.sectionList),
    mp: num(r.mp, 0),
    lowMorale: num(r.lowMorale, 0),
    panic: num(r.panic, 0),
    panicType: num(r.panicType, 0),
    patternID: String(r.patternID || ''),
    mentalConditionInfo: mentalFromGame(r.mentalConditionInfo),
    attributeList: (r.attributeList || []).map((a) => ({ skillId: num(a?.skillId, 0), number: num(a?.number, 1) })),
  };
}

function resistRows(list, fallback) {
  const rows = (list || []).map((r) => ({ type: String(r?.type || ''), value: num(r?.value, 1) }));
  return rows.length ? rows : fallback;
}

function partToGame(e, id) {
  return {
    id: Number(id),
    slotWeightConditionList: strList(e.slotWeightConditionList),
    hp: { defaultStat: num(e.hp?.defaultStat, 26), incrementByLevel: num(e.hp?.incrementByLevel, 0.62) },
    defCorrection: num(e.defCorrection, 0),
    minSpeedList: numList(e.minSpeedList),
    maxSpeedList: numList(e.maxSpeedList),
    canUseSkillOnDestroyed: boolStr(e.canUseSkillOnDestroyed),
    isDestroyable: boolStr(e.isDestroyable),
    skillCancelable: boolStr(e.skillCancelable),
    canVanish: boolStr(e.canVanish),
    canChangeSpriteOnDestoryed: boolStr(e.canChangeSpriteOnDestoryed),
    spreadMpEffectToAbnormality: boolStr(e.spreadMpEffectToAbnormality),
    partType: String(e.partType || 'BODY'),
    breakSection: { sectionList: numList(e.breakSection) },
    resistInfo: {
      atkResistList: rowVal(e.atkResist, [{ key: 'type', type: 'text' }, { key: 'value', type: 'number' }]),
      attributeResistList: rowVal(e.attrResist, [{ key: 'type', type: 'text' }, { key: 'value', type: 'number' }]),
    },
    attributeList: rowVal(e.attributeList, [{ key: 'skillId', type: 'number' }, { key: 'number', type: 'number' }])
      .map((r) => ({ skillId: r.skillId, number: Math.max(1, r.number) })),
    passiveSet: { passiveIdList: [] },
  };
}
function partFromGame(r = {}) {
  return {
    partType: String(r.partType || 'BODY'),
    hp: { defaultStat: num(r.hp?.defaultStat, 26), incrementByLevel: num(r.hp?.incrementByLevel, 0.62) },
    defCorrection: num(r.defCorrection, 0),
    minSpeedList: numList(r.minSpeedList),
    maxSpeedList: numList(r.maxSpeedList),
    breakSection: numList(r.breakSection?.sectionList),
    atkResist: resistRows(r.resistInfo?.atkResistList, PART.defaults().atkResist),
    attrResist: resistRows(r.resistInfo?.attributeResistList, PART.defaults().attrResist),
    slotWeightConditionList: strList(r.slotWeightConditionList),
    isDestroyable: boolStr(r.isDestroyable),
    skillCancelable: boolStr(r.skillCancelable),
    canVanish: boolStr(r.canVanish),
    canChangeSpriteOnDestoryed: boolStr(r.canChangeSpriteOnDestoryed),
    canUseSkillOnDestroyed: boolStr(r.canUseSkillOnDestroyed),
    spreadMpEffectToAbnormality: boolStr(r.spreadMpEffectToAbnormality),
    attributeList: (r.attributeList || []).map((a) => ({ skillId: num(a?.skillId, 0), number: num(a?.number, 1) })),
  };
}

const GAME_SHAPE = {
  cardpack: { toGame: cardpackToGame, fromGame: cardpackFromGame },
  egogift: { toGame: egogiftToGame, fromGame: egogiftFromGame },
  battle: { toGame: battleToGame, fromGame: battleFromGame },
  enemy: { toGame: enemyToGame, fromGame: enemyFromGame },
  mob: { toGame: mobToGame, fromGame: mobFromGame },
  part: { toGame: partToGame, fromGame: partFromGame },
};


/** 把游戏里已有的记录翻成编辑器草稿形状（「载入现有敌人」用） */
export function fromGameEntity(kind, record) {
  const shape = GAME_SHAPE[kind];
  if (!shape) throw new Error('没有这个镜牢表：' + kind);
  return shape.fromGame ? shape.fromGame(record) : { ...record };
}

function gameEntity(spec, id, entity) {
  const shape = GAME_SHAPE[spec.kind];
  return shape ? shape.toGame(entity, id) : { id: String(id), ...entity };
}

function localeDoc(id, locale, lang) {
  const name = lang === 'CN' ? (locale.nameZh || locale.name || '') : (locale.name || '');
  const desc = lang === 'CN' ? (locale.descZh || locale.desc || '') : (locale.desc || '');
  return { [String(id)]: { id: String(id), name, desc } };
}

function gameFiles(spec, id, entity, locale) {
  const files = [
    { rel: `custom_limbus_data/${spec.gameCat}/${id}.json`, content: JSON.stringify({ list: [gameEntity(spec, id, entity)] }, null, 2) + '\n' },
  ];
  if (spec.localeCat) {
    for (const lang of LOCALES) {
      files.push({ rel: `custom_limbus_locale/${lang}/${spec.localeCat}/${id}.json`, content: JSON.stringify(localeDoc(id, locale, lang), null, 2) + '\n' });
    }
  }
  return files;
}

function readDraft(letheRoot, kind, mod, id) {
  return readJson(draftPath(letheRoot, kind, mod, id), null);
}

function writeDraft(letheRoot, kind, mod, doc) {
  writeFileAtomic(draftPath(letheRoot, kind, mod, doc.id), JSON.stringify(doc, null, 2) + '\n');
}

function gameRec(payload, kind, id) {
  const spec = mdKind(kind);
  return (payload.data[spec.gameCat] || []).find((x) => String(x.id) === String(id)) || null;
}

function locRec(payload, kind, id) {
  const spec = mdKind(kind);
  if (!spec.localeCat) return null;
  for (const lang of LOCALES) {
    const hit = findLocaleEntry(((payload.locales[lang] || {})[spec.localeCat]) || [], id);
    if (hit) return { ...hit, lang };
  }
  return null;
}

/** 列表：游戏文件里已有的 + 只有草稿的，合成一份 */
export function listMd(letheRoot, mod, kind) {
  const spec = mdKind(kind);
  const dir = modDirSafe(letheRoot, mod);
  const payload = readModPayload(dir);
  const rows = new Map();
  for (const rec of payload.data[spec.gameCat] || []) {
    const loc = spec.localeCat ? findLocaleEntry(((payload.locales.EN || {})[spec.localeCat]) || [], rec.id) || findLocaleEntry(((payload.locales.CN || {})[spec.localeCat]) || [], rec.id) || {} : {};
    rows.set(String(rec.id), { id: String(rec.id), name: String(loc.name || ''), source: 'mod', applied: true, updatedAt: '' });
  }
  let files = [];
  try { files = readdirSync(draftDir(letheRoot, kind, mod)).filter((n) => n.toLowerCase().endsWith('.json')); } catch { files = []; }
  for (const name of files) {
    const doc = readJson(join(draftDir(letheRoot, kind, mod), name), null);
    if (!doc || doc.id == null) continue;
    const prev = rows.get(String(doc.id)) || { id: String(doc.id), source: 'draft' };
    rows.set(String(doc.id), { ...prev, name: prev.name || doc.locale?.name || doc.locale?.nameZh || '', updatedAt: doc.updatedAt || '', applied: Boolean(prev.applied) });
  }
  return [...rows.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

export function getMd(letheRoot, mod, kind, id) {
  const spec = mdKind(kind);
  const dir = modDirSafe(letheRoot, mod);
  const payload = readModPayload(dir);
  const draft = readDraft(letheRoot, kind, mod, id);
  const ent = gameRec(payload, kind, id);
  const loc = locRec(payload, kind, id);
  if (!draft && !ent) { const e = new Error(`${spec.zh}里没有 ${id}`); e.status = 404; throw e; }
  const entity = draft?.entity || (ent ? GAME_SHAPE[kind].fromGame(ent.entity) : spec.defaults());
  const locale = draft?.locale || { name: String(loc?.name || ''), desc: String(loc?.desc || ''), nameZh: '', descZh: '' };
  if (!draft && loc?.lang === 'CN') locale.nameZh = locale.name;
  return {
    kind,
    id: String(id),
    entity,
    locale,
    applied: Boolean(ent),
    appliedAt: draft?.appliedAt || '',
    updatedAt: draft?.updatedAt || '',
    fromGame: !draft && Boolean(ent),
  };
}

/** 下一个可用 id：草稿 + 游戏文件里都没占用的最小号 */
export function nextMdId(letheRoot, mod, kind) {
  const spec = mdKind(kind);
  const used = new Set(listMd(letheRoot, mod, kind).map((r) => Number(r.id)));
  let id = spec.idBase;
  while (used.has(id)) id += 1;
  return String(id);
}

export function saveMd(letheRoot, mod, kind, input) {
  const spec = mdKind(kind);
  const doc = normalizeMd(kind, input);
  if (!doc.id) doc.id = nextMdId(letheRoot, mod, kind);
  const prev = readDraft(letheRoot, kind, mod, doc.id);
  const next = { version: MD_VERSION, kind, id: doc.id, entity: doc.entity, locale: doc.locale, updatedAt: new Date().toISOString(), appliedAt: prev?.appliedAt || '' };
  writeDraft(letheRoot, kind, mod, next);
  return next;
}

export function deleteMd(letheRoot, mod, kind, id) {
  const spec = mdKind(kind);
  const p = draftPath(letheRoot, kind, mod, id);
  if (!existsSync(p)) { const e = new Error(`${spec.zh} ${id} 没有草稿可删`); e.status = 404; throw e; }
  unlinkSync(p);
  return { kind, id: String(id), dir: spec.draftDir };
}

export function applyMd(letheRoot, mod, kind, id) {
  const spec = mdKind(kind);
  const doc = readDraft(letheRoot, kind, mod, id);
  if (!doc) { const e = new Error(`${spec.zh} ${id} 还没有保存过，先点保存`); e.status = 400; throw e; }
  const dir = modDirSafe(letheRoot, mod);
  const files = gameFiles(spec, doc.id, doc.entity, doc.locale || {});
  writeFilesTransactional({ modDir: dir, files, root: letheRoot, mod });
  const next = { ...doc, appliedAt: new Date().toISOString() };
  writeDraft(letheRoot, kind, mod, next);
  return { kind, id: doc.id, files: files.map((f) => f.rel) };
}

export function applyMdAll(letheRoot, mod, kind) {
  const rows = listMd(letheRoot, mod, kind);
  const out = { landed: [], failed: [] };
  for (const r of rows) {
    if (!readDraft(letheRoot, kind, mod, r.id)) continue;
    try { applyMd(letheRoot, mod, kind, r.id); out.landed.push(r.id); } catch (err) { out.failed.push({ id: r.id, error: err.message }); }
  }
  return out;
}

/** 撤掉落地：把游戏文件搬进 LCW/backups/md-remove/<Mod>/<kind>/<时间戳>/，草稿保留 */
export function removeLanded(letheRoot, mod, kind, id) {
  const spec = mdKind(kind);
  const dir = modDirSafe(letheRoot, mod);
  const rels = [`custom_limbus_data/${spec.gameCat}/${cleanId(id)}.json`];
  if (spec.localeCat) for (const lang of LOCALES) rels.push(`custom_limbus_locale/${lang}/${spec.localeCat}/${cleanId(id)}.json`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bin = join(letheRoot, 'LCW', 'backups', 'md-remove', cleanName(mod, 'Mod 名称'), spec.kind, stamp);
  const moved = [];
  for (const rel of rels) {
    const src = join(dir, rel);
    if (!existsSync(src) || !statSync(src).isFile()) continue;
    const dest = join(bin, rel);
    mkdirSync(dirname(dest), { recursive: true });
    renameSync(src, dest);
    moved.push({ from: rel, to: dest });
  }
  if (!moved.length) { const e = new Error(`${spec.zh} ${id} 没有落地文件可撤`); e.status = 404; throw e; }
  const doc = readDraft(letheRoot, kind, mod, id);
  if (doc) writeDraft(letheRoot, kind, mod, { ...doc, appliedAt: '' });
  return { kind, id: String(id), moved };
}
