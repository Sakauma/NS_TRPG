import { useEffect, useMemo, useState } from "react";
import { Bot, FolderOpen, RotateCcw, Save, Shuffle, StepForward } from "lucide-react";
import { chooseAiAction } from "./ai/opponent";
import { gameContent } from "./data/content";
import type { Action, CharacterTemplate } from "./engine/types";
import { createInitialState, createRuleEngine } from "./engine/rules";
import { createSeedFromDate } from "./engine/rng";
import { Board } from "./ui/Board";
import { ActionPanel, ScenarioPanel } from "./ui/ActionPanel";
import { CharacterBuilder } from "./ui/CharacterBuilder";
import { LogPanel } from "./ui/LogPanel";
import { PlayerPanel } from "./ui/PlayerPanel";
import {
  type HistoryState,
  loadFromStorage,
  pushHistory,
  saveToStorage,
  undoHistory,
} from "./persistence/saveStore";

const INITIAL_SEED = 20260519;

export function App() {
  const engine = useMemo(() => createRuleEngine(gameContent), []);
  const [history, setHistory] = useState<HistoryState>(() => ({
    present: createInitialState(gameContent, INITIAL_SEED),
    past: [],
  }));
  const [autoEnemy, setAutoEnemy] = useState(true);
  const [mode, setMode] = useState<"builder" | "game">("builder");
  const [statusText, setStatusText] = useState("建卡道场");

  const state = history.present;
  const activeActor = state.actors.find((actor) => actor.id === state.activeActorId);
  const legalActions = engine.getLegalActions(state);

  const applyGameAction = (action: Action) => {
    setHistory((current) => pushHistory(current, engine.applyAction(current.present, action)));
    setStatusText("有未保存更改");
  };

  const runEnemyStep = () => {
    if (mode !== "game") {
      return;
    }

    const action = chooseAiAction(gameContent, engine, history.present);

    if (action) {
      applyGameAction(action);
    }
  };

  useEffect(() => {
    if (mode !== "game" || !autoEnemy || activeActor?.side !== "enemy" || state.sequence !== "combat") {
      return;
    }

    const timer = window.setTimeout(runEnemyStep, 420);
    return () => window.clearTimeout(timer);
  });

  const newGame = () => {
    setMode("builder");
    setStatusText("建卡道场已开启");
  };

  const startTraining = (characters: CharacterTemplate[]) => {
    setHistory({
      present: createInitialState(gameContent, createSeedFromDate(), characters),
      past: [],
    });
    setMode("game");
    setStatusText("新训练开始");
  };

  const saveGame = () => {
    if (mode !== "game") {
      setStatusText("建卡中暂不保存");
      return;
    }

    saveToStorage(history);
    setStatusText("已保存");
  };

  const loadGame = () => {
    const loaded = loadFromStorage();

    if (loaded) {
      setHistory(loaded);
      setMode("game");
      setStatusText("已读档");
      return;
    }

    setStatusText("没有存档");
  };

  const undo = () => {
    if (mode !== "game") {
      return;
    }

    setHistory((current) => undoHistory(current));
    setStatusText("已撤销");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">忍者杀手 TRPG 入门版</p>
          <h1>{gameContent.scenario.title}</h1>
        </div>
        <div className="toolbar" aria-label="对局工具">
          <button type="button" onClick={newGame} title="新训练">
            <Shuffle size={17} />
            新训练
          </button>
          <button type="button" disabled={mode !== "game"} onClick={saveGame} title="保存">
            <Save size={17} />
            保存
          </button>
          <button type="button" onClick={loadGame} title="读档">
            <FolderOpen size={17} />
            读档
          </button>
          <button type="button" disabled={mode !== "game" || history.past.length === 0} onClick={undo} title="撤销">
            <RotateCcw size={17} />
            撤销
          </button>
          <button type="button" disabled={mode !== "game" || activeActor?.side !== "enemy"} onClick={runEnemyStep} title="敌人一步">
            <StepForward size={17} />
            敌人一步
          </button>
          <label className="toggle">
            <input checked={autoEnemy} onChange={(event) => setAutoEnemy(event.target.checked)} type="checkbox" />
            <Bot size={17} />
            敌人自动
          </label>
        </div>
      </header>

      {mode === "builder" ? (
        <>
          <div className="status-strip">
            <span>建卡阶段</span>
            <span>入门规则完整建卡</span>
            <span>{statusText}</span>
          </div>
          <CharacterBuilder catalog={gameContent.creationCatalog} onStart={startTraining} />
        </>
      ) : (
        <>
          <div className="status-strip">
            <span>第 {state.round} 回合</span>
            <span>{activeActor?.name ?? "-"} / {describePhase(state.phase)}</span>
            <span>{describeSequence(state.sequence)}</span>
            <span>{statusText}</span>
          </div>

          <div className="game-layout">
            <div className="main-column">
              <ScenarioPanel content={gameContent} state={state} />
              <Board content={gameContent} legalActions={legalActions} onAction={applyGameAction} state={state} />
              <ActionPanel content={gameContent} legalActions={legalActions} onAction={applyGameAction} state={state} />
            </div>
            <aside className="side-column">
              <PlayerPanel state={state} />
              <LogPanel state={state} />
            </aside>
          </div>
        </>
      )}

      <footer className="source-note">
        资料来源：本地入门规则书与中文指南。个人本地使用版；忍者汉堡店 PDF 已标记为后续 OCR 模组。
      </footer>
    </main>
  );
}

function describePhase(phase: string): string {
  return {
    move: "移动阶段",
    attack: "攻击阶段",
    cleared: "房间清理",
    gameOver: "剧本结束",
  }[phase] ?? phase;
}

function describeSequence(sequence: string): string {
  return {
    combat: "战斗序列",
    cleared: "清理完毕",
    gameOver: "剧本结束",
  }[sequence] ?? sequence;
}
