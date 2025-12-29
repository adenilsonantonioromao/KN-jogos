
export interface TileData {
  id: number;
  value: number; // The internal 2048 value (2, 4, 8, etc.)
  row: number;
  col: number;
  mergedFrom?: TileData[];
  previousPosition?: { row: number; col: number };
}

export type Grid = (TileData | null)[][];

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export interface GameState {
  grid: Grid;
  score: number;
  bestScore: number;
  gameOver: boolean;
  won: boolean;
  keepPlaying: boolean;
}
