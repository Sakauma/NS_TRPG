export type ActorSide = "pc" | "enemy";

export type ActorStatus = "active" | "unconscious" | "dead";

export type Difficulty =
  | "kids"
  | "easy"
  | "normal"
  | "hard"
  | "ultraHard"
  | "ultraHard2"
  | "ultraHard3";

export type CombatPhase = "move" | "attack" | "cleared" | "gameOver";

export type SequenceMode = "combat" | "cleared" | "gameOver";

export type Atmosphere = "normal" | "hard" | "ultraHard";

export interface Position {
  x: number;
  y: number;
}

export interface BaseStats {
  karate: number;
  neuron: number;
  wazamae: number;
  jitsu: number;
  health: number;
  mental: number;
  footwork: number;
}

export interface DerivedStats {
  attack: number;
  shooting: number;
  initiative: number;
  hacking: number;
  evasion: number;
  precision: number;
  cartwheel: number;
  casting: number;
}

export interface WeaponProfile {
  id: string;
  name: string;
  kind: "melee" | "ranged" | "jutsu";
  damage: number;
  burst?: number;
  range?: number;
  multiTarget?: boolean;
  styles?: AttackStyle[];
  notes?: string;
}

export type AttackStyle = "normal" | "power" | "precision";

export type CreationOptionType = "equipment" | "skill" | "jutsu";

export interface StatRequirements {
  karate?: number;
  neuron?: number;
  wazamae?: number;
  jitsu?: number;
}

export interface RuleEffect {
  attackBonus?: number;
  shootingBonus?: number;
  initiativeBonus?: number;
  hackingBonus?: number;
  evasionBonus?: number;
  castingBonus?: number;
  healthBonus?: number;
  mentalBonus?: number;
  footworkBonus?: number;
  continuousAttack?: number;
  dkkOnKill?: number;
  weapon?: WeaponProfile;
  tags?: string[];
}

export interface CreationOption {
  id: string;
  type: CreationOptionType;
  name: string;
  description: string;
  cost: number;
  sourcePage: string;
  requirements?: StatRequirements;
  effects: RuleEffect[];
}

export interface CharacterDraft {
  id: string;
  name: string;
  role: string;
  stats: Pick<BaseStats, "karate" | "neuron" | "wazamae" | "jitsu">;
  equipmentIds: string[];
  skillIds: string[];
  jutsuIds: string[];
}

export interface CreationValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface BuildResult {
  character?: CharacterTemplate;
  derived: DerivedStats;
  issues: CreationValidationIssue[];
  totalAbilityPoints: number;
  totalOptionCost: number;
}

export interface CreationCatalog {
  rules: {
    abilityPointBudget: number;
    optionPointBudget: number;
    minStats: Pick<BaseStats, "karate" | "neuron" | "wazamae" | "jitsu">;
    maxStats: Pick<BaseStats, "karate" | "neuron" | "wazamae" | "jitsu">;
    maxEquipment: number;
    maxSkills: number;
    maxJutsu: number;
    startingReputation: number;
    startingMoney: number;
    defaultWeapons: WeaponProfile[];
  };
  equipment: CreationOption[];
  skills: CreationOption[];
  jutsu: CreationOption[];
  presets: CharacterDraft[];
}

export interface CharacterTemplate {
  id: string;
  name: string;
  side: ActorSide;
  role: string;
  tags: string[];
  stats: BaseStats;
  derived: DerivedStats;
  dkk: number;
  reputation: number;
  money: number;
  equipment: string[];
  skills: string[];
  jutsu: string[];
  weapons: WeaponProfile[];
  optionIds?: string[];
  ruleEffects?: RuleEffect[];
  presetId?: string;
  aiProfile?: "cloneYakuza" | "gunner" | "beast" | "suicide";
  boss?: boolean;
  rulesSource?: string;
}

export interface ActorState {
  id: string;
  templateId: string;
  name: string;
  side: ActorSide;
  role: string;
  tags: string[];
  stats: BaseStats;
  derived: DerivedStats;
  weapons: WeaponProfile[];
  equipment: string[];
  skills: string[];
  jutsu: string[];
  optionIds?: string[];
  ruleEffects?: RuleEffect[];
  presetId?: string;
  aiProfile?: CharacterTemplate["aiProfile"];
  boss: boolean;
  position: Position;
  health: number;
  mental: number;
  dkk: number;
  money: number;
  reputation: number;
  dodgeDice: number;
  emergencyDodgeDice: number;
  focused: boolean;
  status: ActorStatus;
}

export interface GridMap {
  id: string;
  name: string;
  width: number;
  height: number;
  blocked: Position[];
  hazards?: Position[];
  exits: Position[];
  pcSpawns: Position[];
  notes: string[];
}

export interface EnemySpawn {
  templateId: string;
  count: number;
  positions: Position[];
}

export interface ScenarioRoom {
  id: string;
  title: string;
  mapId: string;
  sourcePage: string;
  intro: string;
  objective: string;
  ruleFocus: string[];
  enemySpawns: EnemySpawn[];
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  version: string;
  source: {
    primaryRulebook: string;
    guide: string;
    mapArchive: string;
    illustrationRoot: string;
  };
  rooms: ScenarioRoom[];
  maps: GridMap[];
}

export interface DiceRoll {
  dice: number[];
  difficulty: Difficulty;
  successes: number;
  criticalSixes: number;
}

export interface DamageEvent {
  amount: number;
  source: "melee" | "ranged" | "jutsu" | "counter" | "hazard";
  dodgeDifficulty: Difficulty;
  attackSuccesses: number;
  timeDifference: boolean;
  criticalLabel?: string;
}

export interface LogEntry {
  id: number;
  round: number;
  actorId?: string;
  message: string;
}

export interface GameState {
  scenarioId: string;
  scenarioVersion: string;
  roomId: string;
  sequence: SequenceMode;
  phase: CombatPhase;
  round: number;
  activeActorId: string;
  turnOrder: string[];
  rngState: number;
  actors: ActorState[];
  teamBank: number;
  roomIndex: number;
  atmosphere: Atmosphere;
  wasshoiWarnings: string[];
  log: LogEntry[];
  outcome?: "victory" | "defeat";
}

export type MoveAction = {
  type: "move";
  actorId: string;
  to: Position;
};

export type SkipMoveAction = {
  type: "skipMove";
  actorId: string;
};

export type FocusAction = {
  type: "focus";
  actorId: string;
};

export type MeleeAttackAction = {
  type: "meleeAttack";
  actorId: string;
  targetId: string;
  style?: AttackStyle;
};

export type RangedAttackAction = {
  type: "rangedAttack";
  actorId: string;
  targetId: string;
  weaponId?: string;
};

export type CastJutsuAction = {
  type: "castJutsu";
  actorId: string;
  targetId: string;
};

export type AdrenalineAction = {
  type: "adrenaline";
  actorId: string;
};

export type EndTurnAction = {
  type: "endTurn";
  actorId: string;
};

export type AdvanceRoomAction = {
  type: "advanceRoom";
};

export type Action =
  | MoveAction
  | SkipMoveAction
  | FocusAction
  | MeleeAttackAction
  | RangedAttackAction
  | CastJutsuAction
  | AdrenalineAction
  | EndTurnAction
  | AdvanceRoomAction;

export interface RuleEngine {
  getLegalActions(state: GameState, actorId?: string): Action[];
  applyAction(state: GameState, action: Action): GameState;
  checkVictory(state: GameState): "victory" | "defeat" | undefined;
}

export interface GameContent {
  scenario: ScenarioDefinition;
  creationCatalog: CreationCatalog;
  characters: CharacterTemplate[];
  enemies: CharacterTemplate[];
}

export interface SaveSnapshot {
  version: 1;
  savedAt: string;
  game: GameState;
  undoStack: GameState[];
}
