
// Corrected imports: GRID_SIZE is exported from constants.ts, not types.ts
import { Grid, TileData, Direction } from './types';
import { GRID_SIZE } from './constants';

export const createEmptyGrid = (): Grid => {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
};

export const getRandomEmptyCell = (grid: Grid): { row: number; col: number } | null => {
  const emptyCells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) emptyCells.push({ row: r, col: c });
    }
  }
  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
};

export const addRandomTile = (grid: Grid): Grid => {
  const cell = getRandomEmptyCell(grid);
  if (!cell) return grid;

  const newGrid = grid.map(row => [...row]);
  newGrid[cell.row][cell.col] = {
    id: Date.now() + Math.random(),
    value: Math.random() < 0.9 ? 2 : 4,
    row: cell.row,
    col: cell.col,
  };
  return newGrid;
};

export const moveTiles = (
  grid: Grid,
  direction: Direction
): { grid: Grid; score: number; moved: boolean } => {
  let score = 0;
  let moved = false;
  const newGrid = createEmptyGrid();
  
  // Define a ordem de processamento baseada na direção para evitar sobreposição
  const rowIndices = direction === Direction.DOWN ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const colIndices = direction === Direction.RIGHT ? [3, 2, 1, 0] : [0, 1, 2, 3];

  for (const r of rowIndices) {
    for (const c of colIndices) {
      const tile = grid[r][c];
      if (!tile) continue;

      // CRÍTICO: Limpa 'mergedFrom' do turno anterior para permitir fusões neste novo turno
      const currentTile: TileData = { 
        ...tile, 
        mergedFrom: undefined,
        previousPosition: { row: r, col: c }
      };

      let nextR = r;
      let nextC = c;

      // Calcula a posição de destino (movimento e fusão)
      while (true) {
        let dr = 0, dc = 0;
        if (direction === Direction.UP) dr = -1;
        if (direction === Direction.DOWN) dr = 1;
        if (direction === Direction.LEFT) dc = -1;
        if (direction === Direction.RIGHT) dc = 1;

        const checkR = nextR + dr;
        const checkC = nextC + dc;

        // Verifica limites do mapa
        if (checkR < 0 || checkR >= GRID_SIZE || checkC < 0 || checkC >= GRID_SIZE) break;

        const target = newGrid[checkR][checkC];
        if (!target) {
          // Espaço vazio: continua avançando
          nextR = checkR;
          nextC = checkC;
          continue;
        } else if (target.value === currentTile.value && !target.mergedFrom) {
          // Encontrou bloco igual que ainda não fundiu este turno: FUSÃO!
          nextR = checkR;
          nextC = checkC;
          break;
        } else {
          // Bloqueado por bloco diferente ou já fundido
          break;
        }
      }

      if (nextR !== r || nextC !== c) {
        moved = true;
        const target = newGrid[nextR][nextC];
        if (target && target.value === currentTile.value) {
          // Realiza a fusão de anos
          const newValue = currentTile.value * 2;
          score += newValue;
          newGrid[nextR][nextC] = {
            ...currentTile,
            value: newValue,
            row: nextR,
            col: nextC,
            mergedFrom: [target, currentTile], // Marca como fundido neste turno
          };
        } else {
          // Apenas move para o novo posto
          newGrid[nextR][nextC] = { ...currentTile, row: nextR, col: nextC };
        }
      } else {
        // Mantém a posição
        newGrid[r][c] = currentTile;
      }
    }
  }

  return { grid: newGrid, score, moved };
};

export const canMove = (grid: Grid): boolean => {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) return true;
      const val = grid[r][c]!.value;
      if (r > 0 && grid[r - 1][c]?.value === val) return true;
      if (r < GRID_SIZE - 1 && grid[r + 1][c]?.value === val) return true;
      if (c > 0 && grid[r][c - 1]?.value === val) return true;
      if (c < GRID_SIZE - 1 && grid[r][c + 1]?.value === val) return true;
    }
  }
  return false;
};
