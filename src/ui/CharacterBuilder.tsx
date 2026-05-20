import { Dices, Plus, Shuffle, Trash2, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { emptyDraft } from "../data/creationCatalog";
import {
  buildCharacter,
  cloneDraft,
  validateCharacterDraft,
} from "../engine/creationRules";
import type { CharacterDraft, CharacterTemplate, CreationCatalog, CreationOption, CreationOptionType } from "../engine/types";

interface CharacterBuilderProps {
  catalog: CreationCatalog;
  onStart: (characters: CharacterTemplate[]) => void;
}

const statLabels: Record<keyof CharacterDraft["stats"], string> = {
  karate: "空手道",
  neuron: "神经元",
  wazamae: "巧手",
  jitsu: "忍术值",
};

export function CharacterBuilder({ catalog, onStart }: CharacterBuilderProps) {
  const [drafts, setDrafts] = useState<CharacterDraft[]>(() => catalog.presets.slice(0, 4).map(cloneDraft));
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDraft = drafts[activeIndex] ?? drafts[0];
  const builds = drafts.map((draft) => buildCharacter(draft, catalog));
  const activeBuild = activeDraft ? buildCharacter(activeDraft, catalog) : undefined;
  const allErrors = builds.flatMap((build, index) =>
    build.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${drafts[index].name || `第 ${index + 1} 名忍者`}：${issue.message}`),
  );
  const canStart = drafts.length >= 3 && drafts.length <= 4 && allErrors.length === 0;

  const updateActiveDraft = (updater: (draft: CharacterDraft) => CharacterDraft) => {
    setDrafts((current) => current.map((draft, index) => (index === activeIndex ? updater(cloneDraft(draft)) : draft)));
  };

  const startTraining = () => {
    const characters = builds.map((build) => build.character).filter((character): character is CharacterTemplate => Boolean(character));

    if (canStart && characters.length === drafts.length) {
      onStart(characters);
    }
  };

  return (
    <div className="builder-layout">
      <section className="builder-area">
        <div className="section-heading">
          <h2>建卡道场</h2>
          <span>{drafts.length} 名忍者待命</span>
        </div>
        <div className="squad-picker">
          {drafts.map((draft, index) => {
            const issues = validateCharacterDraft(draft, catalog).filter((issue) => issue.severity === "error");
            return (
              <button
                className={index === activeIndex ? "squad-slot active" : "squad-slot"}
                key={`${draft.id}-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                <strong>{draft.name}</strong>
                <span>{issues.length === 0 ? "合法" : `${issues.length} 个问题`}</span>
              </button>
            );
          })}
        </div>
        <div className="builder-toolbar">
          <button disabled={drafts.length >= 4} onClick={() => addDraft(drafts, setDrafts, setActiveIndex)} type="button">
            <Plus size={17} />
            增员
          </button>
          <button disabled={drafts.length <= 3} onClick={() => removeDraft(drafts, setDrafts, activeIndex, setActiveIndex)} type="button">
            <Trash2 size={17} />
            减员
          </button>
          <button onClick={() => randomizeActive(catalog, updateActiveDraft)} type="button">
            <Shuffle size={17} />
            快速随机
          </button>
          <button className="primary-action" disabled={!canStart} onClick={startTraining} type="button">
            <UserRoundCheck size={17} />
            开始训练
          </button>
        </div>
        {allErrors.length > 0 ? (
          <div className="validation-list" role="alert">
            {allErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
      </section>

      {activeDraft && activeBuild ? (
        <section className="builder-area">
          <div className="section-heading">
            <h2>手动编辑</h2>
            <span>
              能力 {activeBuild.totalAbilityPoints}/{catalog.rules.abilityPointBudget} · 选项 {activeBuild.totalOptionCost}/
              {catalog.rules.optionPointBudget}
            </span>
          </div>

          <div className="identity-grid">
            <label>
              忍者名
              <input
                onChange={(event) => updateActiveDraft((draft) => ({ ...draft, name: event.target.value }))}
                value={activeDraft.name}
              />
            </label>
            <label>
              定位
              <input
                onChange={(event) => updateActiveDraft((draft) => ({ ...draft, role: event.target.value }))}
                value={activeDraft.role}
              />
            </label>
          </div>

          <div className="stat-editor">
            {Object.entries(statLabels).map(([key, label]) => {
              const statKey = key as keyof CharacterDraft["stats"];
              return (
                <label key={key}>
                  {label}
                  <input
                    max={catalog.rules.maxStats[statKey]}
                    min={catalog.rules.minStats[statKey]}
                    onChange={(event) =>
                      updateActiveDraft((draft) => ({
                        ...draft,
                        stats: { ...draft.stats, [statKey]: Number(event.target.value) },
                      }))
                    }
                    type="number"
                    value={activeDraft.stats[statKey]}
                  />
                </label>
              );
            })}
          </div>

          <div className="preset-bank">
            <h3>使用预设</h3>
            <div className="preset-buttons">
              {catalog.presets.map((preset) => (
                <button key={preset.id} onClick={() => updateActiveDraft(() => cloneDraft(preset))} type="button">
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <OptionGroup
            activeDraft={activeDraft}
            catalog={catalog}
            onToggle={(option) => toggleOption(option, updateActiveDraft)}
            options={catalog.equipment}
            title="装备"
          />
          <OptionGroup
            activeDraft={activeDraft}
            catalog={catalog}
            onToggle={(option) => toggleOption(option, updateActiveDraft)}
            options={catalog.skills}
            title="技能"
          />
          <OptionGroup
            activeDraft={activeDraft}
            catalog={catalog}
            onToggle={(option) => toggleOption(option, updateActiveDraft)}
            options={catalog.jutsu}
            title="忍术"
          />
        </section>
      ) : null}

      {activeBuild ? (
        <section className="builder-area preview-area">
          <div className="section-heading">
            <h2>入场预览</h2>
            <span>自动计算</span>
          </div>
          <div className="derived-grid">
            <span>体力 {activeBuild.character?.stats.health ?? "-"}</span>
            <span>精神 {activeBuild.character?.stats.mental ?? "-"}</span>
            <span>脚力 {activeBuild.character?.stats.footwork ?? "-"}</span>
            <span>攻击 {activeBuild.derived.attack}</span>
            <span>射击 {activeBuild.derived.shooting}</span>
            <span>先制 {activeBuild.derived.initiative}</span>
            <span>闪避 {activeBuild.derived.evasion}</span>
            <span>施术 {activeBuild.derived.casting}</span>
          </div>
          <div className="loadout-list">
            <h3>携行装备</h3>
            <p>{activeBuild.character?.equipment.join("、") || "无"}</p>
            <h3>技能与忍术</h3>
            <p>{[...(activeBuild.character?.skills ?? []), ...(activeBuild.character?.jutsu ?? [])].join("、") || "无"}</p>
          </div>
          <div className="validation-list">
            {activeBuild.issues.map((issue) => (
              <p className={issue.severity} key={`${issue.field}-${issue.message}`}>
                {issue.message}
              </p>
            ))}
          </div>
          <div className="dice-note">
            <Dices size={17} />
            骰池会在战斗日志中显示来源数值。
          </div>
        </section>
      ) : null}
    </div>
  );
}

function OptionGroup({
  activeDraft,
  catalog,
  onToggle,
  options,
  title,
}: {
  activeDraft: CharacterDraft;
  catalog: CreationCatalog;
  onToggle: (option: CreationOption) => void;
  options: CreationOption[];
  title: string;
}) {
  const issues = validateCharacterDraft(activeDraft, catalog);
  return (
    <div className="option-group">
      <h3>{title}</h3>
      <div className="option-grid">
        {options.map((option) => {
          const checked = selectedIdsForType(activeDraft, option.type).includes(option.id);
          const blocked = issues.some((issue) => issue.field === option.type && issue.message.includes(option.name));

          return (
            <label className={blocked ? "option-chip blocked" : "option-chip"} key={option.id}>
              <input checked={checked} onChange={() => onToggle(option)} type="checkbox" />
              <span>
                <strong>{option.name}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function addDraft(
  drafts: CharacterDraft[],
  setDrafts: (drafts: CharacterDraft[]) => void,
  setActiveIndex: (index: number) => void,
) {
  const next = {
    ...cloneDraft(emptyDraft),
    id: `custom-ninja-${drafts.length + 1}`,
    name: `无名忍者 ${drafts.length + 1}`,
  };
  setDrafts([...drafts, next]);
  setActiveIndex(drafts.length);
}

function removeDraft(
  drafts: CharacterDraft[],
  setDrafts: (drafts: CharacterDraft[]) => void,
  activeIndex: number,
  setActiveIndex: (index: number) => void,
) {
  const next = drafts.filter((_, index) => index !== activeIndex);
  setDrafts(next);
  setActiveIndex(Math.max(0, Math.min(activeIndex, next.length - 1)));
}

function randomizeActive(
  catalog: CreationCatalog,
  updateActiveDraft: (updater: (draft: CharacterDraft) => CharacterDraft) => void,
) {
  const source = catalog.presets[Math.floor(Math.random() * catalog.presets.length)];
  updateActiveDraft((draft) => ({
    ...cloneDraft(source),
    id: draft.id,
    name: `${source.name}-${Math.floor(Math.random() * 90 + 10)}`,
  }));
}

function toggleOption(
  option: CreationOption,
  updateActiveDraft: (updater: (draft: CharacterDraft) => CharacterDraft) => void,
) {
  updateActiveDraft((draft) => {
    const key = idsKeyForType(option.type);
    const ids = draft[key];
    return {
      ...draft,
      [key]: ids.includes(option.id) ? ids.filter((id) => id !== option.id) : [...ids, option.id],
    };
  });
}

function selectedIdsForType(draft: CharacterDraft, type: CreationOptionType): string[] {
  return draft[idsKeyForType(type)];
}

function idsKeyForType(type: CreationOptionType): "equipmentIds" | "skillIds" | "jutsuIds" {
  const keys: Record<CreationOptionType, "equipmentIds" | "skillIds" | "jutsuIds"> = {
    equipment: "equipmentIds",
    skill: "skillIds",
    jutsu: "jutsuIds",
  };

  return keys[type];
}
