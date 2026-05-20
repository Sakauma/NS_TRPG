import type { Action, GameContent, GameState, RuleEngine } from "./types";
import { hasLineOfSight, isAdjacent, isHazard, manhattanDistance, reachableCells, samePosition } from "./mapRules";
import {
  activeEnemies,
  activePcs,
  enterNextRoom,
  pushLog,
  requireMap,
  requireRoom,
} from "./scenarioRules";
import {
  advanceTurn,
  checkRoomOutcome,
  getBestMeleeWeapon,
  getBestRangedWeapon,
  requireActor,
  resolveAttack,
  resolveJutsu,
} from "./combatRules";

export { createInitialState } from "./scenarioRules";
export { difficultyLabel, rollCheck } from "./diceRules";
export { hasLineOfSight, reachableCells } from "./mapRules";

export function createRuleEngine(content: GameContent): RuleEngine {
  return {
    getLegalActions: (state, actorId) => getLegalActions(content, state, actorId),
    applyAction: (state, action) => applyAction(content, state, action),
    checkVictory: (state) => checkVictory(state),
  };
}

function getLegalActions(content: GameContent, state: GameState, actorId = state.activeActorId): Action[] {
  if (state.sequence === "gameOver") {
    return [];
  }

  if (state.sequence === "cleared") {
    return [{ type: "advanceRoom" }];
  }

  if (state.activeActorId !== actorId || state.phase === "gameOver" || state.phase === "cleared") {
    return [];
  }

  const actor = requireActor(state, actorId);

  if (actor.status !== "active") {
    return [{ type: "endTurn", actorId }];
  }

  const map = requireMap(content, requireRoom(content, state.roomId).mapId);

  if (state.phase === "move") {
    return [
      ...reachableCells(map, state.actors, actor).map<Action>((to) => ({ type: "move", actorId, to })),
      { type: "skipMove", actorId },
      ...(actor.side === "pc" ? [{ type: "focus", actorId } satisfies Action] : []),
    ];
  }

  const enemies = state.actors.filter(
    (candidate) => candidate.side !== actor.side && candidate.status === "active",
  );
  const actions: Action[] = [];

  for (const target of enemies) {
    if (isAdjacent(actor.position, target.position)) {
      const meleeWeapon = getBestMeleeWeapon(actor);
      actions.push({ type: "meleeAttack", actorId, targetId: target.id });

      for (const style of meleeWeapon.styles ?? []) {
        actions.push({ type: "meleeAttack", actorId, targetId: target.id, style });
      }
    }

    const rangedWeapon = getBestRangedWeapon(actor);

    if (
      rangedWeapon &&
      !isAdjacent(actor.position, target.position) &&
      hasLineOfSight(map, actor.position, target.position) &&
      manhattanDistance(actor.position, target.position) <= (rangedWeapon.range ?? 99)
    ) {
      actions.push({ type: "rangedAttack", actorId, targetId: target.id, weaponId: rangedWeapon.id });
    }

    if (
      actor.jutsu.length > 0 &&
      actor.mental > 0 &&
      manhattanDistance(actor.position, target.position) <= 3 &&
      hasLineOfSight(map, actor.position, target.position)
    ) {
      actions.push({ type: "castJutsu", actorId, targetId: target.id });
    }
  }

  if (actor.side === "pc" && actor.mental > 0 && !actor.focused) {
    actions.push({ type: "adrenaline", actorId });
  }

  actions.push({ type: "endTurn", actorId });
  return actions;
}

function applyAction(content: GameContent, state: GameState, action: Action): GameState {
  const legalActions = getLegalActions(content, state, "actorId" in action ? action.actorId : undefined);

  if (!legalActions.some((legalAction) => actionsMatch(legalAction, action))) {
    throw new Error(`Illegal action: ${JSON.stringify(action)}`);
  }

  if (action.type === "advanceRoom") {
    return enterNextRoom(content, state);
  }

  const nextState = structuredClone(state);
  const actor = requireActor(nextState, action.actorId);

  if (action.type === "move") {
    const map = requireMap(content, requireRoom(content, nextState.roomId).mapId);
    actor.position = action.to;
    nextState.phase = "attack";
    pushLog(nextState, actor.id, `${actor.name} 移动到 (${action.to.x + 1}, ${action.to.y + 1})。`);
    applyHazardIfNeeded(nextState, actor.id, map);
    return nextState;
  }

  if (action.type === "skipMove") {
    nextState.phase = "attack";
    pushLog(nextState, actor.id, `${actor.name} 放弃移动。`);
    return nextState;
  }

  if (action.type === "focus") {
    actor.focused = true;
    nextState.phase = "attack";
    pushLog(nextState, actor.id, `${actor.name} 进入集中状态。`);
    return nextState;
  }

  if (action.type === "adrenaline") {
    actor.mental -= 1;
    actor.focused = true;
    pushLog(nextState, actor.id, `${actor.name} 使用忍者肾上腺素，下一次攻击/忍术难度降低。`);
    return nextState;
  }

  if (action.type === "meleeAttack") {
    return resolveAttack(
      content,
      nextState,
      actor,
      requireActor(nextState, action.targetId),
      getBestMeleeWeapon(actor),
      action.style,
    );
  }

  if (action.type === "rangedAttack") {
    const weapon = getBestRangedWeapon(actor);

    if (!weapon) {
      throw new Error(`${actor.name} has no ranged weapon.`);
    }

    return resolveAttack(content, nextState, actor, requireActor(nextState, action.targetId), weapon);
  }

  if (action.type === "castJutsu") {
    return resolveJutsu(content, nextState, actor, requireActor(nextState, action.targetId));
  }

  const ended = advanceTurn(content, nextState);
  return checkRoomOutcome(content, ended);
}

function checkVictory(state: GameState): "victory" | "defeat" | undefined {
  if (state.outcome) {
    return state.outcome;
  }

  if (activePcs(state).length === 0) {
    return "defeat";
  }

  if (state.sequence === "gameOver" && activeEnemies(state).length === 0) {
    return "victory";
  }

  return undefined;
}

function actionsMatch(left: Action, right: Action): boolean {
  if (left.type !== right.type) {
    return false;
  }

  if ("actorId" in left && "actorId" in right && left.actorId !== right.actorId) {
    return false;
  }

  if (left.type === "move" && right.type === "move") {
    return samePosition(left.to, right.to);
  }

  if ("targetId" in left && "targetId" in right && left.targetId !== right.targetId) {
    return false;
  }

  if (left.type === "meleeAttack" && right.type === "meleeAttack" && left.style !== right.style) {
    return false;
  }

  return true;
}

function applyHazardIfNeeded(state: GameState, actorId: string, map: ReturnType<typeof requireMap>) {
  const actor = requireActor(state, actorId);

  if (!isHazard(map, actor.position) || actor.status !== "active") {
    return;
  }

  actor.health -= 1;
  pushLog(state, actor.id, `${actor.name} 踏入危险地形，受到 1 点伤害。`);

  if (actor.health < 0) {
    actor.status = "dead";
    pushLog(state, actor.id, `${actor.name} 爆发四散。`);
  } else if (actor.health === 0) {
    actor.status = "unconscious";
    pushLog(state, actor.id, `${actor.name} 陷入气绝。`);
  }
}
