import { describe, expect, it } from "vitest";
import { gameContent } from "../data/content";
import { createInitialState } from "../engine/rules";
import { parseSave, pushHistory, serializeSave, undoHistory } from "./saveStore";

describe("save store", () => {
  it("serializes and parses TRPG history state", () => {
    const first = createInitialState(gameContent, 1);
    const second = createInitialState(gameContent, 2);
    const history = pushHistory({ present: first, past: [] }, second);

    const parsed = parseSave(serializeSave(history));

    expect(parsed.present.scenarioId).toBe(gameContent.scenario.id);
    expect(parsed.past).toHaveLength(1);
  });

  it("undos to the previous state", () => {
    const first = createInitialState(gameContent, 1);
    const second = createInitialState(gameContent, 2);
    const history = pushHistory({ present: first, past: [] }, second);

    const undone = undoHistory(history);

    expect(undone.present.rngState).toBe(first.rngState);
    expect(undone.past).toHaveLength(0);
  });
});
