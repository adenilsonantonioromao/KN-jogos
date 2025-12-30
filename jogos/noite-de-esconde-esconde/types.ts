
export enum GamePhase {
  START,
  COUNTDOWN,
  SEEKING,
  GAME_OVER,
  MONSTER_KILLED
}

export enum ChildState {
  HIDING,
  HIDDEN,
  SPOOKED,
  RUNNING_TO_BASE,
  CAPTURED,
  SAVED
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface Particle {
  pos: Vector2D;
  vel: Vector2D;
  life: number; // 0 a 1
  size: number;
}

export interface ClockItem {
  pos: Vector2D;
  radius: number;
  active: boolean;
}

export interface Entity {
  id: string;
  pos: Vector2D;
  radius: number;
  color: string;
}

export interface Monster extends Entity {
  active: boolean;
  teleportTimer: number;
  isTeleporting: boolean;
  opacity: number;
}

export interface Child extends Entity {
  state: ChildState;
  targetPos: Vector2D;
  speed: number;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  type: 'tree' | 'house' | 'car' | 'bush';
}
