import { Brain, Crosshair, Dices, Footprints, Swords, Wind, Zap } from "lucide-react";
import { portraitUrlForTemplateId } from "../data/portraits";
import type { Action, ActorState, GameContent, GameState } from "../engine/types";
import { difficultyLabel } from "../engine/rules";
import { requireRoom } from "../engine/scenarioRules";

interface ActionPanelProps {
  content: GameContent;
  state: GameState;
  legalActions: Action[];
  onAction: (action: Action) => void;
}

export function ActionPanel({ content, state, legalActions, onAction }: ActionPanelProps) {
  const room = requireRoom(content, state.roomId);
  const activeActor = state.actors.find((actor) => actor.id === state.activeActorId);

  if (state.sequence === "cleared") {
    const advance = legalActions.find((action) => action.type === "advanceRoom");
    return (
      <section className="action-area">
        <div className="section-heading">
          <h2>房间完成</h2>
          <span>{room.sourcePage}</span>
        </div>
        <p className="scenario-copy">{room.objective}</p>
        {advance ? (
          <button className="primary-action" type="button" onClick={() => onAction(advance)}>
            <Footprints size={18} />
            进入下一房间
          </button>
        ) : null}
      </section>
    );
  }

  if (!activeActor) {
    return null;
  }

  const skipMove = legalActions.find((action) => action.type === "skipMove");
  const focus = legalActions.find((action) => action.type === "focus");
  const adrenaline = legalActions.find((action) => action.type === "adrenaline");
  const attacks = legalActions.filter((action) =>
    ["meleeAttack", "rangedAttack", "castJutsu"].includes(action.type),
  );
  const endTurn = legalActions.find((action) => action.type === "endTurn");

  return (
    <section className="action-area" aria-label="行动面板">
      <div className="section-heading">
        <h2>行动</h2>
        <span>{activeActor.name} / {state.phase === "move" ? "移动阶段" : "攻击阶段"}</span>
      </div>

      <div className="phase-bar">
        <span className="phase-pill active">第 {state.round} 回合</span>
        <span className="phase-pill">{describeAtmosphere(state.atmosphere)}</span>
        <span className="phase-pill">闪避 {difficultyLabel("normal")}</span>
      </div>

      {state.phase === "move" ? (
        <div className="action-stack">
          <p className="hint">可移动格子已在地图上高亮。通常移动不能斜向移动，不能穿过障碍或其他角色。</p>
          {focus ? (
            <button type="button" onClick={() => onAction(focus)}>
              <Brain size={17} />
              集中并放弃移动
            </button>
          ) : null}
          {skipMove ? (
            <button type="button" onClick={() => onAction(skipMove)}>
              <Wind size={17} />
              不移动
            </button>
          ) : null}
        </div>
      ) : (
        <div className="action-stack">
          {attacks.length === 0 ? <p className="hint">当前没有可攻击目标。</p> : null}
          {attacks.map((action, index) => (
            <button key={`${action.type}-${index}`} type="button" onClick={() => onAction(action)}>
              {pickActionIcon(action)}
              {describeAction(action, state)}
            </button>
          ))}
          {adrenaline ? (
            <button type="button" onClick={() => onAction(adrenaline)}>
              <Zap size={17} />
              忍者肾上腺素
            </button>
          ) : null}
          {endTurn ? (
            <button className="primary-action" type="button" onClick={() => onAction(endTurn)}>
              <Dices size={17} />
              结束行动
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function describeAction(action: Action, state: GameState): string {
  if (!("targetId" in action)) {
    return action.type;
  }

  const target = state.actors.find((actor) => actor.id === action.targetId);
  const targetName = target?.name ?? "目标";

  if (action.type === "meleeAttack") {
    return `${describeAttackStyle(action.style)}：${targetName}`;
  }

  if (action.type === "rangedAttack") {
    return `射击：${targetName}`;
  }

  return `忍术：${targetName}`;
}

function pickActionIcon(action: Action) {
  if (action.type === "meleeAttack") {
    return <Swords size={17} />;
  }

  if (action.type === "rangedAttack") {
    return <Crosshair size={17} />;
  }

  return <Brain size={17} />;
}

function describeAttackStyle(style: Extract<Action, { type: "meleeAttack" }>["style"]): string {
  return {
    normal: "近战攻击",
    power: "强攻击",
    precision: "精密攻击",
  }[style ?? "normal"];
}

export function ScenarioPanel({ content, state }: { content: GameContent; state: GameState }) {
  const room = requireRoom(content, state.roomId);

  return (
    <section className="scenario-area">
      <div className="section-heading">
        <h2>{room.title}</h2>
        <span>{room.sourcePage}</span>
      </div>
      <p className="scenario-copy">{room.intro}</p>
      <p className="objective">{room.objective}</p>
      <div className="focus-list">
        {room.ruleFocus.map((focus) => (
          <span key={focus}>{focus}</span>
        ))}
      </div>
    </section>
  );
}

export function ActorCard({ actor }: { actor: ActorState }) {
  const portraitUrl = portraitUrlForTemplateId(actor.templateId);

  return (
    <article className={`actor-card ${actor.side} ${actor.status}`}>
      <div className="actor-card-header">
        <img alt="" className="actor-portrait" src={portraitUrl} />
        <div className="actor-card-title">
          <strong>{actor.name}</strong>
          <span>{actor.role}</span>
        </div>
      </div>
      <div className="stat-line">
        <span>体力 {actor.health}/{actor.stats.health}</span>
        <span>精神 {actor.mental}/{actor.stats.mental}</span>
        <span>闪避骰 {actor.dodgeDice}</span>
      </div>
      <div className="stat-line">
        <span>空手道 {actor.stats.karate}</span>
        <span>神经元 {actor.stats.neuron}</span>
        <span>巧手 {actor.stats.wazamae}</span>
        <span>杀戮值 {actor.dkk}</span>
      </div>
    </article>
  );
}

function describeAtmosphere(atmosphere: string): string {
  return {
    normal: "通常气氛",
    hard: "硬核气氛",
    ultraHard: "超硬核气氛",
  }[atmosphere] ?? atmosphere;
}
