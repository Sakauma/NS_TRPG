import type { GameState } from "../engine/types";
import { ActorCard } from "./ActionPanel";

interface PlayerPanelProps {
  state: GameState;
}

export function PlayerPanel({ state }: PlayerPanelProps) {
  const pcs = state.actors.filter((actor) => actor.side === "pc");
  const enemies = state.actors.filter((actor) => actor.side === "enemy");

  return (
    <section className="roster-area" aria-label="角色状态">
      <div className="section-heading">
        <h2>小队与敌人</h2>
        <span>万钞池 {state.teamBank}</span>
      </div>
      <div className="roster-columns">
        <div>
          <h3>玩家小队</h3>
          <div className="actor-list">
            {pcs.map((actor) => (
              <ActorCard actor={actor} key={actor.id} />
            ))}
          </div>
        </div>
        <div>
          <h3>敌人</h3>
          <div className="actor-list">
            {enemies.map((actor) => (
              <ActorCard actor={actor} key={actor.id} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
