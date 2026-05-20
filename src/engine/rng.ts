export function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

export function createSeedFromDate(): number {
  return normalizeSeed(Date.now());
}

export function nextRng(state: number): [number, number] {
  const next = normalizeSeed(state * 1664525 + 1013904223);
  return [next, next / 0x100000000];
}

export function shuffleWithSeed<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const shuffled = [...items];
  let rngState = normalizeSeed(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const [nextSeed, roll] = nextRng(rngState);
    rngState = nextSeed;
    const swapIndex = Math.floor(roll * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return { items: shuffled, seed: rngState };
}
