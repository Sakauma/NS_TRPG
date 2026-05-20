import type { DiceRoll, Difficulty } from "./types";
import { nextRng } from "./rng";

const difficultyOrder: Difficulty[] = [
  "kids",
  "easy",
  "normal",
  "hard",
  "ultraHard",
  "ultraHard2",
  "ultraHard3",
];

export function difficultyLabel(difficulty: Difficulty): string {
  return {
    kids: "KIDS",
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    ultraHard: "U-HARD",
    ultraHard2: "U-HARD2",
    ultraHard3: "U-HARD3",
  }[difficulty];
}

export function adjustDifficulty(difficulty: Difficulty, steps: number): Difficulty {
  const index = difficultyOrder.indexOf(difficulty);
  return difficultyOrder[Math.max(0, Math.min(difficultyOrder.length - 1, index + steps))];
}

export function rollD6(rngState: number): { value: number; rngState: number } {
  const [nextState, roll] = nextRng(rngState);
  return {
    value: Math.floor(roll * 6) + 1,
    rngState: nextState,
  };
}

export function rollCheck(
  diceCount: number,
  difficulty: Difficulty,
  rngState: number,
): { roll: DiceRoll; rngState: number } {
  let nextState = rngState;
  const dice: number[] = [];

  for (let index = 0; index < Math.max(0, diceCount); index += 1) {
    const result = rollD6(nextState);
    dice.push(result.value);
    nextState = result.rngState;
  }

  const criticalSixes = dice.filter((value) => value === 6).length;

  return {
    rngState: nextState,
    roll: {
      dice,
      difficulty,
      successes: countSuccesses(dice, difficulty),
      criticalSixes,
    },
  };
}

export function countSuccesses(dice: number[], difficulty: Difficulty): number {
  if (difficulty === "ultraHard2") {
    const sixes = dice.filter((value) => value === 6).length;
    return sixes >= 2 ? sixes - 1 : 0;
  }

  if (difficulty === "ultraHard3") {
    const sixes = dice.filter((value) => value === 6).length;
    return sixes >= 3 ? sixes - 2 : 0;
  }

  const target = {
    kids: 2,
    easy: 3,
    normal: 4,
    hard: 5,
    ultraHard: 6,
  }[difficulty];

  return dice.filter((value) => value >= target).length;
}

export function isSuccessful(roll: DiceRoll): boolean {
  return roll.successes > 0;
}

export function formatRoll(roll: DiceRoll): string {
  return `${difficultyLabel(roll.difficulty)} [${roll.dice.join(", ")}] = ${roll.successes} 成功`;
}
