export interface MovingTile {
  id: string;
  lane: 0 | 1;
  x: number;
}

export interface MovementState {
  lanes: MovingTile[];
  queue: string[];
  stopped: MovingTile | null;
  nextLane: 0 | 1;
}

const TILE_WIDTH = 52;
const SPAWN_GAP = 8;
const TRAVEL_MS = 8_000;

export function createMovementState(tileIds: string[]): MovementState {
  return { lanes: [], queue: [...tileIds], stopped: null, nextLane: 0 };
}

export function advanceMovement(
  state: MovementState,
  deltaMs: number,
  laneWidth: number,
): MovementState {
  if (state.queue.length === 0 && state.lanes.length === 0) return state;

  const distance = Math.max(0, deltaMs) * (laneWidth + TILE_WIDTH) / TRAVEL_MS;
  const lanes: MovingTile[] = [];
  const queue = [...state.queue];
  for (const tile of state.lanes) {
    const x = tile.x + distance;
    if (x >= laneWidth) queue.push(tile.id);
    else lanes.push({ ...tile, x });
  }

  let nextLane = state.nextLane;
  for (let attempt = 0; attempt < 2 && queue.length > 0; attempt += 1) {
    let lane = nextLane;
    const canSpawn = (candidate: 0 | 1) => {
      const newest = lanes.filter((tile) => tile.lane === candidate).at(-1);
      return !newest || newest.x >= -TILE_WIDTH + TILE_WIDTH + SPAWN_GAP;
    };
    if (!canSpawn(lane)) {
      const otherLane = lane === 0 ? 1 : 0;
      if (!canSpawn(otherLane)) break;
      lane = otherLane;
    }
    const spawnX = -TILE_WIDTH;
    lanes.push({ id: queue.shift()!, lane, x: spawnX });
    nextLane = lane === 0 ? 1 : 0;
  }

  return { lanes, queue, stopped: state.stopped, nextLane };
}

export function stopMovingTile(state: MovementState, id: string): MovementState {
  const tile = state.lanes.find((candidate) => candidate.id === id);
  if (!tile) return state;
  return {
    ...state,
    lanes: state.lanes.filter((candidate) => candidate.id !== id),
    queue: state.queue.filter((candidate) => candidate !== id),
    stopped: { ...tile },
  };
}

export function releaseStoppedTile(state: MovementState, requeue: boolean): MovementState {
  const stopped = state.stopped;
  if (!stopped) return state;
  return {
    ...state,
    queue: requeue && !state.queue.includes(stopped.id)
      ? [...state.queue, stopped.id]
      : state.queue,
    stopped: null,
  };
}
