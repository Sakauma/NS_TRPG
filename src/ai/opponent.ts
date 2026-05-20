import type { Action, GameContent, GameState, RuleEngine } from "../engine/types";
import { manhattanDistance } from "../engine/mapRules";

export function chooseAiAction(
  content: GameContent,
  engine: RuleEngine,
  state: GameState,
  actorId = state.activeActorId,
): Action | undefined {
  const actor = state.actors.find((candidate) => candidate.id === actorId);
  const legalActions = engine.getLegalActions(state, actorId);

  if (!actor || actor.side !== "enemy" || legalActions.length === 0) {
    return undefined;
  }

  if (state.phase === "move") {
    return chooseMoveAction(state, actorId, legalActions);
  }

  return chooseAttackAction(content, state, actorId, legalActions);
}

function chooseMoveAction(state: GameState, actorId: string, legalActions: Action[]): Action | undefined {
  const actor = state.actors.find((candidate) => candidate.id === actorId);

  if (!actor) {
    return undefined;
  }

  const pcTargets = state.actors.filter((candidate) => candidate.side === "pc" && candidate.status === "active");
  const moveActions = legalActions.filter((action): action is Extract<Action, { type: "move" }> => action.type === "move");
  const skip = legalActions.find((action) => action.type === "skipMove");

  if (moveActions.length === 0) {
    return skip;
  }

  if (actor.aiProfile === "gunner" || actor.aiProfile === "cloneYakuza") {
    const alreadyHasShot = pcTargets.some(
      (target) => manhattanDistance(actor.position, target.position) > 1,
    );

    if (alreadyHasShot) {
      return skip;
    }
  }

  return moveActions
    .slice()
    .sort((left, right) => nearestDistance(left.to, pcTargets) - nearestDistance(right.to, pcTargets))[0];
}

function chooseAttackAction(
  content: GameContent,
  state: GameState,
  actorId: string,
  legalActions: Action[],
): Action | undefined {
  const actor = state.actors.find((candidate) => candidate.id === actorId);
  const targets = state.actors.filter((candidate) => candidate.side === "pc" && candidate.status === "active");

  if (!actor) {
    return undefined;
  }

  const jutsuActions = legalActions.filter((action): action is Extract<Action, { type: "castJutsu" }> => action.type === "castJutsu");
  const rangedActions = legalActions.filter((action): action is Extract<Action, { type: "rangedAttack" }> => action.type === "rangedAttack");
  const meleeActions = legalActions.filter((action): action is Extract<Action, { type: "meleeAttack" }> => action.type === "meleeAttack");
  const endTurn = legalActions.find((action) => action.type === "endTurn");

  if (actor.aiProfile === "suicide" && jutsuActions.length > 0 && actor.mental > 1) {
    return sortByTargetPressure(jutsuActions, targets)[0];
  }

  if ((actor.aiProfile === "gunner" || actor.aiProfile === "cloneYakuza") && rangedActions.length > 0) {
    return sortByTargetPressure(rangedActions, targets)[0];
  }

  if (meleeActions.length > 0) {
    return sortByTargetPressure(meleeActions, targets)[0];
  }

  if (rangedActions.length > 0) {
    return sortByTargetPressure(rangedActions, targets)[0];
  }

  if (jutsuActions.length > 0 && content.scenario.id) {
    return sortByTargetPressure(jutsuActions, targets)[0];
  }

  return endTurn;
}

function nearestDistance(position: { x: number; y: number }, targets: Array<{ position: { x: number; y: number } }>): number {
  return Math.min(...targets.map((target) => manhattanDistance(position, target.position)), 999);
}

function sortByTargetPressure<TAction extends Extract<Action, { targetId: string }>>(
  actions: TAction[],
  targets: Array<{ id: string; health: number; dodgeDice: number }>,
): TAction[] {
  return actions.slice().sort((left, right) => scoreTarget(right.targetId, targets) - scoreTarget(left.targetId, targets));
}

function scoreTarget(targetId: string, targets: Array<{ id: string; health: number; dodgeDice: number }>): number {
  const target = targets.find((candidate) => candidate.id === targetId);

  if (!target) {
    return 0;
  }

  return 20 - target.health - Math.min(target.dodgeDice, 6);
}
