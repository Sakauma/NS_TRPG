import type { ActorState, GridMap, Position } from "./types";

export function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function samePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

export function manhattanDistance(left: Position, right: Position): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function isAdjacent(left: Position, right: Position): boolean {
  return manhattanDistance(left, right) === 1;
}

export function isInsideMap(map: GridMap, position: Position): boolean {
  return position.x >= 0 && position.x < map.width && position.y >= 0 && position.y < map.height;
}

export function isBlocked(map: GridMap, position: Position): boolean {
  return map.blocked.some((blocked) => samePosition(blocked, position));
}

export function isHazard(map: GridMap, position: Position): boolean {
  return (map.hazards ?? []).some((hazard) => samePosition(hazard, position));
}

export function isOccupied(actors: ActorState[], position: Position, exceptActorId?: string): boolean {
  return actors.some(
    (actor) =>
      actor.id !== exceptActorId &&
      actor.status === "active" &&
      samePosition(actor.position, position),
  );
}

export function canStandAt(
  map: GridMap,
  actors: ActorState[],
  position: Position,
  exceptActorId?: string,
): boolean {
  return (
    isInsideMap(map, position) &&
    !isBlocked(map, position) &&
    !isOccupied(actors, position, exceptActorId)
  );
}

export function reachableCells(map: GridMap, actors: ActorState[], actor: ActorState): Position[] {
  const maxDistance = Math.max(0, actor.stats.footwork);
  const visited = new Set<string>([positionKey(actor.position)]);
  const queue: Array<{ position: Position; distance: number }> = [
    { position: actor.position, distance: 0 },
  ];
  const reachable: Position[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.distance >= maxDistance) {
      continue;
    }

    for (const next of cardinalNeighbors(current.position)) {
      const key = positionKey(next);

      if (visited.has(key) || !canStandAt(map, actors, next, actor.id)) {
        continue;
      }

      visited.add(key);
      reachable.push(next);
      queue.push({ position: next, distance: current.distance + 1 });
    }
  }

  return reachable;
}

export function hasLineOfSight(map: GridMap, from: Position, to: Position): boolean {
  if (samePosition(from, to)) {
    return true;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = greatestCommonDivisor(Math.abs(dx), Math.abs(dy));

  if (steps <= 1) {
    return true;
  }

  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let step = 1; step < steps; step += 1) {
    const position = { x: from.x + stepX * step, y: from.y + stepY * step };

    if (isBlocked(map, position)) {
      return false;
    }
  }

  return true;
}

export function cardinalNeighbors(position: Position): Position[] {
  return [
    { x: position.x + 1, y: position.y },
    { x: position.x - 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x, y: position.y - 1 },
  ];
}

function greatestCommonDivisor(left: number, right: number): number {
  if (right === 0) {
    return left;
  }

  return greatestCommonDivisor(right, left % right);
}
