// 生成一个「最小可测私服沙箱」：不依赖真实游戏与真实私服，供 test/ 与 smoke 使用。
// 用法：
//   node tools/make-sandbox.mjs                 # 默认输出到 %TEMP%\lcw-sandbox
//   node tools/make-sandbox.mjs --out D:\tmp\sb # 指定目录
//   node tools/make-sandbox.mjs --force         # 已存在则先清空
//
// 产出结构（与真实私服一致的子集）：
//   <out>\BepInEx\plugins\Lethe\mods\demo\{custom_limbus_data,custom_limbus_locale}\…
//   <out>\BepInEx\plugins\Lethe\dumpedData\limbus_locale\EN\{characterList,personalityList,skillTagList,bufList,keywordList,attributeList}.json
//   <out>\BepInEx\plugins\Lethe\dumpedData\limbus_data\{personality,skill,passive,buff}\stub.json
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d = '') => {
  const i = argv.indexOf('--' + k);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const OUT = resolve(arg('out', join(tmpdir(), 'lcw-sandbox')));
const FORCE = argv.includes('--force');
const LETHE = join(OUT, 'BepInEx', 'plugins', 'Lethe');

const writeJson = (p, obj) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
};
const writeText = (p, s) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s, 'utf8');
};

if (existsSync(LETHE) && !FORCE) {
  console.log('[sandbox] 已存在：' + LETHE);
  console.log('[sandbox] 加 --force 可清空重建');
  process.exit(0);
}
if (FORCE) rmSync(LETHE, { recursive: true, force: true });

// ── dumpedData：编辑器离线所需的最小语料 ─────────────────────────────
const SIN = [
  ['CRIMSON', '暴怒'], ['SCARLET', '色欲'], ['AMBER', '怠惰'],
  ['SHAMROCK', '暴食'], ['AZURE', '忧郁'], ['INDIGO', '傲慢'], ['VIOLET', '嫉妒'],
];
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'attributeList.json'), {
  list: SIN.map(([id, name]) => ({ id, name })),
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'characterList.json'), {
  list: [
    { id: 1, name: '李箱' }, { id: 2, name: '浮士德' }, { id: 3, name: '堂吉诃德' },
    { id: 4, name: '良秀' }, { id: 5, name: '默尔索' }, { id: 6, name: '鸿璐' },
    { id: 7, name: '希斯克利夫' }, { id: 8, name: '以实玛利' }, { id: 9, name: '罗佳' },
    { id: 10, name: '辛克莱' }, { id: 11, name: '奥提斯' }, { id: 12, name: '格里高尔' },
  ],
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'skillTagList.json'), {
  StartBattle: { id: 'StartBattle', name: '[战斗开始]' },
  RoundStart: { id: 'RoundStart', name: '[回合开始]' },
  WhenUse: { id: 'WhenUse', name: '[使用时]' },
  OnSucceedAttack: { id: 'OnSucceedAttack', name: '[命中时]' },
  EndSkill: { id: 'EndSkill', name: '[攻击后]' },
  WinDuel: { id: 'WinDuel', name: '[拼点胜利]' },
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'bufList.json'), {
  Combustion: { id: 'Combustion', name: '烧伤', desc: '每回合受到 {0} 点伤害' },
  Vibration: { id: 'Vibration', name: '震颤', desc: '' },
  Sinking: { id: 'Sinking', name: '沉沦', desc: '' },
  Breath: { id: 'Breath', name: '呼吸', desc: '' },
  Charge: { id: 'Charge', name: '充能', desc: '' },
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'keywordList.json'), {
  MRR566: { id: 'MRR566', name: '攻击性折射', desc: '示例关键词' },
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'personalityList.json'), {
  10101: { id: 10101, name: 'LCB 罪人', title: '李箱', desc: '示例人格' },
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'passiveList.json'), {
  90001: { id: 90001, name: '虫的肉体', desc: '回合结束时，恢复5点体力。' },
});
writeJson(join(LETHE, 'dumpedData', 'limbus_locale', 'EN', 'skillList.json'), {
  1010101: { id: 1010101, levelList: [{ level: 1, name: '偏折', desc: '[使用时]造成 4 点[斩击]伤害。', coinlist: [{ coindescs: [{ desc: '[命中时]施加 1 层[烧伤]' }] }] }] },
});

// 原版人格 / 技能 / 被动 / Buff 各一条，供「读原版 → 导出编辑」链路使用
writeJson(join(LETHE, 'dumpedData', 'limbus_data', 'personality', 'stub.json'), {
  list: [{
    id: 10101, appearance: '10101_YiSang_BaseAppearance', characterId: 1, rank: 1,
    hp: { defaultStat: 72, incrementByLevel: 2.48 }, defCorrection: -2,
    minSpeedList: [4, 4, 4, 4], maxSpeedList: [6, 7, 8, 8],
    resistInfo: { atkResistList: [{ type: 'SLASH', value: 2 }, { type: 'PENETRATE', value: 0.5 }, { type: 'HIT', value: 1 }] },
    breakSection: { sectionList: [65, 35] },
    attributeList: [{ skillId: 1010101, number: 1 }],
    defenseSkillIDList: [1010104],
    initBuffList: [], uniqueAttribute: 'CRIMSON',
  }],
});
writeJson(join(LETHE, 'dumpedData', 'limbus_data', 'skill', 'stub.json'), {
  list: [{
    id: 1010101, skillType: 'SKILL', skillTier: 1, requireIDList: [],
    skillData: [{
      attributeType: 'CRIMSON', atkType: 'SLASH', defType: 'ATTACK', defaultValue: 4,
      targetNum: 1, skillLevelCorrection: 0, skillMotion: 'Attack', viewType: 'Default',
      abilityScriptList: [{ scriptName: 'Modular/TIMING:WhenUse/healhp(Self,2)/' }],
      coinList: [{ operatorType: 'ADD', color: 'GREY', scale: 3, prob: 0.5, abilityScriptList: [] }],
    }],
  }],
});
writeJson(join(LETHE, 'dumpedData', 'limbus_data', 'passive', 'stub.json'), {
  list: [{ id: 90001, requireIDList: ['Modular/TIMING:RoundStart/healhp(Self,5)/'], attributeStockCondition: [], attributeResonanceCondition: [] }],
});
writeJson(join(LETHE, 'dumpedData', 'limbus_data', 'buff', 'stub.json'), {
  list: [{ id: 'Combustion', buffClass: 'VolatileBuff', buffType: 'Negative', canBeDespelled: true, maxStack: 99, maxTurn: 5, list: [{ ability: 'MinSpeedAdder', value: -1 }] }],
});

// ── 一个可编辑的示例 Mod ─────────────────────────────────────────────
const MOD = join(LETHE, 'mods', 'demo');
writeJson(join(MOD, 'custom_limbus_data', 'personality', 'demo.json'), {
  list: [{
    id: 1019901, appearance: '10101_YiSang_BaseAppearance', characterId: 1, rank: 3,
    hp: { defaultStat: 200, incrementByLevel: 3 }, defCorrection: 0,
    minSpeedList: [4, 4, 4, 4], maxSpeedList: [7, 7, 7, 7],
    resistInfo: { atkResistList: [{ type: 'SLASH', value: 2 }, { type: 'PENETRATE', value: 0.5 }, { type: 'HIT', value: 1 }] },
    breakSection: { sectionList: [60, 30] }, attributeList: [{ skillId: 101990101, number: 1 }],
    defenseSkillIDList: [], initBuffList: [], uniqueAttribute: 'CRIMSON', updatedDate: 20260101,
  }],
});
writeJson(join(MOD, 'custom_limbus_locale', 'EN', 'personalityList', 'demo.json'), {
  1019901: { id: 1019901, name: '沙箱测试人格', title: '', desc: '', oneLineTitle: '', skinItemTitle: '', skinItemDesc: '' },
});
writeJson(join(MOD, 'custom_limbus_data', 'skill', 'demo.json'), {
  list: [{
    id: 101990101, skillType: 'SKILL', skillTier: 1, requireIDList: [],
    skillData: [{
      attributeType: 'CRIMSON', atkType: 'SLASH', defType: 'ATTACK', defaultValue: 5,
      targetNum: 1, skillLevelCorrection: 0,
      abilityScriptList: [{ scriptName: 'Modular/TIMING:WhenUse/buff(Self,Combustion,1,0,0)/' }],
      coinList: [
        { operatorType: 'ADD', color: 'GREY', scale: 3, abilityScriptList: [] },
        { operatorType: 'ADD', color: 'RED', scale: 4, abilityScriptList: [] },
      ],
    }],
  }],
});
writeJson(join(MOD, 'custom_limbus_locale', 'EN', 'skillList', 'demo.json'), {
  101990101: { id: 101990101, levelList: [{ level: 1, name: '沙箱技能', desc: '[使用时]施加 1 层[烧伤]。', coinlist: [{ coindescs: [{ desc: '[命中时]造成伤害' }] }, { coindescs: [{ desc: '[命中时]造成伤害' }] }] }] },
});
writeText(join(MOD, 'custom_buffs', 'Combustion.txt'), '');

// ── LCW（编辑器运行期目录）────────────────────────────────────────────
mkdirSync(join(LETHE, 'LCW', 'projects'), { recursive: true });
writeJson(join(LETHE, 'LCW', 'state.json'), { version: 2, disabledMods: {}, disabledDlls: {}, editorName: '但丁', modOrder: [] });
writeText(join(LETHE, 'LCW', 'README.txt'), 'The Lethe Workbench 运行期目录（沙箱）\nprojects/  编辑器设计态数据\n');

console.log('[sandbox] 已生成：' + OUT);
console.log('[sandbox] 私服根：' + LETHE);
console.log('[sandbox] 用法：node src/cli.mjs serve --root "' + LETHE + '" --port 3210');
console.log('[sandbox] 或：  node src/cli.mjs locate --root "' + LETHE + '" --json');
