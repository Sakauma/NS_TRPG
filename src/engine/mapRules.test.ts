import { describe, expect, it } from "vitest";
import { gameContent } from "../data/content";
import { hasLineOfSight, reachableCells } from "./mapRules";
import { createInitialState } from "./rules";
import { requireMap, requireRoom } from "./scenarioRules";

describe("map rules", () => {
  it("finds reachable non-diagonal movement cells", () => {
    const state = createInitialState(gameContent, 1);
    const room = requireRoom(gameContent, state.roomId);
    const map = requireMap(gameContent, room.mapId);
    const actor = state.actors.find((candidate) => candidate.side === "pc")!;

    const reachable = reachableCells(map, state.actors, actor);

    expect(reachable).toContainEqual({ x: 1, y: 2 });
    expect(reachable).not.toContainEqual({ x: 2, y: 2 });
  });

  it("blocks line of sight through obstacle cells", () => {
    const map = requireMap(gameContent, "training-room-3");

    expect(hasLineOfSight(map, { x: 2, y: 3 }, { x: 8, y: 3 })).toBe(false);
    expect(hasLineOfSight(map, { x: 2, y: 0 }, { x: 8, y: 0 })).toBe(true);
  });
});
