import type {
  ActorState,
  CharacterTemplate,
  GameContent,
  GameState,
  GridMap,
  ScenarioRoom,
} from "./types";
import { normalizeSeed } from "./rng";

export function createInitialState(
  content: GameContent,
  seed: number,
  selectedPcs: Array<string | CharacterTemplate> = content.characters.slice(0, 4),
): GameState {
  const roomIndex = 0;
  const room = content.scenario.rooms[roomIndex];
  const map = requireMap(content, room.mapId);
  const pcs = selectedPcs.map((selected, index) => {
    const template = typeof selected === "string" ? requireTemplate(content.characters, selected) : selected;
    return createActor(template, `pc-${template.id}`, map.pcSpawns[index] ?? map.pcSpawns[0]);
  });
  const actors = [...pcs, ...createRoomEnemies(content, room)];
  const turnOrder = buildTurnOrder(actors);
  const firstActorId = turnOrder[0] ?? "";
  const state: GameState = {
    scenarioId: content.scenario.id,
    scenarioVersion: content.scenario.version,
    roomId: room.id,
    sequence: "combat",
    phase: "move",
    round: 1,
    activeActorId: firstActorId,
    turnOrder,
    rngState: normalizeSeed(seed),
    actors: resetRoundDodge(actors),
    teamBank: 0,
    roomIndex,
    atmosphere: "normal",
    wasshoiWarnings: [],
    log: [],
  };

  pushLog(state, undefined, `教学剧本开始：${room.title}`);
  pushLog(state, undefined, room.objective);
  return state;
}

export function enterNextRoom(content: GameContent, state: GameState): GameState {
  const nextRoomIndex = state.roomIndex + 1;

  if (nextRoomIndex >= content.scenario.rooms.length) {
    const victoryState = structuredClone(state);
    victoryState.sequence = "gameOver";
    victoryState.phase = "gameOver";
    victoryState.outcome = "victory";
    pushLog(victoryState, undefined, "训练流程完成。辛苦了，奥茨卡勒萨马多斯诶！");
    return victoryState;
  }

  const room = content.scenario.rooms[nextRoomIndex];
  const map = requireMap(content, room.mapId);
  const pcs = livingPcs(state).map((actor, index) => ({
    ...actor,
    position: map.pcSpawns[index] ?? map.pcSpawns[0],
    health: actor.status === "unconscious" ? 1 : Math.max(1, actor.health),
    status: "active" as const,
    focused: false,
  }));
  const actors = [...pcs, ...createRoomEnemies(content, room)];
  const turnOrder = buildTurnOrder(actors);
  const nextState: GameState = {
    ...structuredClone(state),
    roomId: room.id,
    sequence: "combat",
    phase: "move",
    round: 1,
    activeActorId: turnOrder[0] ?? "",
    turnOrder,
    actors: resetRoundDodge(actors),
    roomIndex: nextRoomIndex,
    atmosphere: "normal",
  };

  pushLog(nextState, undefined, `进入 ${room.title}`);
  pushLog(nextState, undefined, room.objective);
  return nextState;
}

export function createActor(
  template: CharacterTemplate,
  id: string,
  position: { x: number; y: number },
): ActorState {
  return {
    id,
    templateId: template.id,
    name: template.name,
    side: template.side,
    role: template.role,
    tags: template.tags,
    stats: template.stats,
    derived: template.derived,
    weapons: template.weapons,
    equipment: template.equipment,
    skills: template.skills,
    jutsu: template.jutsu,
    optionIds: template.optionIds,
    ruleEffects: template.ruleEffects,
    presetId: template.presetId,
    aiProfile: template.aiProfile,
    boss: template.boss ?? false,
    position,
    health: template.stats.health,
    mental: template.stats.mental,
    dkk: template.dkk,
    money: template.money,
    reputation: template.reputation,
    dodgeDice: 0,
    emergencyDodgeDice: 0,
    focused: false,
    status: "active",
  };
}

export function createRoomEnemies(content: GameContent, room: ScenarioRoom): ActorState[] {
  return room.enemySpawns.flatMap((spawn) => {
    const template = requireTemplate(content.enemies, spawn.templateId);
    return Array.from({ length: spawn.count }, (_, index) =>
      createActor(
        template,
        `enemy-${room.id}-${spawn.templateId}-${index + 1}`,
        spawn.positions[index] ?? spawn.positions[0],
      ),
    );
  });
}

export function buildTurnOrder(actors: ActorState[]): string[] {
  return actors
    .filter((actor) => actor.status === "active")
    .slice()
    .sort((left, right) => {
      const initiativeDelta = right.derived.initiative - left.derived.initiative;

      if (initiativeDelta !== 0) {
        return initiativeDelta;
      }

      if (left.side !== right.side) {
        return left.side === "pc" ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    })
    .map((actor) => actor.id);
}

export function resetRoundDodge(actors: ActorState[]): ActorState[] {
  return actors.map((actor) => ({
    ...actor,
    dodgeDice: actor.side === "pc" || actor.boss ? actor.derived.evasion : 0,
    focused: false,
  }));
}

export function livingPcs(state: GameState): ActorState[] {
  return state.actors.filter((actor) => actor.side === "pc" && actor.status !== "dead");
}

export function activePcs(state: GameState): ActorState[] {
  return state.actors.filter((actor) => actor.side === "pc" && actor.status === "active");
}

export function activeEnemies(state: GameState): ActorState[] {
  return state.actors.filter((actor) => actor.side === "enemy" && actor.status === "active");
}

export function requireRoom(content: GameContent, roomId: string): ScenarioRoom {
  const room = content.scenario.rooms.find((candidate) => candidate.id === roomId);

  if (!room) {
    throw new Error(`Unknown room: ${roomId}`);
  }

  return room;
}

export function requireMap(content: GameContent, mapId: string): GridMap {
  const map = content.scenario.maps.find((candidate) => candidate.id === mapId);

  if (!map) {
    throw new Error(`Unknown map: ${mapId}`);
  }

  return map;
}

export function requireTemplate(templates: CharacterTemplate[], id: string): CharacterTemplate {
  const template = templates.find((candidate) => candidate.id === id);

  if (!template) {
    throw new Error(`Unknown character template: ${id}`);
  }

  return template;
}

export function pushLog(state: GameState, actorId: string | undefined, message: string) {
  state.log.push({
    id: state.log.length + 1,
    round: state.round,
    actorId,
    message,
  });
}
