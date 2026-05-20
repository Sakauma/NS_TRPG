import { describe, expect, it } from "vitest";
import { countSuccesses, rollCheck } from "./diceRules";

describe("dice rules", () => {
  it("counts normal successes by target number", () => {
    expect(countSuccesses([1, 3, 4, 6], "normal")).toBe(2);
    expect(countSuccesses([1, 4, 4, 6], "hard")).toBe(1);
  });

  it("counts ultra-hard grouped sixes", () => {
    expect(countSuccesses([6, 6, 2, 1], "ultraHard2")).toBe(1);
    expect(countSuccesses([6, 6, 6, 6], "ultraHard3")).toBe(2);
  });

  it("rolls deterministic checks from a seed", () => {
    const first = rollCheck(4, "normal", 123);
    const second = rollCheck(4, "normal", 123);

    expect(first.roll).toEqual(second.roll);
    expect(first.rngState).toBe(second.rngState);
  });
});
