import enemies from "./enemies.json";
import maps from "./maps.json";
import scenario from "./starterScenario.json";
import { starterCreationCatalog } from "./creationCatalog";
import { buildCharacter } from "../engine/creationRules";
import type { CharacterTemplate, GameContent, GridMap, ScenarioDefinition } from "../engine/types";

const presetCharacters = starterCreationCatalog.presets
  .map((draft) => buildCharacter(draft, starterCreationCatalog).character)
  .filter((character): character is CharacterTemplate => Boolean(character));

export const gameContent: GameContent = {
  scenario: {
    ...(scenario as Omit<ScenarioDefinition, "maps">),
    maps: maps as GridMap[],
  },
  creationCatalog: starterCreationCatalog,
  characters: presetCharacters,
  enemies: enemies as CharacterTemplate[],
};
