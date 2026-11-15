import { COMMAND_ZH, ARG_ZH } from './command-zh.mjs';
// Modular 命令表（consequence 动作 / acquirer 取值），自动生成，勿手改。
// 来源：D:\私服\dsh_AI\50_历史快照\_decomp_20261020\Modular\ModularSkillScripts.decompiled.cs（consequenceDict / acquirerDict）
//        + E:\辅助文件\Modular脚本使用教程.docx（签名 / 中文说明 / 参数表）
// 重新生成：node 数据缓存\dump-modular.mjs → build-modular-tables.mjs → 本文件（emit 脚本见 docs/09）
export const MODULAR_TABLES = {
 "generatedAt": "2026-10-24T18:25:34.347Z",
 "source": [
  "ModularScriptScripts.decompiled.cs",
  "Modular脚本使用教程.docx"
 ],
 "count": 273,
 "rows": [
  {
   "kind": "consequence",
   "name": "log",
   "cls": "ConsequenceLog",
   "sig": "log(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "在 BepInEx 日志中打印一行，附带提供的 VALUE。",
   "params": [
    {
     "name": "var_1",
     "doc": "任意字符串（空格将被自动删除；尽量避免使用特殊字符）"
    },
    {
     "name": "opt_2",
     "doc": "VALUE_# | 任意整数"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "base",
   "cls": "ConsequenceBase",
   "sig": "base(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "获得基础威力。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少威力）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "final",
   "cls": "ConsequenceFinal",
   "sig": "final(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "获得最终威力。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少威力）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "clash",
   "cls": "ConsequenceClash",
   "sig": "clash(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "获得拼点威力。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少威力）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "scale",
   "cls": "ConsequenceScale",
   "sig": "scale(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "获得硬币威力（类似于原版中负硬币的效果）（译注：没看懂哪类似了）",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少硬币威力）"
    },
    {
     "name": "var_1",
     "doc": "ADD | SUB | MUL（更改硬币的运算符类型）"
    },
    {
     "name": "opt_2",
     "doc": "任意整数（设置要影响的硬币索引，0 = 第一枚）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "dmgadd",
   "cls": "ConsequenceDmgAdd",
   "sig": "dmgadd(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "使伤害增加或减少一个整数值 （其功能等同于在攻击前为技能添加最终威力，即厨良3技能的增伤效果）",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "dmgmult",
   "cls": "ConsequenceDmgMult",
   "sig": "dmgmult(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "按百分比使伤害增减",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（增加或减少）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "headschance",
   "cls": "ConsequenceHeadsChance",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "healsp",
   "cls": "ConsequenceMpDmg",
   "sig": "healsp(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "应用理智值治疗或理智值伤害。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（若为正数则恢复理智值，若为负数则造成理智值伤害）"
    },
    {
     "name": "opt_3",
     "doc": "见HYPERLINK \\l &quot; &quot;[单目标] （精神伤害的来源单位）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "reusecoin",
   "cls": "ConsequenceReuseCoin",
   "sig": "reusecoin(var_1, var_1...)",
   "args": [
    "var_1",
    "var_1..."
   ],
   "summary": "重复使用任意数量的硬币。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（要重复使用的硬币索引。使用 -1 可使硬币脚本以自身为目标）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "bonusdmg",
   "cls": "ConsequenceBonusDmg",
   "sig": "bonusdmg(var_1, var_2, var_3, var_4)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4"
   ],
   "summary": "造成额外伤害。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数"
    },
    {
     "name": "var_3",
     "doc": "-1（真实伤害）| 0（斩击）| 1（突刺）| 2（打击）"
    },
    {
     "name": "var_4",
     "doc": "-1（真实伤害）| 0-8（罪孽类型）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "buff",
   "cls": "ConsequenceBuf",
   "sig": "buff(var_1, var_2, var_3, var_4, var_5, opt_6)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4",
    "var_5",
    "opt_6"
   ],
   "summary": "通过关键词、强度和层数施加Buff。负数会消耗该Buff。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "Buff关键词（例如：Enhancement、Agility）"
    },
    {
     "name": "var_3",
     "doc": "VALUE_# | 任意整数（强度，若该Buff仅存在层数，则此处填写其层数，同时var_4应为0）"
    },
    {
     "name": "var_4",
     "doc": "VALUE_# | 任意整数（层数）"
    },
    {
     "name": "var_5",
     "doc": "VALUE_# | 任意整数（生效回合，0 = 本回合，1 = 下回合，2 = 本回合和下回合）"
    },
    {
     "name": "opt_6",
     "doc": "use（设为&quot;use&quot;将尝试&quot;消耗&quot;该Buff而非移除它，通常用于7大体系Buff以及格里高尔的12区燃料）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "shield",
   "cls": "ConsequenceShield",
   "sig": "shield(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "施加护盾。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数"
    },
    {
     "name": "opt_3",
     "doc": "perm（添加此可选变量可使护盾在回合结束后不解除）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "break",
   "cls": "ConsequenceBreak",
   "sig": "break(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "立即使目标陷入混乱。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "opt_2",
     "doc": "natural | force | both（混乱类型，正常、强制混乱或者同时施加两者）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "breakdmg",
   "cls": "ConsequenceBreakDmg",
   "sig": "breakdmg(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "前移或后移第一混乱阈值。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（正数前移混乱阈值，负数后移）"
    },
    {
     "name": "opt_3",
     "doc": "VALUE_# | 任意整数（触发的次数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "breakrecover",
   "cls": "ConsequenceBreakRecover",
   "sig": "breakrecover(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "解除目标的混乱。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "breakaddbar",
   "cls": "ConsequenceBreakAddBar",
   "sig": "breakaddbar(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "为目标添加一个混乱阈值。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（添加阈值的精确体力值。添加 '%' 可使其根据最大体力的百分比进行添加）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "burst",
   "cls": "ConsequenceExplosion",
   "sig": "burst(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "震颤爆发。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（触发震颤爆发的次数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "healhp",
   "cls": "ConsequenceHealHp",
   "sig": "healhp(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "为目标治疗指定数值的体力，填入负数则会扣除体力。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（在末尾添加 % 可按照目标最大体力的百分比进行治疗，例如：&quot;20%&quot;，&quot;VALUE_0%&quot;）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "pattern",
   "cls": "ConsequencePattern",
   "sig": "pattern(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "将使用者行为逻辑模式索引设置为指定值。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（模式索引）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "setslotadder",
   "cls": "ConsequenceSetSlotAdder",
   "sig": "setslotadder(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "将 maxActionSlotNum (即最大行动槽数量) 设置为给定的值（仅限异想体）。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（技能槽数量）"
    },
    {
     "name": "opt_3",
     "doc": "add（若需进行增减而非覆盖，请填入此第三个参数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "setdata",
   "cls": "ConsequenceSetData",
   "sig": "setdata(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "为目标施加长时间数据。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]（也可为&quot;Encounter&quot;以设置全局关卡数据）"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（数据 ID，请确保其唯一）"
    },
    {
     "name": "var_3",
     "doc": "VALUE_# | 任意整数（要设置的值）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "changeskill",
   "cls": "ConsequenceChangeSkill",
   "sig": "changeskill(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "在战斗中将该技能替换为此单位技能库中的另一个技能。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（技能 ID）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "setimmortal",
   "cls": "ConsequenceSetImmortal",
   "sig": "setimmortal(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "与 OnImmortal 和 OnOtherImmortal 时点配合使用。若 var_1 为 1，则即将被击杀的单位将保持存活，且其体力将被设为 1。",
   "params": [
    {
     "name": "var_1",
     "doc": "1 | 0"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "retreat",
   "cls": "ConsequenceRetreat",
   "sig": "retreat(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "使单位等待撤退。所有撤退在回合结束时发生。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "Buff关键词（单位撤退时身上显示的Buff，比如句点事务所收尾人 希斯克里夫的 战后支援分派）"
    },
    {
     "name": "endstage",
     "doc": "立即结束关卡。"
    },
    {
     "name": "endbattle",
     "doc": "结束本回合的战斗，跳转到下一回合。"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "aggro",
   "cls": "ConsequenceAggro",
   "sig": "aggro(var_1, var_2, opt_3, opt_4)",
   "args": [
    "var_1",
    "var_2",
    "opt_3",
    "opt_4"
   ],
   "summary": "向一个或全部技能槽添加挑衅值。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（挑衅值数量）"
    },
    {
     "name": "opt_3",
     "doc": "this | next（本回合或下回合的挑衅值，默认：next）"
    },
    {
     "name": "opt_4",
     "doc": "VALUE_# | 任意整数（所要增加挑衅值的技能槽）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillsend",
   "cls": "ConsequenceSkillSend",
   "sig": "skillsend(var_1, var_2, var_3, opt_4, opt_5)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "opt_4",
    "opt_5"
   ],
   "summary": "使一个单位向另一个单位使用某个技能，该技能必须存在于该单位的技能列表中 注：如果你想要使一个闪避或防御技能在战斗开始时对自身受到的第一次攻击使用（类似拇指护父 瓦伦希娜的闪避技能），那么请将var_2设置为Self",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[单目标]（攻击者）"
    },
    {
     "name": "var_2",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]（受击者）"
    },
    {
     "name": "var_3",
     "doc": "任意技能 ID | S# | D#（请将#替换成任意整数，S和D分别代表技能等级和技能顺序索引，例如：S3 、D1）"
    },
    {
     "name": "opt_4",
     "doc": "atk | def（默认atk，防御和闪避技能需要填写def）"
    },
    {
     "name": "opt_5",
     "doc": "first | late （若在战斗开始时使用，其会决定你的单位的技能的使用顺序；若在战斗中途使用，那么其会作为第一个技能使用/尽可能地最晚去使用）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillreuse",
   "cls": "ConsequenceSkillReuse",
   "sig": "skillreuse(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "对指定目标重复使用当前使用的技能。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillslotreplace",
   "cls": "ConsequenceSkillSlotReplace",
   "sig": "skillslotreplace(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "替换指定技能槽中的技能。",
   "params": [
    {
     "name": "var_1",
     "doc": "All | VALUE_# | 任意整数（技能槽索引，从左到右，从 0 开始）"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（将被替换掉的技能 ID）| 'All'（All代表该技能槽中所有技能）"
    },
    {
     "name": "var_3",
     "doc": "VALUE_# | 任意整数（将要替换为的技能 ID）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "resource",
   "cls": "ConsequenceResource",
   "sig": "resource(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "给予或移除一个队伍的罪孽资源。",
   "params": [
    {
     "name": "var_1",
     "doc": "CRIMSON | SCARLET | AMBER | SHAMROCK | AZURE | INDIGO | VIOLET"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（生成的资源数量，可为负数）"
    },
    {
     "name": "opt_3",
     "doc": "Enemy（添加此可选参数以影响嫉妒大罪的罪孽资源）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "discard",
   "cls": "ConsequenceDiscard",
   "sig": "discard(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "根据参数丢弃技能。",
   "params": [
    {
     "name": "var_1",
     "doc": "DESCENDING（最高等级的技能）| ASCENDING（最低等级的技能）| RANDOM（随机技能）"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（要丢弃的技能数量）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "passiveadd",
   "cls": "ConsequencePassiveAdd",
   "sig": "passiveadd(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "向选定单位添加一个被动。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 被动 ID"
    },
    {
     "name": "var_3",
     "doc": "nodupe | yesdupe（默认 = yesdupe）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "passiveremove",
   "cls": "ConsequencePassiveRemove",
   "sig": "passiveremove(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "从选定单位移除一个被动。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 被动 ID"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "endstage",
   "cls": "ConsequenceEndStage",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "endbattle",
   "cls": "ConsequenceEndBattle",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "endlimbus",
   "cls": "ConsequenceEndLimbus",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "skillcanduel",
   "cls": "ConsequenceSkillCanDuel",
   "sig": "skillcanduel(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "将技能上的&quot;canDuel&quot;变量设置为 true/false，即添加或删除[无法拼点]词条",
   "params": [
    {
     "name": "var_1",
     "doc": "True | False"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillslotgive",
   "cls": "ConsequenceSkillSlotGive",
   "sig": "skillslotgive(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "为单位添加行动槽（仅对罪人有效）",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "doubleslot",
   "cls": "ConsequenceDoubleSlot",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "stageextraslot",
   "cls": "ConsequenceStageExtraSlot",
   "sig": "stageextraslot(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "将关卡额外技能槽设置为特定值。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 整数"
    },
    {
     "name": "opt_2",
     "doc": "add（可选&quot;add&quot;参数以增加技能槽容量而非覆盖）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "passivereveal",
   "cls": "ConsequencePassiveReveal",
   "sig": "passivereveal(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "解锁目标的被动描述。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "被动 ID | VALUE_X | all"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillreveal",
   "cls": "ConsequenceSkillReveal",
   "sig": "skillreveal(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "解锁目标的技能描述。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "技能 ID | VALUE_X | all"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "resistreveal",
   "cls": "ConsequenceResistReveal",
   "sig": "resistreveal(var_1, var_2, var_3, var_4)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4"
   ],
   "summary": "解锁目标的抗性数据。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "部位 ID | VALUE_X"
    },
    {
     "name": "var_3",
     "doc": "抗性（如 CRIMSON、HIT 等）"
    },
    {
     "name": "var_4",
     "doc": "type | attribute（若 var_3 为攻击类型则填入 type，若为罪孽属性则填入 attribute）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "appearance",
   "cls": "ConsequenceAppearance",
   "sig": "appearance(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "更改目标的外观。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "外观 ID"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "coincancel",
   "cls": "ConsequenceCoinCancel",
   "sig": "coincancel(var_1, var_1...)",
   "args": [
    "var_1",
    "var_1..."
   ],
   "summary": "取消任意数量的硬币。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（要取消的硬币索引）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "summonassistant",
   "cls": "ConsequenceSummonAssistant",
   "sig": "summonassistant(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "在下一回合召唤一名助战单位。（请不要在RoundStart时点使用，否则将会崩溃，使用EndBattle时点也能达到预期效果）",
   "params": [
    {
     "name": "var_1",
     "doc": "助战者 ID | VALUE_X"
    },
    {
     "name": "var_2",
     "doc": "助战者等级 | VALUE_X"
    },
    {
     "name": "var_3",
     "doc": "助战者同步等级 | VALUE_X（默认设为 1）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "summonenemy",
   "cls": "ConsequenceSummonEnemy",
   "sig": "summonenemy(var_1, var_2, var_3, var_4, opt_5)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4",
    "opt_5"
   ],
   "summary": "在下一回合召唤一名敌人或异想体。（请不要在RoundStart时点使用，否则将会崩溃，使用EndBattle时点也能达到预期效果）",
   "params": [
    {
     "name": "var_1",
     "doc": "敌人 ID | VALUE_X"
    },
    {
     "name": "var_2",
     "doc": "敌人等级 | VALUE_X"
    },
    {
     "name": "var_3",
     "doc": "敌人同步等级 | VALUE_X（默认设为 1）"
    },
    {
     "name": "var_4",
     "doc": "波次索引 | VALUE_X"
    },
    {
     "name": "opt_5",
     "doc": "enemy（添加此可选参数可使其专门生成常规遭遇战敌人，否则生成异想体）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "summonunitfromqueue",
   "cls": "ConsequenceSummonUnitFromQueue",
   "sig": "summonunitfromqueue()",
   "args": [],
   "summary": "从 subunitList 中召唤单位。",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "stack",
   "cls": "ConsequenceStack",
   "sig": "stack()",
   "args": [],
   "summary": "返回该 Buff 的强度，若仅有层数则返回层数。",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "turn",
   "cls": "ConsequenceTurn",
   "sig": "turn()",
   "args": [],
   "summary": "返回该 Buff 的层数。 Buff 专属效果函数",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "vibrationswitch",
   "cls": "ConsequenceVibrationSwitch",
   "sig": "vibrationswitch(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "振幅转换。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "特殊震颤id，但是好像也可以填其它Buff"
    },
    {
     "name": "opt_3",
     "doc": "superpos（添加此可选参数以进行振幅纠缠）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "changemap",
   "cls": "ConsequenceChangeMap",
   "sig": "changemap(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "更改地图/背景。",
   "params": [
    {
     "name": "var_1",
     "doc": "地图名称"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（地图大小）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "lyrics",
   "cls": "ConsequenceLyrics",
   "sig": "lyrics(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "显示歌词，如同 Mili 歌曲在最终 Canto Boss 战中显示的方式。",
   "params": [
    {
     "name": "var_1",
     "doc": "文本显示的十六进制颜色代码（目前无效，请填入&quot;reserved&quot;）"
    },
    {
     "name": "var_2",
     "doc": "要显示的文本"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "uppertext",
   "cls": "ConsequenceUpperText",
   "sig": "uppertext(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "在屏幕顶部显示文本。",
   "params": [
    {
     "name": "var_1",
     "doc": "文本显示的十六进制颜色代码"
    },
    {
     "name": "var_2",
     "doc": "要显示的文本"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "battledialogline",
   "cls": "ConsequenceBattleDialogLine",
   "sig": "battledialogline(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "使单位显示对话气泡。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "字符串（要显示的对话。请用&quot;_&quot;代替空格）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "gnome",
   "cls": "ConsequenceGnome",
   "sig": "gnome(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "gnome（地精），使目标的身高减半变成俄式比例(？)",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "effectlabel",
   "cls": "ConsequenceEffectLabel",
   "sig": "effectlabel(var_1, var_2, var_3, var_4)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4"
   ],
   "summary": "使一个选择的视觉效果围绕在目标周围出现。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "字符串 | 要播放的视觉效果"
    },
    {
     "name": "var_3",
     "doc": "'VALUE_#' | 是否激活，整数，0 = 不激活，1 = 激活"
    },
    {
     "name": "var_4",
     "doc": "字符串 | 效果层级类型：NONE、DIRECTION、ONCE、BACK、SKIN、MASKING"
    },
    {
     "name": "opt_5",
     "doc": "isSetOverrideDie | 未测试其具体效果，默认 false"
    },
    {
     "name": "opt_6",
     "doc": "isCenter | 未测试其具体效果，默认 false"
    },
    {
     "name": "opt_7",
     "doc": "scale | 未测试其具体效果，猜测是特效缩放大小，例如：100 -&gt;1.0"
    },
    {
     "name": "opt_8",
     "doc": "isAddScript | 未测试其具体效果，默认 false"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "sanchoshield",
   "cls": "ConsequenceSanchoShield",
   "sig": "sanchoshield(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "在目标周围创建一个旋转的血盾。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "0 - 1 | 0 = 不激活，1 = 激活"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "sound",
   "cls": "ConsequenceSound",
   "sig": "sound(var_1, opt_2, opt_3)",
   "args": [
    "var_1",
    "opt_2",
    "opt_3"
   ],
   "summary": "播放给定的音效、背景音乐、语音或播报员台词。opt_2与opt_3两个参数根据var_1的填写来选择其一填写（必须填写至少一个opt）",
   "params": [
    {
     "name": "var_1",
     "doc": "bgm | sfx | voice | announcer 背景音乐、音效、语音或播报员台词"
    },
    {
     "name": "opt_2",
     "doc": "背景音乐/音效/语音的 GUID（例如 {8d76b7dd-1de4-463e-946f-b02a75cad4aa} 或语音的 75V-062）"
    },
    {
     "name": "opt_3",
     "doc": "播报员ID，要播放的语音台词(例如20,announcer_round_takebigdmg_20_1)"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "addability",
   "cls": "ConsequenceAddAbility",
   "sig": "addability(var_1, var_2, var_3, var_4, var_5)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4",
    "var_5"
   ],
   "summary": "添加一项独特的系统能力。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "HYPERLINK &quot;https://discord.com/channels/1200863040011259934/1348064934050795601/1369842255820755035&quot;系统能力列表"
    },
    {
     "name": "var_3",
     "doc": "VALUE_# | 强度"
    },
    {
     "name": "var_4",
     "doc": "VALUE_# | 回合数"
    },
    {
     "name": "var_5",
     "doc": "VALUE_# | 生效回合"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "removeability",
   "cls": "ConsequenceRemoveAbility",
   "sig": "removeability(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "移除一项独特的系统能力。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "HYPERLINK &quot;https://discord.com/channels/1200863040011259934/1348064934050795601/1369842255820755035&quot;系统能力列表"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "deluge",
   "cls": "ConsequenceSurge",
   "sig": "deluge(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "触发沉沦泛滥。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 数量（译注：猜测为触发沉沦泛滥的次数？原文没有描述）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "makeunbreakable",
   "cls": "ConsequenceMakeUnbreakable",
   "sig": "makeunbreakable(var_1, var_1...)",
   "args": [
    "var_1",
    "var_1..."
   ],
   "summary": "使普通硬币变为不可摧毁的硬币。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# / all | 任意整数（硬币索引，从 0 开始，-1 = 以该硬币本身为目标）/ all = 以技能内所有硬币为目标"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "bloodfeast",
   "cls": "ConsequenceBloodfeast",
   "sig": "bloodfeast(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "通过增加、移除或消耗来改变你可用的血宴数量。",
   "params": [
    {
     "name": "var_1",
     "doc": "add | sub | use"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（想要增加/移除/消耗的血宴数量）"
    },
    {
     "name": "opt_3",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]| 仅当 var_1 为 use 时使用"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "stagebuf",
   "cls": "ConsequenceStageBuf",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "critchance",
   "cls": "ConsequenceCritChance",
   "sig": "critchance(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "增加造成暴击的几率。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数（造成暴击的 % 几率，例如 15 -&gt;15%）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "critratio",
   "cls": "ConsequenceCritRatio",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "changemotion",
   "cls": "ConsequenceChangeMotion",
   "sig": "changemotion(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "根据参数更改技能所使用的动作。 （译注：该函数时常会有不生效或者错误执行的Bug）",
   "params": [
    {
     "name": "var_1",
     "doc": "动作类型 | 例如 S1、S2、S3、S4 等"
    },
    {
     "name": "var_2",
     "doc": "动作索引 | 例如 0、1、2"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "assistdefense",
   "cls": "ConsequenceAssistDefense",
   "sig": "assistdefense(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "根据参数为一个单位提供援护防御。 注：援护所使用的技能必须含有“SupportiveDefense”技能脚本，必须被包含在援护者的守备技能列表中，同时援护者必须带有含有“SupportProtect”buff脚本的Buff",
   "params": [
    {
     "name": "var_1",
     "doc": "防御者 | 见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "被防御者 | 见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_3",
     "doc": "防御者将使用的技能 ID"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "ignorepanic",
   "cls": "ConsequenceIgnorePanic",
   "sig": "ignorepanic(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "与 IgnorePanic 时点配合使用。若 var_1 为 1，受影响单位的恐慌状态将被完全禁用。",
   "params": [
    {
     "name": "var_1",
     "doc": "1 | 0"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "ignorebreak",
   "cls": "ConsequenceIgnoreBreak",
   "sig": "ignorebreak(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "与 IgnoreBreak 时点配合使用。若 var_1 为 1，受影响单位的混乱状态将被完全禁用。",
   "params": [
    {
     "name": "var_1",
     "doc": "1 | 0"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillslotremove",
   "cls": "ConsequenceSkillSlotRemove",
   "sig": "skillslotremove(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "从单位移除一个技能槽（也许只对罪人生效？） 注：这不会在UI层面将该技能槽移除，但是游戏会强制将其内的技能变得无法指定单位并无法使用",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "技能槽索引（从 1 开始）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "changeaffinity",
   "cls": "ConsequenceChangeAffinity",
   "sig": "changeaffinity(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "在使用该技能时更改该技能的罪孽属性。",
   "params": [
    {
     "name": "var_1",
     "doc": "罪孽属性 | 例如 AZURE、AMBER、BLACK、WHITE 等"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "winstage",
   "cls": "ConsequenceWinStage",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "ovwatkres",
   "cls": "ConsequenceOverwriteAtkResist",
   "sig": "ovwatkres(var_1, var_2, var_3, opt_1)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "opt_1"
   ],
   "summary": "修改攻击抗性。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "攻击类型：SLASH | PENETRATE | HIT"
    },
    {
     "name": "var_3",
     "doc": "新数值：0 至 200 的任意整数（例如：200 -&gt;2.00）"
    },
    {
     "name": "opt_1",
     "doc": "add（若存在此参数，则将新数值叠加至单位抗性中，而非覆盖）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "ovwsinres",
   "cls": "ConsequenceOverwriteSinResist",
   "sig": "ovwsinres(var_1, var_2, var_3, opt_1)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "opt_1"
   ],
   "summary": "修改罪孽抗性。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "罪孽类型：CRIMSON | SCARLET | AMBER | SHAMROCK | AZURE | INDIGO | VIOLET"
    },
    {
     "name": "var_3",
     "doc": "新数值：0 至 200 的任意整数（例如：200 -&gt;2.00）"
    },
    {
     "name": "opt_1",
     "doc": "add（若存在此参数，则将新数值叠加至单位抗性中，而非覆盖）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "refreshspeed",
   "cls": "ConsequenceRefreshSpeed",
   "sig": "refreshspeed(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "刷新单位的速度。主要在使用 MaxSpeedAdder 和 MinSpeedAdder 系统能力时使用。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "deactivebreak",
   "cls": "ConsequenceDeactiveBreak",
   "sig": "deactivebreak(var_1, var_2, var_3, opt_1)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "opt_1"
   ],
   "summary": "根据参数删除一个单位的混乱阈值。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "true | false（若为 true，则按降序排列混乱阈值）"
    },
    {
     "name": "var_3",
     "doc": "混乱索引：索引从 0 开始。若设为 -1，则删除所有混乱阈值"
    },
    {
     "name": "opt_1",
     "doc": "reverseIndex（若存在此参数，则反转混乱阈值列表）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "defcorrection",
   "cls": "ConsequenceDefCorrection",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "buffcategory",
   "cls": "ConsequenceBuffCategory",
   "sig": "buffcategory(var_1, var_2, var_3, var_4, var_5, var_6, var_7)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4",
    "var_5",
    "var_6",
    "var_7"
   ],
   "summary": "更改相同类别的不同效果的属性。(译注：即可对所有属于“同一类别”的buff进行统一操作，如同时让烧伤与所有“特殊烧伤”的buff层数-5)",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "Buff类别（HYPERLINK \\l &quot;_Buff&quot;Buff Category）"
    },
    {
     "name": "var_3",
     "doc": "强度（Stack）"
    },
    {
     "name": "var_4",
     "doc": "层数（Count）"
    },
    {
     "name": "var_5",
     "doc": "生效回合 | 0、1 或 2，含义同上条函数描述"
    },
    {
     "name": "var_6",
     "doc": "0或大于0的正整数 | 若输入0，则输出false，若大于0，则输出true"
    },
    {
     "name": "var_7",
     "doc": "数量（amount）| 受此效果函数影响的Buff数量上限"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "destroybuff",
   "cls": "ConsequenceDestroyBuff",
   "sig": "destroybuff(var_1, var_2, var_3, opt_1, opt_2)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "opt_1",
    "opt_2"
   ],
   "summary": "根据参数摧毁一个Buff。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "Keyword | Buff Type | HYPERLINK \\l &quot;_Buff&quot;Buff Category（Buff关键词、类型或类别）"
    },
    {
     "name": "var_3",
     "doc": "生效回合：0 = 本回合 | 1 = 下回合 | 2 = 本回合和下回合"
    },
    {
     "name": "opt_1",
     "doc": "数量：任意大于 0（或等于 0）的整数"
    },
    {
     "name": "opt_2",
     "doc": "includeNonDispellable（若存在此参数，则可以对 canBeDispelled = false 的Buff（即不可移除的Buff）生效）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "setdmgtaken",
   "cls": "ConsequenceSetChangeDamageTaken",
   "sig": "setdmgtaken(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "设置每次受到伤害时所受的伤害量，与 ChangeTakeDamage 时点配合使用。建议与 getdmg 组合使用。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "skillhide",
   "cls": "ConsequenceSkillHide",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "lbreak",
   "cls": "ConsequenceBreak",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "removecoin",
   "cls": "ConsequenceRemoveCoin",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "setlevel",
   "cls": "ConsequenceSetLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "setmaxhp",
   "cls": "ConsequenceSetMaxHp",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "changesp",
   "cls": "ConsequenceChangeSp",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "adddefaultskillbyid",
   "cls": "ConsequenceAddDefaultSkillByID",
   "sig": "adddefaultskillbyid(var_1, var_2)",
   "args": [
    "var_1",
    "var_2"
   ],
   "summary": "向任意单位的初始技能组中添加一个技能。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "技能 ID"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "addskilltopool",
   "cls": "ConsequenceAddSkillToPool",
   "sig": "addskilltopool(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "向仪表盘上抽取技能的技能池中添加指定技能的权重/数量，该技能必须存在于该单位的初始技能组中。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "技能 ID"
    },
    {
     "name": "opt_3",
     "doc": "增加的技能数量（整数，默认为 1，无法输入负数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "dropskill",
   "cls": "ConsequenceDropSkill",
   "sig": "dropskill(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "将仪表盘第三层/预测层中的技能替换为给定的技能，仅对自身生效。",
   "params": [
    {
     "name": "var_1",
     "doc": "技能 ID"
    },
    {
     "name": "opt_2",
     "doc": "技能槽索引（默认为 0）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "giveskillscript",
   "cls": "ConsequenceGiveSkillScript",
   "sig": "giveskillscript(var_1, var_2, ...)",
   "args": [
    "var_1",
    "var_2",
    "..."
   ],
   "summary": "在战斗中为所选技能增加临时的技能脚本。 根据模式的选择，该函数var_2后的参数可能会发生改变。",
   "params": [
    {
     "name": "var_1",
     "doc": "Self | Target"
    },
    {
     "name": "var_2",
     "doc": "模式选择（整数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "appearancelocalscale",
   "cls": "ConsequenceAppearanceLocalScale",
   "sig": "appearancelocalscale(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "更改自身外观的 xyz 局部缩放。",
   "params": [
    {
     "name": "var_1",
     "doc": "x（整数）"
    },
    {
     "name": "var_2",
     "doc": "y（整数）"
    },
    {
     "name": "var_3",
     "doc": "z（整数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "appearancelocaleuler",
   "cls": "ConsequenceAppearanceLocalEuler",
   "sig": "appearancelocaleuler(var_1, var_2, var_3)",
   "args": [
    "var_1",
    "var_2",
    "var_3"
   ],
   "summary": "更改自身外观的 xyz 局部旋转。（是的，你甚至可以转起来）",
   "params": [
    {
     "name": "var_1",
     "doc": "x（整数）"
    },
    {
     "name": "var_2",
     "doc": "y（整数）"
    },
    {
     "name": "var_3",
     "doc": "z（整数）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "bonusdmgbybuff",
   "cls": "ConsequenceBonusDmgByBuff",
   "sig": "bonusdmgbybuff(var_1, var_2, var_3, var_4, var_5)",
   "args": [
    "var_1",
    "var_2",
    "var_3",
    "var_4",
    "var_5"
   ],
   "summary": "通过Buff造成额外伤害。",
   "params": [
    {
     "name": "var_1",
     "doc": "见HYPERLINK \\l &quot; &quot;[多目标]"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数"
    },
    {
     "name": "var_3",
     "doc": "-1（真实伤害）| 0（斩击）| 1（突刺）| 2（打击）"
    },
    {
     "name": "var_4",
     "doc": "-1（真实伤害）| 0-8（罪孽类型）"
    },
    {
     "name": "var_5",
     "doc": "模式选择，会使部分参数改变或是增加参数"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "atkweight",
   "cls": "ConsequenceAtkWeight",
   "sig": "atkweight(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "增减一个技能的攻击容量，正数增加攻击容量，负数减少。 （不可以在战斗过程中触发的时点上使用，如WhenUse）",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 任意整数"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "changeatktype",
   "cls": "ConsequenceChangeAtkType",
   "sig": "changeatktype(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "将技能的攻击类型修改为指定的类型，你可以用此实现类似李恩的改变武器同时改变攻击类型的效果。",
   "params": [
    {
     "name": "var_1",
     "doc": "攻击类型 | HIT,PENETRATE或者SLASH（打击、突刺或者斩击）"
    }
   ]
  },
  {
   "kind": "consequence",
   "name": "setslotweight",
   "cls": "ConsequenceSetSlotWeight",
   "sig": "setslotweight(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "（译注：仅存在于更新公告中，无法确定其是否存在及确切效果，推测为修改行动槽容量直到再次修改）",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "bufcategory",
   "cls": "ConsequenceBuffCategory",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "cutinaction",
   "cls": "ConsequenceCutInAction",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "tagforsort",
   "cls": "ConsequenceTagForSort",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "insertskill",
   "cls": "ConsequenceInsertSkill",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "refreshallslotvisual",
   "cls": "ConsequenceRefreshAllSlotVisual",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "shine",
   "cls": "ConsequenceShine",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "dashboardeffect",
   "cls": "ConsequenceDashboardEffect",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "setslotalarm",
   "cls": "ConsequenceSetSlotAlarm",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "addduel",
   "cls": "ConsequenceAddDuel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "setspusage",
   "cls": "ConsequenceSetSpUsage",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "instantdeath",
   "cls": "ConsequenceInstantDeath",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "activatebuffunreliable",
   "cls": "ConsequenceActivateBuffUnreliable",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "buffactivate",
   "cls": "ConsequenceBufActivate",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "partdestroy",
   "cls": "ConsequencePartDestroy",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "playcustomsound",
   "cls": "ConsequencePlayCustomSound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "stopcustomsound",
   "cls": "ConsequenceStopSound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "stopsound",
   "cls": "ConsequenceStopVSound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "recalctargets",
   "cls": "ConsequenceRecalcTargets",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "updatemaxbuf",
   "cls": "ConsequenceUpdateMaxBuf",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "refreshsinresourcevisual",
   "cls": "ConsequenceRefreshSinResourceVisual",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "BETAtrigdata",
   "cls": "ConsequenceTrigData",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "mpdmg",
   "cls": "ConsequenceMpDmg",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "buf",
   "cls": "ConsequenceBuf",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "explosion",
   "cls": "ConsequenceExplosion",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "consequence",
   "name": "surge",
   "cls": "ConsequenceSurge",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskilllevel",
   "cls": "AcquirerGetSkillLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getcharacterid",
   "cls": "AcquirerGetCharacterID",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getlevel",
   "cls": "AcquirerGetLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "math",
   "cls": "AcquirerMath",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getsp",
   "cls": "AcquirerMpCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gethp",
   "cls": "AcquirerHpCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbuff",
   "cls": "AcquirerBufCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "visualbufcheck",
   "cls": "AcquirerVisualBufCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gettime",
   "cls": "AcquirerTimeGet",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdmg",
   "cls": "AcquirerGetDmg",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gethpdmg",
   "cls": "AcquirerGetHpDmg",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getround",
   "cls": "AcquirerRound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getwave",
   "cls": "AcquirerWave",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getactivations",
   "cls": "AcquirerActivations",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getunitstate",
   "cls": "AcquirerUnitState",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getid",
   "cls": "AcquirerGetId",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getinstid",
   "cls": "AcquirerInstId",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getspeed",
   "cls": "AcquirerSpeedCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getpattern",
   "cls": "AcquirerGetPattern",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getabnoslotmax",
   "cls": "AcquirerGetAbnoSlotMax",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdata",
   "cls": "AcquirerGetData",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdeadallies",
   "cls": "AcquirerDeadAllies",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "random",
   "cls": "AcquirerRandom",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "areallies",
   "cls": "AcquirerAreAllied",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getshield",
   "cls": "AcquirerGetShield",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdmgtaken",
   "cls": "AcquirerGetDmgTaken",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbuffcount",
   "cls": "AcquirerGetBuffCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillid",
   "cls": "AcquirerGetSkillId",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getcoincount",
   "cls": "AcquirerGetCoinCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getallcoinstates",
   "cls": "AcquirerAllCoinState",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "coinstate",
   "cls": "AcquirerCoinState",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getresonance",
   "cls": "AcquirerResonance",
   "sig": "getresonance(highperfect)",
   "args": [
    "highperfect"
   ],
   "summary": "·getresource(var_1, opt_2) 返回罪孽资源的数量。",
   "params": [
    {
     "name": "var_1",
     "doc": "CRIMSON（暴怒）| SCARLET（色欲）| AMBER（怠惰）| SHAMROCK（暴食）| AZURE（忧郁）| INDIGO（傲慢）| VIOLET（嫉妒）"
    },
    {
     "name": "opt_2",
     "doc": "Enemy（敌方）（添加此可选参数以检测敌方嫉妒大罪的资源数量）"
    }
   ]
  },
  {
   "kind": "acquirer",
   "name": "getresource",
   "cls": "AcquirerResource",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "resourcegetenum",
   "cls": "AcquirerResourceGetEnum",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "haskey",
   "cls": "AcquirerHasKey",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillbase",
   "cls": "AcquirerSkillBase",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillatkweight",
   "cls": "AcquirerSkillAtkWeight",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getcoinscale",
   "cls": "AcquirerOneScale",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillatk",
   "cls": "AcquirerSkillAtk",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillatklevel",
   "cls": "AcquirerSkillAtkLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillattribute",
   "cls": "AcquirerSkillAttribute",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskilldeftype",
   "cls": "AcquirerSkillDefType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillegotype",
   "cls": "AcquirerSkillEgoType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillrank",
   "cls": "AcquirerSkillRank",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillslotcount",
   "cls": "AcquirerSkillSlotCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getattackamount",
   "cls": "AcquirerAmountAttacks",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getstat",
   "cls": "AcquirerGetStat",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "iscoinbroken",
   "cls": "AcquirerCoinIsBroken",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "stack",
   "cls": "AcquirerStack",
   "sig": "stack()",
   "args": [],
   "summary": "返回该 Buff 的强度，若仅有层数则返回层数。",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "turn",
   "cls": "AcquirerTurn",
   "sig": "turn()",
   "args": [],
   "summary": "返回该 Buff 的层数。 Buff 专属效果函数",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "onusebufstack",
   "cls": "AcquirerStack",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "onusebufturn",
   "cls": "AcquirerTurn",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "onusebufiskeyword",
   "cls": "AcquirerTimingBufIsKeyword",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "ongainbufiskeyword",
   "cls": "AcquirerTimingBufIsKeyword",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isfocused",
   "cls": "AcquirerIsFocused",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getunitcount",
   "cls": "AcquirerUnitCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbreakcount",
   "cls": "AcquirerBreakCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbreakvalue",
   "cls": "AcquirerBreakValue",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "iscoinrerolled",
   "cls": "AcquirerCoinRerolled",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "stageextraslot",
   "cls": "AcquirerStageExtraSlot",
   "sig": "stageextraslot(var_1, opt_2)",
   "args": [
    "var_1",
    "opt_2"
   ],
   "summary": "将关卡额外技能槽设置为特定值。",
   "params": [
    {
     "name": "var_1",
     "doc": "VALUE_# | 整数"
    },
    {
     "name": "opt_2",
     "doc": "add（可选&quot;add&quot;参数以增加技能槽容量而非覆盖）"
    }
   ]
  },
  {
   "kind": "acquirer",
   "name": "getbloodfeast",
   "cls": "AcquirerGetBloodfeast",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "stagebuf",
   "cls": "AcquirerStageBuf",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isunbreakable",
   "cls": "AcquirerIsUnbreakable",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isusableinduel",
   "cls": "AcquirerIsUsableInDuel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "issameunit",
   "cls": "AcquirerSameUnit",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillcanduel",
   "cls": "AcquirerSkillCanDuel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillteamkill",
   "cls": "AcquirerSkillTeamKill",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillfixedtarget",
   "cls": "AcquirerSkillFixed",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getcoinoperator",
   "cls": "AcquirerCoinOperator",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "coinindex",
   "cls": "AcquirerCoinIndex",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbufftype",
   "cls": "AcquirerBuffType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getatkres",
   "cls": "AcquirerGetAtkResSinner",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getsinres",
   "cls": "AcquirerGetSinResSinner",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "hasuseddefense",
   "cls": "AcquirerUsedDefenseActionThisTurn",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getunitfaction",
   "cls": "AcquirerUnitFaction",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gbstack",
   "cls": "AcquirerGainBuffStack",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gbturn",
   "cls": "AcquirerGainBuffTurn",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gbactiveround",
   "cls": "AcquirerGainBuffActiveRound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gbsource",
   "cls": "AcquirerGainBuffSource",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getchainstatus",
   "cls": "AcquirerChainStatus",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getsinsindashboard",
   "cls": "AcquirerSinsInDashboard",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "haspassive",
   "cls": "AcquirerHasPassive",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "ctdsource",
   "cls": "AcquirerChangeDamageSource",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "countbackup",
   "cls": "AcquirerCountBackup",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isbackupenabled",
   "cls": "AcquirerIsBackupEnabled",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillskillslot",
   "cls": "AcquirerGetSkillSkillSlot",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "hasdashboardeffect",
   "cls": "AcquirerHasDashboardEffect",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getuptielevel",
   "cls": "AcquirerGetUptieLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getbreaklevel",
   "cls": "AcquirerGetBreakLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdmgmult",
   "cls": "AcquirerGetDmgMult",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "partdestroy",
   "cls": "AcquirerPartDestroy",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "bufmaxstackadderiskeyword",
   "cls": "AcquirerBufMaxAdderIsKeyword",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "bufmaxturnadderiskeyword",
   "cls": "AcquirerBufMaxAdderIsKeyword",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "bufkeywordtoint",
   "cls": "AcquirerBufKeywordToInt",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "weighteddamage",
   "cls": "AcquirerWeightedDamage",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getchainatktype",
   "cls": "AcquirerGetChainAtkType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getskillamountondash",
   "cls": "AcquirerGetSkillAmountOnDash",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isignoredefense",
   "cls": "AcquirerIsIgnoreDefense",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isbaseskill",
   "cls": "AcquirerIsBaseSkill",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isduel",
   "cls": "AcquirerIsDuel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "abs",
   "cls": "AcquirerAbsolute",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "ispart",
   "cls": "AcquirerIsPart",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "hpcheck",
   "cls": "AcquirerHpCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "mpcheck",
   "cls": "AcquirerMpCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "bufcheck",
   "cls": "AcquirerBufCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "timeget",
   "cls": "AcquirerTimeGet",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "round",
   "cls": "AcquirerRound",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "wave",
   "cls": "AcquirerWave",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "activations",
   "cls": "AcquirerActivations",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "unitstate",
   "cls": "AcquirerUnitState",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "instid",
   "cls": "AcquirerInstId",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "speedcheck",
   "cls": "AcquirerSpeedCheck",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "deadallies",
   "cls": "AcquirerDeadAllies",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "areallied",
   "cls": "AcquirerAreAllied",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "allcoinstate",
   "cls": "AcquirerAllCoinState",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "resonance",
   "cls": "AcquirerResonance",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "resource",
   "cls": "AcquirerResource",
   "sig": "resource(var_1, var_2, opt_3)",
   "args": [
    "var_1",
    "var_2",
    "opt_3"
   ],
   "summary": "给予或移除一个队伍的罪孽资源。",
   "params": [
    {
     "name": "var_1",
     "doc": "CRIMSON | SCARLET | AMBER | SHAMROCK | AZURE | INDIGO | VIOLET"
    },
    {
     "name": "var_2",
     "doc": "VALUE_# | 任意整数（生成的资源数量，可为负数）"
    },
    {
     "name": "opt_3",
     "doc": "Enemy（添加此可选参数以影响嫉妒大罪的罪孽资源）"
    }
   ]
  },
  {
   "kind": "acquirer",
   "name": "skillbase",
   "cls": "AcquirerSkillBase",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillatkweight",
   "cls": "AcquirerSkillAtkWeight",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "onescale",
   "cls": "AcquirerOneScale",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillatk",
   "cls": "AcquirerSkillAtk",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillatklevel",
   "cls": "AcquirerSkillAtkLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillattribute",
   "cls": "AcquirerSkillAttribute",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skilldeftype",
   "cls": "AcquirerSkillDefType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillegotype",
   "cls": "AcquirerSkillEgoType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillrank",
   "cls": "AcquirerSkillRank",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillslotcount",
   "cls": "AcquirerSkillSlotCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "amountattacks",
   "cls": "AcquirerAmountAttacks",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "coinisbroken",
   "cls": "AcquirerCoinIsBroken",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "unitcount",
   "cls": "AcquirerUnitCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "breakcount",
   "cls": "AcquirerBreakCount",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "breakvalue",
   "cls": "AcquirerBreakValue",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "coinrerolled",
   "cls": "AcquirerCoinRerolled",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "sameunit",
   "cls": "AcquirerSameUnit",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillcanduel",
   "cls": "AcquirerSkillCanDuel",
   "sig": "skillcanduel(var_1)",
   "args": [
    "var_1"
   ],
   "summary": "将技能上的&quot;canDuel&quot;变量设置为 true/false，即添加或删除[无法拼点]词条",
   "params": [
    {
     "name": "var_1",
     "doc": "True | False"
    }
   ]
  },
  {
   "kind": "acquirer",
   "name": "skillteamkill",
   "cls": "AcquirerSkillTeamKill",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "skillfixedtarget",
   "cls": "AcquirerSkillFixed",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "coinoperator",
   "cls": "AcquirerCoinOperator",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "bufftype",
   "cls": "AcquirerBuffType",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "useddefaction",
   "cls": "AcquirerUsedDefenseActionThisTurn",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "unitfaction",
   "cls": "AcquirerUnitFaction",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "chainstatus",
   "cls": "AcquirerChainStatus",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getopposkillid",
   "cls": "AcquirerGetOpponentSkillId",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getcurrentpower",
   "cls": "AcquirerGetCurrentPower",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "getdefaultmaxhp",
   "cls": "AcquirerGetDefaultMaxHp",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "gethpincrement",
   "cls": "AcquirerGetHpIncrementByLevel",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "diduseskilllastturn",
   "cls": "AcquirerDidUseSkillLastTurn",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "isactionable",
   "cls": "AcquirerIsActionable",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "buffkeywordtoint",
   "cls": "AcquirerBufKeywordToInt",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  },
  {
   "kind": "acquirer",
   "name": "iscrit",
   "cls": "AcquirerIsCrit",
   "sig": "",
   "args": [],
   "summary": "",
   "params": []
  }
 ]
};

// 合并中文说明与实参说明（见 src/knowledge/command-zh.mjs）
// 说明：函数名保持英文原样，只翻译描述；实参说明按「下标」对齐，避免 var_N / opt_N 重复。
const cleanDoc = (t) => String(t ?? '');
const mergeRow = (row) => {
  const key = row.kind + ':' + row.name;
  const zh = COMMAND_ZH[key];
  if (zh && (!row.summary || !String(row.summary).trim())) row.summary = zh[1];
  if (row.summary) row.summary = cleanDoc(row.summary);
  const args = (Array.isArray(row.args) ? row.args : []).map((a, i) => (/^(?:var|opt)_\d+$/.test(String(a)) ? String(a) : 'var_' + (i + 1)));
  const paramDocs = new Map();
  for (const p of row.params || []) {
    const m = /^(?:var|opt)_(\d+)$/.exec(p.name);
    if (m) paramDocs.set(Number(m[1]) - 1, cleanDoc(p.doc));
    else if (!paramDocs.has(-1)) paramDocs.set(-1, cleanDoc(p.doc));
  }
  for (const [k, doc] of Object.entries(ARG_ZH)) {
    if (!k.startsWith(key + ':')) continue;
    const idx = Number(k.slice(key.length + 1));
    if (!paramDocs.has(idx)) paramDocs.set(idx, cleanDoc(doc)); // 只补缺失，不覆盖教程原有说明
  }
  if (!paramDocs.size) return;
  const maxIdx = Math.max(...paramDocs.keys());
  const out = [];
  for (let i = 0; i <= Math.max(maxIdx, args.length - 1); i++) {
    const name = args[i] || ((paramDocs.has(i) ? 'var_' : 'opt_') + (i + 1));
    if (paramDocs.has(i) || args[i]) out.push({ name, doc: paramDocs.get(i) || '' });
  }
  row.params = out;
};
for (const row of MODULAR_TABLES.rows) mergeRow(row);

// 同一函数的旧称 → 正式称呼（来源：Modular 中文教程「四、旧有名称」+ 引擎 consequenceDict 别名赋值）
// 引擎里两者指向同一个类实例，行为完全一致；这里只保留正式称呼，旧称在读取旧模块时自动归一化。
export const COMMAND_ALIASES = {
  consequence: {
    mpdmg: 'healsp',
    buf: 'buff',
    lbreak: 'break',
    explosion: 'burst',
    surge: 'deluge',
    bufcategory: 'buffcategory',
    bufactivate: 'buffactivate',
    activatebufunreliable: 'activatebuffunreliable',
    updatemaxbuff: 'updatemaxbuf',
  },
  acquirer: {
    hpcheck: 'gethp', mpcheck: 'getsp', bufcheck: 'getbuff',
    round: 'getround', wave: 'getwave', activations: 'getactivations',
    unitstate: 'getunitstate', instid: 'getinstid', speedcheck: 'getspeed',
    deadallies: 'getdeadallies', areallied: 'areallies', allcoinstate: 'getallcoinstates',
    resonance: 'getresonance', resource: 'getresource', skillbase: 'getskillbase',
    skillatkweight: 'getskillatkweight', skillatklevel: 'getskillatklevel', skillatk: 'getskillatk',
    skillattribute: 'getskillattribute', skilldeftype: 'getskilldeftype', skillrank: 'getskillrank',
    skillegotype: 'getskillegotype', skillslotcount: 'getskillslotcount', skillcanduel: 'getskillcanduel',
    skillteamkill: 'getskillteamkill', skillfixedtarget: 'getskillfixedtarget', onescale: 'getcoinscale',
    amountattacks: 'getattackamount', coinisbroken: 'iscoinbroken', unitcount: 'getunitcount',
    breakcount: 'getbreakcount', breakvalue: 'getbreakvalue', timeget: 'gettime',
    coinrerolled: 'iscoinrerolled', sameunit: 'issameunit', coinoperator: 'getcoinoperator',
    bufftype: 'getbufftype', useddefaction: 'hasuseddefense', unitfaction: 'getunitfaction',
    chainstatus: 'getchainstatus', buffkeywordtoint: 'bufkeywordtoint',
  },
};

export function canonicalCommand(kind, name) {
  const map = COMMAND_ALIASES[kind];
  return (map && map[name]) || name;
}

// 合并：旧称行并入正式称呼行（说明按需补齐），然后移除旧称行
{
  const rows = MODULAR_TABLES.rows;
  const keep = [];
  for (const row of rows) {
    const target = canonicalCommand(row.kind, row.name);
    if (target === row.name) { keep.push(row); continue; }
    const canonical = rows.find((r) => r.kind === row.kind && r.name === target && r !== row);
    if (!canonical) { row.name = target; keep.push(row); continue; }
    if (!canonical.summary && row.summary) canonical.summary = row.summary;
    if ((!canonical.params || !canonical.params.length) && row.params && row.params.length) canonical.params = row.params;
    if (!Array.isArray(canonical.aliasOf)) canonical.aliasOf = [];
    canonical.aliasOf.push(row.name);
  }
  for (const r of keep) if (!Array.isArray(r.aliasOf)) r.aliasOf = [];
  MODULAR_TABLES.rows = keep;
  MODULAR_TABLES.count = keep.length;
}

// 把没有独立行的旧称也登记到 aliasOf，便于界面提示「旧称：xxx」
{
  for (const [kind, map] of Object.entries(COMMAND_ALIASES)) {
    for (const [alias, target] of Object.entries(map)) {
      const canonical = MODULAR_TABLES.rows.find((r) => r.kind === kind && r.name === target);
      if (!canonical) continue;
      if (!Array.isArray(canonical.aliasOf)) canonical.aliasOf = [];
      if (!canonical.aliasOf.includes(alias)) canonical.aliasOf.push(alias);
    }
  }
}

// 旧调用写的 `bufcheck(...)` 之类，读取时归一成正式称呼
export function normalizeCommandName(kind, name) { return canonicalCommand(kind, name); }

// @engine-merge-v1
import { COMMANDS as ENGINE_ROWS, TIMINGS as ENGINE_TIMINGS } from './engine-registry.mjs';
// 引擎注册表（当前 5.1.17 + MT）里存在、但本表还没有的命令 → 自动补行（参数个数取引擎实测，说明留空）
(function mergeEngineCommands() {
  const have = new Set(MODULAR_TABLES.rows.map((r) => r.kind + ':' + r.name));
  const aliases = new Map();
  for (const e of ENGINE_ROWS) {
    if (e.aliasOf) {
      const k = e.kind + ':' + e.aliasOf;
      if (!aliases.has(k)) aliases.set(k, []);
      aliases.get(k).push(e.name);
    }
  }
  for (const e of ENGINE_ROWS) {
    if (e.aliasOf) continue;
    const key = e.kind + ':' + e.name;
    if (have.has(key)) continue;
    const params = Array.from({ length: Math.max(0, e.params | 0) }, (_x, i) => ({ name: 'var_' + (i + 1), doc: '' }));
    MODULAR_TABLES.rows.push({
      kind: e.kind, name: e.name, en: e.name, cls: e.cls || '', src: e.src || 'modular',
      params, summary: '', zh: '', aliasOf: aliases.get(key) || [], engineOnly: true,
    });
    have.add(key);
  }
  for (const r of MODULAR_TABLES.rows) {
    const extra = aliases.get(r.kind + ':' + r.name);
    if (extra && extra.length) {
      const merged = new Set([...(r.aliasOf || []), ...extra]);
      r.aliasOf = [...merged];
    }
  }
  MODULAR_TABLES.count = MODULAR_TABLES.rows.length;
})();

export const COMMANDS = MODULAR_TABLES.rows;
export const CONSEQUENCES = COMMANDS.filter((c) => c.kind === 'consequence');
export const ACQUIRERS = COMMANDS.filter((c) => c.kind === 'acquirer');

/** 按名字查一条（consequence 与 acquirer 同名时优先 consequence）。 */
export function findCommand(name) {
  const key = String(name || '').trim();
  return CONSEQUENCES.find((c) => c.name === key) || ACQUIRERS.find((c) => c.name === key) || null;
}

/** 有中文说明的子集，供 UI 直接列（未收录说明的只给名字）。 */
export function documentedCommands() {
  return COMMANDS.filter((c) => c.summary);
}

export function modularStats() {
  return {
    total: COMMANDS.length,
    consequences: CONSEQUENCES.length,
    acquirers: ACQUIRERS.length,
    documented: COMMANDS.filter((c) => c.summary).length,
    withParams: COMMANDS.filter((c) => c.params.length > 0).length,
  };
}

// MANUAL_FIXUPS_20261028：中文教程把 consequence 的 resource 签名套到了 acquirer getresource 上，
// 并把 getresource 的说明贴给了 getresonance。按引擎（AcquirerResonance 只读 circledSection；
// AcquirerResource 读 circles[0] + circles.Length>=2）与教程签名校正。
{
  const pick = (kind, name) => (MODULAR_TABLES.rows || []).find((r) => r.kind === kind && r.name === name);
  const gres = pick('acquirer', 'getresonance');
  if (gres) {
    gres.params = [{ name: 'var_1', doc: '罪孽属性（CRIMSON / SCARLET / AMBER / SHAMROCK / AZURE / INDIGO / VIOLET），或 highres（取最高共鸣）' }];
    gres.summary = '返回当前阵营指定罪孽属性的共鸣数。';
  }
  const gr = pick('acquirer', 'getresource');
  if (gr) {
    gr.params = [
      { name: 'var_1', doc: '罪孽属性，或 0~6 的整数（资源种类）' },
      { name: 'opt_2', doc: '填 Enemy 时读取敌方队伍的资源' },
    ];
  }
}
