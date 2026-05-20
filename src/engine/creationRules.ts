import type {
  BaseStats,
  BuildResult,
  CharacterDraft,
  CreationCatalog,
  CreationOption,
  CreationValidationIssue,
  DerivedStats,
  RuleEffect,
} from "./types";

type CoreStatKey = keyof CharacterDraft["stats"];

const coreStatKeys: CoreStatKey[] = ["karate", "neuron", "wazamae", "jitsu"];

export function buildCharacter(draft: CharacterDraft, catalog: CreationCatalog): BuildResult {
  const selectedOptions = getSelectedOptions(draft, catalog);
  const effects = selectedOptions.flatMap((option) => option.effects);
  const baseStats = deriveBaseStats(draft.stats, effects);
  const derived = deriveCharacterStats(draft.stats, effects);
  const issues = validateCharacterDraft(draft, catalog);
  const hasErrors = issues.some((issue) => issue.severity === "error");
  const totalAbilityPoints = sumAbilityPoints(draft);
  const totalOptionCost = selectedOptions.reduce((total, option) => total + option.cost, 0);

  return {
    character: hasErrors
      ? undefined
      : {
          id: draft.id,
          name: draft.name.trim(),
          side: "pc",
          role: draft.role.trim() || "新晋总会屋忍者",
          tags: ["ninja", "soukaiya", ...collectEffectTags(effects)],
          stats: baseStats,
          derived,
          dkk: 0,
          reputation: catalog.rules.startingReputation,
          money: catalog.rules.startingMoney,
          equipment: selectedOptions.filter((option) => option.type === "equipment").map((option) => option.name),
          skills: selectedOptions.filter((option) => option.type === "skill").map((option) => option.name),
          jutsu: selectedOptions.filter((option) => option.type === "jutsu").map((option) => option.name),
          weapons: dedupeWeapons([...catalog.rules.defaultWeapons, ...effects.flatMap((effect) => effect.weapon ?? [])]),
          optionIds: selectedOptions.map((option) => option.id),
          ruleEffects: effects,
          presetId: draft.id,
          boss: false,
          rulesSource: "入门规则 V4 建卡",
        },
    derived,
    issues,
    totalAbilityPoints,
    totalOptionCost,
  };
}

export function validateCharacterDraft(
  draft: CharacterDraft,
  catalog: CreationCatalog,
): CreationValidationIssue[] {
  const issues: CreationValidationIssue[] = [];
  const allOptions = getAllOptions(catalog);
  const selectedIds = [...draft.equipmentIds, ...draft.skillIds, ...draft.jutsuIds];
  const selectedOptions = getSelectedOptions(draft, catalog);
  const abilityPoints = sumAbilityPoints(draft);
  const optionCost = selectedOptions.reduce((total, option) => total + option.cost, 0);

  if (draft.name.trim().length === 0) {
    issues.push({ field: "name", message: "忍者名不能为空。", severity: "error" });
  }

  for (const key of coreStatKeys) {
    const value = draft.stats[key];
    const min = catalog.rules.minStats[key];
    const max = catalog.rules.maxStats[key];

    if (!Number.isInteger(value)) {
      issues.push({ field: key, message: `${statName(key)} 必须是整数。`, severity: "error" });
    } else if (value < min || value > max) {
      issues.push({ field: key, message: `${statName(key)} 必须在 ${min}-${max} 之间。`, severity: "error" });
    }
  }

  if (abilityPoints > catalog.rules.abilityPointBudget) {
    issues.push({
      field: "stats",
      message: `基础能力合计 ${abilityPoints}，超过上限 ${catalog.rules.abilityPointBudget}。`,
      severity: "error",
    });
  }

  if (draft.equipmentIds.length > catalog.rules.maxEquipment) {
    issues.push({ field: "equipment", message: `装备最多选择 ${catalog.rules.maxEquipment} 项。`, severity: "error" });
  }

  if (draft.skillIds.length > catalog.rules.maxSkills) {
    issues.push({ field: "skills", message: `技能最多选择 ${catalog.rules.maxSkills} 项。`, severity: "error" });
  }

  if (draft.jutsuIds.length > catalog.rules.maxJutsu) {
    issues.push({ field: "jutsu", message: `忍术最多选择 ${catalog.rules.maxJutsu} 项。`, severity: "error" });
  }

  if (optionCost > catalog.rules.optionPointBudget) {
    issues.push({
      field: "options",
      message: `选项花费 ${optionCost}，超过上限 ${catalog.rules.optionPointBudget}。`,
      severity: "error",
    });
  }

  const duplicateIds = selectedIds.filter((id, index) => selectedIds.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) {
    issues.push({ field: "options", message: `重复选择了 ${findOptionName(allOptions, id)}。`, severity: "error" });
  }

  for (const id of selectedIds) {
    const option = allOptions.find((candidate) => candidate.id === id);

    if (!option) {
      issues.push({ field: "options", message: `未知选项：${id}。`, severity: "error" });
      continue;
    }

    if (!meetsRequirements(draft, option)) {
      issues.push({
        field: option.type,
        message: `${option.name} 的前提条件不满足。`,
        severity: "error",
      });
    }
  }

  if (draft.jutsuIds.length > 0 && draft.stats.jitsu <= 0) {
    issues.push({ field: "jutsu", message: "没有忍术值时不能选择忍术。", severity: "error" });
  }

  if (draft.equipmentIds.length === 0) {
    issues.push({ field: "equipment", message: "至少带一件装备会更适合入门训练。", severity: "warning" });
  }

  return issues;
}

export function deriveBaseStats(
  stats: CharacterDraft["stats"],
  effects: RuleEffect[] = [],
): BaseStats {
  return {
    ...stats,
    health: Math.max(1, stats.karate + sumEffects(effects, "healthBonus")),
    mental: Math.max(1, stats.neuron + sumEffects(effects, "mentalBonus")),
    footwork: Math.max(2, (stats.wazamae >= 6 ? 4 : 3) + sumEffects(effects, "footworkBonus")),
  };
}

export function deriveCharacterStats(
  stats: CharacterDraft["stats"],
  effects: RuleEffect[] = [],
): DerivedStats {
  const attack = Math.max(0, stats.karate + sumEffects(effects, "attackBonus"));
  const shooting = Math.max(0, stats.wazamae + sumEffects(effects, "shootingBonus"));
  const initiative = Math.max(0, stats.neuron + sumEffects(effects, "initiativeBonus"));
  const hacking = Math.max(0, stats.neuron + sumEffects(effects, "hackingBonus"));
  const casting = Math.max(0, stats.neuron + stats.jitsu + sumEffects(effects, "castingBonus"));
  const evasion = Math.max(0, Math.max(attack, shooting, initiative, casting) + sumEffects(effects, "evasionBonus"));

  return {
    attack,
    shooting,
    initiative,
    hacking,
    evasion,
    precision: shooting,
    cartwheel: stats.wazamae,
    casting,
  };
}

export function getSelectedOptions(draft: CharacterDraft, catalog: CreationCatalog): CreationOption[] {
  const allOptions = getAllOptions(catalog);
  return [...draft.equipmentIds, ...draft.skillIds, ...draft.jutsuIds]
    .map((id) => allOptions.find((option) => option.id === id))
    .filter((option): option is CreationOption => Boolean(option));
}

export function getAllOptions(catalog: CreationCatalog): CreationOption[] {
  return [...catalog.equipment, ...catalog.skills, ...catalog.jutsu];
}

export function cloneDraft(draft: CharacterDraft): CharacterDraft {
  return structuredClone(draft);
}

function sumAbilityPoints(draft: CharacterDraft): number {
  return coreStatKeys.reduce((total, key) => total + draft.stats[key], 0);
}

function meetsRequirements(draft: CharacterDraft, option: CreationOption): boolean {
  if (!option.requirements) {
    return true;
  }

  return Object.entries(option.requirements).every(([key, minimum]) => {
    const statKey = key as CoreStatKey;
    return draft.stats[statKey] >= (minimum ?? 0);
  });
}

function sumEffects(effects: RuleEffect[], key: keyof RuleEffect): number {
  return effects.reduce((total, effect) => {
    const value = effect[key];
    return typeof value === "number" ? total + value : total;
  }, 0);
}

function collectEffectTags(effects: RuleEffect[]): string[] {
  return Array.from(new Set(effects.flatMap((effect) => effect.tags ?? [])));
}

function dedupeWeapons(weapons: NonNullable<RuleEffect["weapon"]>[]) {
  return Array.from(new Map(weapons.map((weapon) => [weapon.id, weapon])).values());
}

function findOptionName(options: CreationOption[], id: string): string {
  return options.find((option) => option.id === id)?.name ?? id;
}

function statName(key: CoreStatKey): string {
  return {
    karate: "空手道",
    neuron: "神经元",
    wazamae: "巧手",
    jitsu: "忍术值",
  }[key];
}
