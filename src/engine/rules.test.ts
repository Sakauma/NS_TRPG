import { describe, expect, it } from "vitest";
import { gameContent } from "../data/content";
import type { Action, GameState } from "./types";
import { createInitialState, createRuleEngine } from "./rules";

describe("TRPG rule engine", () => {
  const engine = createRuleEngine(gameContent);

  it("creates a tutorial room with four player characters and tutorial enemies", () => {
    const state = createInitialState(gameContent, 42);

    expect(state.roomId).toBe("room-1");
    expect(state.phase).toBe("move");
    expect(state.actors.filter((actor) => actor.side === "pc")).toHaveLength(4);
    expect(state.actors.filter((actor) => actor.side === "enemy")).toHaveLength(4);
    expect(state.turnOrder[0]).toBe("pc-byte-ronin");
  });

  it("offers movement actions to the active actor", () => {
    const state = createInitialState(gameContent, 42);
    const actions = engine.getLegalActions(state);

    expect(actions.some((action) => action.type === "move")).toBe(true);
    expect(actions).toContainEqual({ type: "focus", actorId: state.activeActorId });
  });

  it("moves then allows attacks or end turn", () => {
    const state = createInitialState(gameContent, 42);
    const move = engine.getLegalActions(state).find((action): action is Extract<Action, { type: "move" }> => action.type === "move")!;

    const moved = engine.applyAction(state, move);

    expect(moved.phase).toBe("attack");
    expect(engine.getLegalActions(moved).some((action) => action.type === "endTurn")).toBe(true);
  });

  it("offers katana attack styles when a melee target is adjacent", () => {
    const state = createInitialState(gameContent, 42);
    const styledState: GameState = {
      ...state,
      activeActorId: "pc-fire-eater",
      phase: "attack",
      actors: state.actors.map((actor) => {
        if (actor.id === "pc-fire-eater") {
          return { ...actor, position: { x: 6, y: 1 } };
        }

        if (actor.id === "enemy-room-1-clone-yakuza-1") {
          return { ...actor, position: { x: 7, y: 1 } };
        }

        return actor;
      }),
    };
    const actions = engine.getLegalActions(styledState);

    expect(actions).toContainEqual({
      type: "meleeAttack",
      actorId: "pc-fire-eater",
      targetId: "enemy-room-1-clone-yakuza-1",
      style: "power",
    });
    expect(actions).toContainEqual({
      type: "meleeAttack",
      actorId: "pc-fire-eater",
      targetId: "enemy-room-1-clone-yakuza-1",
      style: "precision",
    });
  });

  it("applies hazard damage when moving through dangerous terrain", () => {
    const state = createInitialState(gameContent, 42);
    const hazardState: GameState = {
      ...state,
      roomId: "room-4",
      roomIndex: 3,
      activeActorId: "pc-byte-ronin",
      actors: state.actors.map((actor) =>
        actor.id === "pc-byte-ronin" ? { ...actor, position: { x: 3, y: 3 }, health: 2 } : actor,
      ),
    };
    const move = engine
      .getLegalActions(hazardState)
      .find((action): action is Extract<Action, { type: "move" }> => action.type === "move" && action.to.x === 4 && action.to.y === 3)!;

    const moved = engine.applyAction(hazardState, move);
    const actor = moved.actors.find((candidate) => candidate.id === "pc-byte-ronin")!;

    expect(actor.health).toBe(1);
    expect(moved.log.some((entry) => entry.message.includes("危险地形"))).toBe(true);
  });

  it("records DKK and Wasshoi warnings for player kills", () => {
    const state = createInitialState(gameContent, 1);
    const killState: GameState = {
      ...state,
      activeActorId: "pc-chrome-viper",
      phase: "attack",
      rngState: 1,
      actors: state.actors.map((actor) => {
        if (actor.id === "pc-chrome-viper") {
          return { ...actor, dkk: 2, position: { x: 6, y: 1 }, derived: { ...actor.derived, attack: 20 } };
        }

        if (actor.id === "enemy-room-1-clone-yakuza-1") {
          return { ...actor, position: { x: 7, y: 1 }, health: 1 };
        }

        return actor;
      }),
    };
    const attack = engine
      .getLegalActions(killState)
      .find(
        (action): action is Extract<Action, { type: "meleeAttack" }> =>
          action.type === "meleeAttack" && action.targetId === "enemy-room-1-clone-yakuza-1",
      )!;

    const attacked = engine.applyAction(killState, attack);
    const actor = attacked.actors.find((candidate) => candidate.id === "pc-chrome-viper")!;

    expect(actor.dkk).toBeGreaterThanOrEqual(3);
    expect(attacked.wasshoiWarnings.some((warning) => warning.includes("pc-chrome-viper"))).toBe(true);
  });

  it("rejects illegal actions", () => {
    const state = createInitialState(gameContent, 42);

    expect(() => engine.applyAction(state, { type: "endTurn", actorId: state.activeActorId })).toThrow(
      "Illegal action",
    );
  });

  it("clears the room when no active enemies remain", () => {
    const state = createInitialState(gameContent, 42);
    const cleared: GameState = {
      ...state,
      actors: state.actors.map((actor) =>
        actor.side === "enemy" ? { ...actor, status: "dead" as const, health: -1 } : actor,
      ),
    };

    const ended = engine.applyAction({ ...cleared, phase: "attack" }, { type: "endTurn", actorId: cleared.activeActorId });

    expect(ended.sequence).toBe("cleared");
  });
});
