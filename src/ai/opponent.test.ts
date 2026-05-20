import { describe, expect, it } from "vitest";
import { gameContent } from "../data/content";
import { createInitialState, createRuleEngine } from "../engine/rules";
import { chooseAiAction } from "./opponent";

describe("enemy AI", () => {
  const engine = createRuleEngine(gameContent);

  it("does nothing for active player turns", () => {
    const state = createInitialState(gameContent, 7);

    expect(chooseAiAction(gameContent, engine, state)).toBeUndefined();
  });

  it("chooses only legal enemy actions", () => {
    let state = createInitialState(gameContent, 7);

    for (let guard = 0; guard < 20; guard += 1) {
      if (state.actors.find((actor) => actor.id === state.activeActorId)?.side === "enemy") {
        break;
      }

      state = finishPcTurn(state);
    }

    const action = chooseAiAction(gameContent, engine, state);

    expect(action).toBeDefined();
    expect(engine.getLegalActions(state)).toContainEqual(action);
  });

  it("can run enemy turns without illegal actions", () => {
    let state = createInitialState(gameContent, 99);

    for (let step = 0; step < 80 && state.sequence === "combat"; step += 1) {
      const active = state.actors.find((actor) => actor.id === state.activeActorId);

      if (active?.side === "enemy") {
        const action = chooseAiAction(gameContent, engine, state);
        expect(action).toBeDefined();
        expect(engine.getLegalActions(state)).toContainEqual(action);
        state = engine.applyAction(state, action!);
      } else {
        state = finishPcTurn(state);
      }
    }

    expect(state.log.length).toBeGreaterThan(5);
  });

  function finishPcTurn(state: ReturnType<typeof createInitialState>) {
    let next = state;
    const movePhaseAction =
      engine.getLegalActions(next).find((candidate) => candidate.type === "focus") ??
      engine.getLegalActions(next).find((candidate) => candidate.type === "skipMove");

    if (movePhaseAction) {
      next = engine.applyAction(next, movePhaseAction);
    }

    const endTurn = engine.getLegalActions(next).find((candidate) => candidate.type === "endTurn");
    return endTurn ? engine.applyAction(next, endTurn) : next;
  }
});
