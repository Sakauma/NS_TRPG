import type { GameState, SaveSnapshot } from "../engine/types";

const SAVE_KEY = "solo-tabletop-save";
const SAVE_VERSION = 1;
const MAX_UNDO_STATES = 50;

export interface HistoryState {
  present: GameState;
  past: GameState[];
}

export function pushHistory(history: HistoryState, nextState: GameState): HistoryState {
  return {
    present: nextState,
    past: [...history.past, history.present].slice(-MAX_UNDO_STATES),
  };
}

export function undoHistory(history: HistoryState): HistoryState {
  const previous = history.past.at(-1);

  if (!previous) {
    return history;
  }

  return {
    present: previous,
    past: history.past.slice(0, -1),
  };
}

export function createSaveSnapshot(history: HistoryState): SaveSnapshot {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    game: history.present,
    undoStack: history.past,
  };
}

export function serializeSave(history: HistoryState): string {
  return JSON.stringify(createSaveSnapshot(history));
}

export function parseSave(serialized: string): HistoryState {
  const parsed = JSON.parse(serialized) as SaveSnapshot;

  if (parsed.version !== SAVE_VERSION || !parsed.game || !Array.isArray(parsed.undoStack)) {
    throw new Error("Unsupported save file.");
  }

  return {
    present: parsed.game,
    past: parsed.undoStack,
  };
}

export function saveToStorage(history: HistoryState) {
  window.localStorage.setItem(SAVE_KEY, serializeSave(history));
}

export function loadFromStorage(): HistoryState | undefined {
  const serialized = window.localStorage.getItem(SAVE_KEY);

  if (!serialized) {
    return undefined;
  }

  return parseSave(serialized);
}
