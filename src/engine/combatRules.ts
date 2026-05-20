import type {
  ActorState,
  AttackStyle,
  DamageEvent,
  Difficulty,
  GameContent,
  GameState,
  WeaponProfile,
} from "./types";
import { adjustDifficulty, difficultyLabel, formatRoll, rollCheck } from "./diceRules";
import { activeEnemies, activePcs, buildTurnOrder, pushLog, resetRoundDodge } from "./scenarioRules";

export function resolveAttack(
  content: GameContent,
  state: GameState,
  attacker: ActorState,
  defender: ActorState,
  weapon: WeaponProfile,
  style: AttackStyle = "normal",
): GameState {
  const nextState = structuredClone(state);
  const nextAttacker = requireActor(nextState, attacker.id);
  const nextDefender = requireActor(nextState, defender.id);
  const diceCount = getAttackDice(nextAttacker, weapon);
  const baseDifficulty = nextAttacker.focused ? "easy" : "normal";
  const attackDifficulty = applyAttackStyleDifficulty(baseDifficulty, style);
  const events = createDamageEvents(nextState, nextAttacker, nextDefender, weapon, diceCount, attackDifficulty, style);

  nextAttacker.focused = false;

  if (events.length === 0) {
    pushLog(nextState, nextAttacker.id, `${nextAttacker.name} 的 ${describeWeaponUse(weapon, style)} 未命中。`);
    return finishAttack(content, nextState);
  }

  for (const event of events) {
    resolveDamageEvent(nextState, nextAttacker, nextDefender, event);
  }

  return finishAttack(content, nextState);
}

export function resolveJutsu(
  content: GameContent,
  state: GameState,
  attacker: ActorState,
  defender: ActorState,
): GameState {
  const nextState = structuredClone(state);
  const nextAttacker = requireActor(nextState, attacker.id);
  const nextDefender = requireActor(nextState, defender.id);

  if (nextAttacker.mental <= 0) {
    pushLog(nextState, nextAttacker.id, `${nextAttacker.name} 精神力不足，忍术失败。`);
    return finishAttack(content, nextState);
  }

  nextAttacker.mental -= 1;
  const result = rollCheck(nextAttacker.derived.casting, "normal", nextState.rngState);
  nextState.rngState = result.rngState;
  pushLog(nextState, nextAttacker.id, `${nextAttacker.name} 发动忍术：${formatRoll(result.roll)}。`);

  if (result.roll.successes === 0) {
    return finishAttack(content, nextState);
  }

  const event: DamageEvent = {
    amount: 1,
    source: "jutsu",
    dodgeDifficulty: nextAttacker.aiProfile === "suicide" ? "ultraHard" : "hard",
    attackSuccesses: result.roll.successes,
    timeDifference: false,
  };
  resolveDamageEvent(nextState, nextAttacker, nextDefender, event);

  if (nextAttacker.aiProfile === "suicide" && nextAttacker.status === "active") {
    nextAttacker.health = Math.min(nextAttacker.stats.health, nextAttacker.health + 1);
    pushLog(nextState, nextAttacker.id, `${nextAttacker.name} 吸收生命力并恢复 1 点体力。`);
  }

  return finishAttack(content, nextState);
}

export function advanceTurn(content: GameContent, state: GameState): GameState {
  const checked = checkRoomOutcome(content, structuredClone(state));

  if (checked.sequence !== "combat") {
    return checked;
  }

  const activeIndex = checked.turnOrder.indexOf(checked.activeActorId);
  let nextOrder = checked.turnOrder;
  let nextIndex = activeIndex + 1;
  let nextRound = checked.round;
  let actors = checked.actors;

  if (nextIndex >= nextOrder.length) {
    nextRound += 1;
    actors = resetRoundDodge(actors);
    nextOrder = buildTurnOrder(actors);
    nextIndex = 0;
  }

  let nextActorId = nextOrder[nextIndex] ?? "";
  let guard = 0;

  while (nextActorId && requireActor({ ...checked, actors }, nextActorId).status !== "active" && guard < 30) {
    nextIndex += 1;
    guard += 1;

    if (nextIndex >= nextOrder.length) {
      nextRound += 1;
      actors = resetRoundDodge(actors);
      nextOrder = buildTurnOrder(actors);
      nextIndex = 0;
    }

    nextActorId = nextOrder[nextIndex] ?? "";
  }

  const nextState: GameState = {
    ...checked,
    actors,
    round: nextRound,
    turnOrder: nextOrder,
    activeActorId: nextActorId,
    phase: "move",
    atmosphere: getAtmosphere(nextRound),
  };
  const actor = nextActorId ? requireActor(nextState, nextActorId) : undefined;

  if (actor) {
    actor.focused = false;
    pushLog(nextState, actor.id, `轮到 ${actor.name} 行动。`);
  }

  return checkRoomOutcome(content, nextState);
}

export function checkRoomOutcome(content: GameContent, state: GameState): GameState {
  if (activePcs(state).length === 0) {
    state.sequence = "gameOver";
    state.phase = "gameOver";
    state.outcome = "defeat";
    pushLog(state, undefined, "小队无人还能行动，训练失败。");
    return state;
  }

  if (activeEnemies(state).length === 0) {
    state.sequence = "cleared";
    state.phase = "cleared";
    state.teamBank += collectRoomMoney(state);
    const isLastRoom = state.roomIndex >= content.scenario.rooms.length - 1;
    pushLog(state, undefined, isLastRoom ? "最后的敌人倒下了。" : "房间清理完毕，可以前进。");
  }

  return state;
}

export function requireActor(state: GameState, actorId: string): ActorState {
  const actor = state.actors.find((candidate) => candidate.id === actorId);

  if (!actor) {
    throw new Error(`Unknown actor: ${actorId}`);
  }

  return actor;
}

export function getAtmosphere(round: number) {
  if (round >= 7) {
    return "ultraHard" as const;
  }

  if (round >= 4) {
    return "hard" as const;
  }

  return "normal" as const;
}

export function getBestMeleeWeapon(actor: ActorState): WeaponProfile {
  return (
    actor.weapons
      .filter((weapon) => weapon.kind === "melee")
      .sort((left, right) => {
        const damageDelta = right.damage - left.damage;

        if (damageDelta !== 0) {
          return damageDelta;
        }

        return (right.styles?.length ?? 0) - (left.styles?.length ?? 0);
      })[0] ?? actor.weapons[0]
  );
}

export function getBestRangedWeapon(actor: ActorState): WeaponProfile | undefined {
  return actor.weapons.find((weapon) => weapon.kind === "ranged");
}

function createDamageEvents(
  state: GameState,
  attacker: ActorState,
  defender: ActorState,
  weapon: WeaponProfile,
  diceCount: number,
  difficulty: Difficulty,
  style: AttackStyle,
): DamageEvent[] {
  if (weapon.kind === "ranged" && (weapon.burst ?? 1) > 1) {
    return createBurstDamageEvent(state, attacker, weapon, diceCount, difficulty);
  }

  const continuousAttacks =
    weapon.kind === "melee" ? getContinuousAttackCount(attacker) : 1;
  const splitDice = splitDiceCount(diceCount, continuousAttacks);

  return splitDice.flatMap((count) => {
    const result = rollCheck(count, difficulty, state.rngState);
    state.rngState = result.rngState;
    pushLog(
      state,
      attacker.id,
      `${attacker.name} 使用 ${describeWeaponUse(weapon, style)}：${formatRoll(result.roll)}（骰池 ${count}）。`,
    );

    if (result.roll.successes === 0) {
      return [];
    }

    const isNamu = result.roll.criticalSixes >= 3 && weapon.kind === "melee";
    const isSatsubatsu = result.roll.criticalSixes >= 2 && weapon.kind === "melee";

    return [
      {
        amount: weapon.damage + (style === "power" ? 1 : 0) + (isSatsubatsu ? 1 : 0) + getTargetDamageBonus(attacker, defender),
        source: weapon.kind,
        dodgeDifficulty: isNamu ? "hard" : "normal",
        attackSuccesses: result.roll.successes,
        timeDifference: continuousAttacks > 1,
        criticalLabel: isNamu ? "南无阿弥陀佛" : isSatsubatsu ? "杀伐" : undefined,
      } satisfies DamageEvent,
    ];
  });
}

function createBurstDamageEvent(
  state: GameState,
  attacker: ActorState,
  weapon: WeaponProfile,
  diceCount: number,
  difficulty: Difficulty,
): DamageEvent[] {
  const burst = weapon.burst ?? 1;
  const splitDice = splitDiceCount(diceCount, burst);
  let hits = 0;
  let bestSuccesses = 0;

  for (const count of splitDice) {
    const result = rollCheck(count, difficulty, state.rngState);
    state.rngState = result.rngState;
    pushLog(state, attacker.id, `${attacker.name} 连射 ${weapon.name}：${formatRoll(result.roll)}（骰池 ${count}）。`);

    if (result.roll.successes > 0) {
      hits += 1;
      bestSuccesses = Math.max(bestSuccesses, result.roll.successes);
    }
  }

  return hits > 0
    ? [
        {
          amount: hits * weapon.damage,
          source: "ranged",
          dodgeDifficulty: "normal",
          attackSuccesses: bestSuccesses,
          timeDifference: false,
        },
      ]
    : [];
}

function resolveDamageEvent(
  state: GameState,
  attacker: ActorState,
  defender: ActorState,
  event: DamageEvent,
) {
  const dodgeDifficulty = applyAtmosphereToDodge(state, event);
  const diceToSpend = chooseDodgeDice(defender, event);

  if (diceToSpend > 0) {
    defender.dodgeDice -= diceToSpend;
    const result = rollCheck(diceToSpend, dodgeDifficulty, state.rngState);
    state.rngState = result.rngState;
    pushLog(
      state,
      defender.id,
      `${defender.name} 闪避 ${difficultyLabel(dodgeDifficulty)}：${result.roll.dice.join(", ")}。`,
    );

    if (result.roll.successes > 0) {
      pushLog(state, defender.id, `${defender.name} 闪过了 ${event.amount} 点伤害。`);

      if (event.source === "melee" && result.roll.successes > event.attackSuccesses) {
        pushLog(state, defender.id, `${defender.name} 触发反击空手道。`);
        applyDamage(state, attacker, 1);
      }

      return;
    }
  }

  applyDamage(state, defender, event.amount, attacker);

  if (event.criticalLabel) {
    pushLog(state, attacker.id, `${event.criticalLabel}！追加痛打已经结算。`);
  }
}

function applyDamage(state: GameState, actor: ActorState, amount: number, attacker?: ActorState) {
  const previousStatus = actor.status;

  if (actor.status !== "active") {
    return;
  }

  actor.health -= amount;
  pushLog(state, actor.id, `${actor.name} 受到 ${amount} 点伤害，体力 ${actor.health}/${actor.stats.health}。`);

  if (actor.health < 0) {
    actor.status = "dead";
    pushLog(state, actor.id, `${actor.name} 爆发四散。`);
    recordKill(state, attacker, actor, previousStatus);
    return;
  }

  if (actor.health === 0) {
    actor.status = actor.side === "pc" || actor.boss ? "unconscious" : "dead";
    pushLog(state, actor.id, actor.status === "unconscious" ? `${actor.name} 陷入气绝。` : `${actor.name} 被击倒。`);
    recordKill(state, attacker, actor, previousStatus);
  }
}

function finishAttack(content: GameContent, state: GameState): GameState {
  const checked = checkRoomOutcome(content, state);

  if (checked.sequence !== "combat") {
    return checked;
  }

  checked.phase = "attack";
  return checked;
}

function getAttackDice(actor: ActorState, weapon: WeaponProfile): number {
  if (weapon.kind === "melee") {
    return actor.derived.attack;
  }

  if (weapon.kind === "ranged") {
    return actor.derived.shooting;
  }

  return actor.derived.casting;
}

function splitDiceCount(diceCount: number, parts: number): number[] {
  const safeParts = Math.max(1, parts);
  const base = Math.floor(diceCount / safeParts);
  const remainder = diceCount % safeParts;
  return Array.from({ length: safeParts }, (_, index) => base + (index < remainder ? 1 : 0)).filter(
    (count) => count > 0,
  );
}

function chooseDodgeDice(defender: ActorState, event: DamageEvent): number {
  if (defender.dodgeDice <= 0 || (defender.side === "enemy" && !defender.boss)) {
    return 0;
  }

  if (event.amount >= defender.health) {
    return defender.dodgeDice;
  }

  if (event.dodgeDifficulty === "hard" || event.dodgeDifficulty === "ultraHard") {
    return Math.min(defender.dodgeDice, 4);
  }

  return Math.min(defender.dodgeDice, 3);
}

function applyAttackStyleDifficulty(difficulty: Difficulty, style: AttackStyle): Difficulty {
  if (style === "power") {
    return adjustDifficulty(difficulty, 1);
  }

  if (style === "precision") {
    return adjustDifficulty(difficulty, -1);
  }

  return difficulty;
}

function describeWeaponUse(weapon: WeaponProfile, style: AttackStyle): string {
  return {
    normal: weapon.name,
    power: `${weapon.name} 强攻击`,
    precision: `${weapon.name} 精密攻击`,
  }[style];
}

function getContinuousAttackCount(actor: ActorState): number {
  const effectValue = Math.max(1, ...((actor.ruleEffects ?? []).map((effect) => effect.continuousAttack ?? 1)));

  if (effectValue > 1) {
    return effectValue;
  }

  return actor.skills.some((skill) => skill.includes("连续攻击 2")) ? 2 : 1;
}

function getTargetDamageBonus(attacker: ActorState, defender: ActorState): number {
  if (defender.tags.includes("dangerous-beast") && attacker.tags.includes("beast-hunter")) {
    return 1;
  }

  return 0;
}

function recordKill(state: GameState, attacker: ActorState | undefined, defender: ActorState, previousStatus: ActorState["status"]) {
  if (!attacker || previousStatus !== "active" || attacker.side !== "pc" || defender.side !== "enemy") {
    return;
  }

  const dkkGain = defender.tags.includes("mortal")
    ? Math.max(1, ...((attacker.ruleEffects ?? []).map((effect) => effect.dkkOnKill ?? 1)))
    : 0;

  if (dkkGain <= 0) {
    return;
  }

  attacker.dkk += dkkGain;
  pushLog(state, attacker.id, `${attacker.name} 的杀戮值 +${dkkGain}，当前 ${attacker.dkk}。`);

  for (const threshold of [3, 6]) {
    const warningId = `${attacker.id}-dkk-${threshold}`;

    if (attacker.dkk >= threshold && !state.wasshoiWarnings.includes(warningId)) {
      state.wasshoiWarnings.push(warningId);
      pushLog(state, attacker.id, `Wasshoi 警告：${attacker.name} 的杀戮气味已经刺鼻。`);
    }
  }
}

function applyAtmosphereToDodge(state: GameState, event: DamageEvent): Difficulty {
  if (state.atmosphere === "normal") {
    return event.dodgeDifficulty;
  }

  if (event.source === "melee" || event.source === "counter") {
    return adjustDifficulty(event.dodgeDifficulty, state.atmosphere === "hard" ? 1 : 2);
  }

  if (state.atmosphere === "ultraHard" && (event.source === "jutsu" || event.source === "ranged")) {
    return adjustDifficulty(event.dodgeDifficulty, event.source === "ranged" ? 0 : 1);
  }

  return event.dodgeDifficulty;
}

function collectRoomMoney(state: GameState): number {
  return state.actors
    .filter((actor) => actor.side === "enemy" && actor.status !== "active")
    .reduce((total, actor) => total + actor.money, 0);
}
