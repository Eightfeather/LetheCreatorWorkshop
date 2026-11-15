/**
 * 模块用途（scope）与「时点 / 函数」的可用范围。
 *
 * 时点：TIMING_CONTAINERS 由引擎 ModularSkillScripts.decompiled.cs 的方法体推导 ——
 *   触发点的 Harmony 补丁方法枚举了哪些脚本容器（GetAllModbaFromBuffModel→buff、
 *   GetAllModpaFromPasmodel→passive、GetAllModsaFromSkillModel→skill），
 *   三者都不枚举的视为 unit（任何上下文都能响应）。
 *   数据源：数据缓存\timing-containers.json（脚本 scan-containers2.mjs 可重跑）。
 *
 * 函数：COMMAND_CONTAINERS 以教程 + 实测用法的人工分类为底，再用引擎里各
 *   consequence / acquirer 类实际读取的 modsa_* 字段补强（数据缓存\command-containers.json）。
 *   未登记的条目视为通用。
 *
 * 判定：某用途可用某条目 ⇔ 该条目的容器集合包含此用途；
 *   「通用」要求集合同时包含 buff / passive / skill（即真正与上下文无关）。
 */

export const SCOPES = [
  { id: 'common', zh: '通用', desc: '不依赖被动 / 技能 / Buff 特有的上下文' },
  { id: 'passive', zh: '被动', desc: '挂在被动脚本里，可在任意时点响应战斗事件' },
  { id: 'skill', zh: '技能', desc: '挂在技能脚本里，可用当前技能与硬币' },
  { id: 'buff', zh: 'Buff', desc: '挂在 Buff 的脚本里，侧重 Buff 强度 / 层数' },
];

export const SCOPE_IDS = SCOPES.map((s) => s.id);
export const scopeZh = (id) => (SCOPES.find((s) => s.id === id) || SCOPES[0]).zh;

const ALL = ['buff', 'passive', 'skill'];

/** 时点 → 可响应该时点的脚本容器（引擎方法体推导，unit 已归一为三者全集）。 */
export const TIMING_CONTAINERS = {
  "AfterChangeHP": [
    "buff",
    "passive"
  ],
  "AfterChangeSanity": [
    "buff",
    "passive"
  ],
  "AfterChangeShield": [
    "buff",
    "passive"
  ],
  "AfterDuelClash": [
    "passive",
    "skill"
  ],
  "AfterSlots": [
    "buff",
    "skill"
  ],
  "AfterSlotsReady": [
    "buff",
    "skill"
  ],
  "BeforeAnyFlip": [
    "buff",
    "passive",
    "skill"
  ],
  "BeforeChangeSanity": [
    "buff",
    "passive"
  ],
  "BeforeDefense": [
    "passive"
  ],
  "BeforeUse": [
    "buff",
    "passive",
    "skill"
  ],
  "BufMaxStackAdder": [
    "buff",
    "passive"
  ],
  "BufMaxTurnAdder": [
    "buff",
    "passive"
  ],
  "CanDealTarget": [
    "passive",
    "skill"
  ],
  "CanDuel": [
    "buff",
    "passive",
    "skill"
  ],
  "ChangeAttackDamage": [
    "buff",
    "passive",
    "skill"
  ],
  "ChangeTakeDamage": [
    "buff",
    "passive"
  ],
  "DefeatDuel": [
    "buff",
    "unit"
  ],
  "DefeatParrying": [
    "buff",
    "unit"
  ],
  "DefenseCycle": [
    "passive"
  ],
  "DefenseSwitch": [
    "passive",
    "skill"
  ],
  "DelayedStart": [
    "skill"
  ],
  "DuelClash": [
    "passive",
    "skill"
  ],
  "EGOCostMP": [
    "passive",
    "skill"
  ],
  "EncounterStart": [
    "buff"
  ],
  "EndBattle": [
    "buff",
    "unit"
  ],
  "EndSkill": [
    "buff",
    "unit"
  ],
  "EnemyEndSkill": [
    "buff",
    "passive"
  ],
  "EnemyKill": [
    "buff",
    "passive",
    "skill"
  ],
  "EnemyStartBehaviour": [
    "buff",
    "passive",
    "skill"
  ],
  "IgnoreBreak": [
    "passive"
  ],
  "IgnorePanic": [
    "passive"
  ],
  "Immortal": [
    "passive"
  ],
  "ImmortalOther": [
    "passive"
  ],
  "IsIgnoreDefense": [
    "buff",
    "passive",
    "skill"
  ],
  "IsIgnoreSupportiveDefense": [
    "buff",
    "passive",
    "skill"
  ],
  "OnBreak": [
    "passive"
  ],
  "OnBurst": [
    "buff"
  ],
  "OnCoinAfterAttack": [
    "buff",
    "passive",
    "skill"
  ],
  "OnCoinToss": [
    "buff",
    "passive",
    "skill"
  ],
  "OnDie": [
    "buff",
    "passive"
  ],
  "OnDiscard": [
    "buff",
    "unit"
  ],
  "OnEndBehaviour": [
    "buff",
    "unit"
  ],
  "OnFieldedFromBackup": [
    "passive"
  ],
  "OnGainBuff": [
    "passive"
  ],
  "OnOtherBreak": [
    "passive"
  ],
  "OnOtherBurst": [
    "passive"
  ],
  "OnOtherDie": [
    "buff",
    "passive"
  ],
  "OnReturnFromRetreat": [
    "passive"
  ],
  "OnStartBehaviour": [
    "buff",
    "passive",
    "skill"
  ],
  "OnUseBuff": [
    "buff",
    "passive"
  ],
  "RoundStart": [
    "buff",
    "passive",
    "skill"
  ],
  "SkillStaggerVictim": [
    "buff",
    "passive",
    "skill"
  ],
  "SpecialAction": [
    "buff",
    "passive",
    "skill"
  ],
  "StartBattle": [
    "buff",
    "passive",
    "skill"
  ],
  "StartBattleSkill": [
    "buff",
    "passive",
    "skill"
  ],
  "StartDuel": [
    "buff",
    "unit"
  ],
  "StartVisualChaseTarget": [
    "passive",
    "skill"
  ],
  "StartVisualCoinToss": [
    "passive",
    "skill"
  ],
  "StartVisualDie": [
    "passive",
    "skill"
  ],
  "StartVisualDuel": [
    "passive",
    "skill"
  ],
  "StartVisualDuelEnd": [
    "passive",
    "skill"
  ],
  "StartVisualGiveDamage": [
    "passive",
    "skill"
  ],
  "StartVisualPartDestroy": [
    "passive",
    "skill"
  ],
  "StartVisualSkillUse": [
    "passive",
    "skill"
  ],
  "VisualEndBehaviour": [
    "passive",
    "skill"
  ],
  "WhenGained": [
    "buff"
  ],
  "WhenUse": [
    "buff",
    "unit"
  ],
  "WinDuel": [
    "buff",
    "unit"
  ],
  "WinParrying": [
    "buff",
    "unit"
  ]
};

export const COMMAND_CONTAINERS = {
  "beforeanyflip": [
    "skill"
  ],
  "oncointoss": [
    "skill"
  ],
  "startvisualcointoss": [
    "skill"
  ],
  "winparrying": [
    "skill"
  ],
  "defeatparrying": [
    "skill"
  ],
  "oncoinafterattack": [
    "skill"
  ],
  "tryforcedcoinresult": [
    "skill"
  ],
  "startvisualskilluse": [
    "skill"
  ],
  "startvisualgivedamage": [
    "skill"
  ],
  "changeattackdamage": [
    "skill"
  ],
  "expectedbasepower": [
    "skill"
  ],
  "fakepower": [
    "skill"
  ],
  "duelclash": [
    "skill"
  ],
  "ongainbuff": [
    "buff"
  ],
  "onusebuff": [
    "buff"
  ],
  "buffactivate": [
    "buff"
  ],
  "bufmaxstackadder": [
    "buff"
  ],
  "bufmaxturnadder": [
    "buff"
  ],
  "oninit": [
    "passive"
  ],
  "encounterstart": [
    "passive"
  ],
  "onfieldedfrombackup": [
    "passive"
  ],
  "onreturnfromretreat": [
    "passive"
  ],
  "onretreat": [
    "passive"
  ],
  "base": [
    "skill"
  ],
  "dmgadd": [
    "skill"
  ],
  "critchance": [
    "skill"
  ],
  "reusecoin": [
    "skill"
  ],
  "changeskill": [
    "skill"
  ],
  "skillreuse": [
    "skill"
  ],
  "skillcanduel": [
    "skill"
  ],
  "getcoincount": [
    "skill"
  ],
  "coinindex": [
    "skill"
  ],
  "iscoinbroken": [
    "skill"
  ],
  "getcurrentpower": [
    "skill"
  ],
  "getskillbase": [
    "skill"
  ],
  "getskillatkweight": [
    "skill"
  ],
  "getskillegotype": [
    "skill"
  ],
  "getskillcanduel": [
    "skill"
  ],
  "getskillskillslot": [
    "skill"
  ],
  "getopposkillid": [
    "skill"
  ],
  "passiveadd": [
    "passive"
  ],
  "haspassive": [
    "passive"
  ],
  "gbstack": [
    "passive"
  ],
  "stack": [
    "buff"
  ],
  "bufftype": [
    "buff"
  ],
  "onusebufstack": [
    "buff"
  ],
  "onusebufiskeyword": [
    "buff"
  ],
  "bufmaxstackadderiskeyword": [
    "buff"
  ],
  "scale": [
    "skill"
  ],
  "coincancel": [
    "skill"
  ],
  "turn": [
    "buff"
  ],
  "makeunbreakable": [
    "skill"
  ],
  "changeaffinity": [
    "skill"
  ],
  "removecoin": [
    "skill"
  ],
  "giveskillscript": [
    "skill"
  ],
  "bonusdmgbybuff": [
    "buff"
  ],
  "setspusage": [
    "skill"
  ],
  "getskillid": [
    "skill"
  ],
  "getskilldeftype": [
    "skill"
  ],
  "onusebufturn": [
    "buff"
  ],
  "gbturn": [
    "passive"
  ],
  "gbactiveround": [
    "passive"
  ],
  "gbsource": [
    "passive"
  ],
  "ctdsource": [
    "passive"
  ],
  "getdmgmult": [
    "skill"
  ],
  "isbaseskill": [
    "skill"
  ],
  "skilldeftype": [
    "skill"
  ]
};



function allows(set, scope) {
  if (!set || !set.length) return true;
  const has = (k) => set.includes(k) || set.includes("unit");
  if (scope === "common") { const nonUnit = set.filter((x) => x !== "unit"); return set.includes("unit") || nonUnit.length >= 2; }
  return has(scope);
}

export function timingAllowed(scope, en) {
  return allows(TIMING_CONTAINERS[en], scope);
}

export function commandAllowed(scope, name) {
  return allows(COMMAND_CONTAINERS[name], scope);
}

/** 兼容旧调用：单值视图（只保留单一容器的条目）。 */
export const TIMING_SCOPE = Object.fromEntries(Object.entries(TIMING_CONTAINERS).filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));
export const COMMAND_SCOPE = Object.fromEntries(Object.entries(COMMAND_CONTAINERS).filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));
export const UNIVERSAL = ALL.slice();
