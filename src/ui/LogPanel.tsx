import type { GameState } from "../engine/types";

interface LogPanelProps {
  state: GameState;
}

export function LogPanel({ state }: LogPanelProps) {
  return (
    <section className="log-area" aria-label="日志">
      <div className="section-heading">
        <h2>骰子与日志</h2>
        <span>{state.log.length} 条</span>
      </div>
      <ol className="log-list">
        {state.log
          .slice()
          .reverse()
          .map((entry) => (
            <li key={entry.id}>
              <span>R{entry.round}</span>
              <p>{entry.message}</p>
            </li>
          ))}
      </ol>
    </section>
  );
}
