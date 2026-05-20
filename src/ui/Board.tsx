import type { Action, GameContent, GameState, GridMap, Position } from "../engine/types";
import { positionKey, samePosition } from "../engine/mapRules";
import { requireMap, requireRoom } from "../engine/scenarioRules";

interface BoardProps {
  content: GameContent;
  state: GameState;
  legalActions: Action[];
  onAction: (action: Action) => void;
}

export function Board({ content, state, legalActions, onAction }: BoardProps) {
  const room = requireRoom(content, state.roomId);
  const map = requireMap(content, room.mapId);
  const moveActions = legalActions.filter((action): action is Extract<Action, { type: "move" }> => action.type === "move");
  const moveByCell = new Map(moveActions.map((action) => [positionKey(action.to), action]));

  return (
    <section className="board-area" aria-label="战斗地图">
      <div className="section-heading">
        <h2>{map.name}</h2>
        <span>{map.width} x {map.height}</span>
      </div>
      <div className="grid-board" style={{ gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))` }}>
        {Array.from({ length: map.width * map.height }, (_, index) => {
          const position = { x: index % map.width, y: Math.floor(index / map.width) };
          const actor = state.actors.find((candidate) => candidate.status === "active" && samePosition(candidate.position, position));
          const moveAction = moveByCell.get(positionKey(position));
          const classes = getCellClasses(map, position, Boolean(moveAction), actor?.side);

          return (
            <button
              aria-label={`格子 ${position.x + 1},${position.y + 1}`}
              className={classes}
              disabled={!moveAction}
              key={positionKey(position)}
              onClick={() => moveAction && onAction(moveAction)}
              type="button"
            >
              <span className="cell-coord">{position.x + 1},{position.y + 1}</span>
              {actor ? (
                <span className="actor-token">
                  <strong>{actor.name.slice(0, 2)}</strong>
                  <small>{actor.health}</small>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="map-note">{map.notes.join(" ")}</p>
    </section>
  );
}

function getCellClasses(map: GridMap, position: Position, reachable: boolean, side?: string): string {
  const classes = ["grid-cell"];

  if (map.blocked.some((blocked) => samePosition(blocked, position))) {
    classes.push("blocked");
  }

  if ((map.hazards ?? []).some((hazard) => samePosition(hazard, position))) {
    classes.push("hazard");
  }

  if (map.exits.some((exit) => samePosition(exit, position))) {
    classes.push("exit");
  }

  if (reachable) {
    classes.push("reachable");
  }

  if (side) {
    classes.push(side);
  }

  return classes.join(" ");
}
