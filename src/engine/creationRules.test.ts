import { describe, expect, it } from "vitest";
import { starterCreationCatalog } from "../data/creationCatalog";
import { buildCharacter, deriveCharacterStats, validateCharacterDraft } from "./creationRules";

describe("starter character creation", () => {
  it("builds legal starter preset characters", () => {
    const built = starterCreationCatalog.presets.map((draft) => buildCharacter(draft, starterCreationCatalog));

    expect(built.every((result) => result.character)).toBe(true);
    expect(built[0].character?.name).toBe("火焰吞食者");
    expect(built[0].character?.derived.attack).toBe(6);
    expect(built[2].character?.derived.shooting).toBe(7);
    expect(built[3].character?.derived.initiative).toBe(7);
  });

  it("rejects ability point overspend", () => {
    const issues = validateCharacterDraft(
      {
        ...starterCreationCatalog.presets[0],
        stats: { karate: 6, neuron: 6, wazamae: 6, jitsu: 2 },
      },
      starterCreationCatalog,
    );

    expect(issues.some((issue) => issue.severity === "error" && issue.field === "stats")).toBe(true);
  });

  it("rejects unmet option requirements", () => {
    const issues = validateCharacterDraft(
      {
        ...starterCreationCatalog.presets[1],
        equipmentIds: ["virus-disk"],
        stats: { karate: 3, neuron: 2, wazamae: 3, jitsu: 0 },
      },
      starterCreationCatalog,
    );

    expect(issues.some((issue) => issue.message.includes("病毒软盘"))).toBe(true);
  });

  it("derives combat pools from base stats and effects", () => {
    const derived = deriveCharacterStats(
      { karate: 4, neuron: 5, wazamae: 3, jitsu: 1 },
      [{ attackBonus: 1 }, { initiativeBonus: 1, castingBonus: 1 }],
    );

    expect(derived.attack).toBe(5);
    expect(derived.initiative).toBe(6);
    expect(derived.casting).toBe(7);
    expect(derived.evasion).toBe(7);
  });
});
