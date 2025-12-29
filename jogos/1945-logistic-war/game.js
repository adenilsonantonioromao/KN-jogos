
import { SoundManager } from './audio.js';

// Constantes Sincronizadas
const GRID_SIZE = 4;
const CELL_SIZE = 67.5; 
const GAP = 10;
const PADDING = 10;

const YEAR_MAP = {
    2: "1935", 4: "1936", 8: "1937", 16: "1938", 32: "1939", 64: "1940",
    128: "1941", 256: "1942", 512: "1943", 1024: "1944", 2048: "1945"
};

class Game {
    constructor() {
        this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('wwii-best-score')) || 0;
        this.won = false;
        this.keepPlaying = false;
        this.gameOver = false;
        this.sound = new SoundManager();
        this.tileElements = new Map();

        this.initDOM();
        this.setupEventListeners();
    }

    initDOM() {
        this.tileContainer = document.getElementById('tile-container');
        this.scoreElement = document.getElementById('current-score');
        this.bestScoreElement = document.getElementById('best-score');
        this.bestScoreElement.innerText = this.bestScore;
        
        this.introScreen = document.getElementById('intro-screen');
        this.gameUI = document.getElementById('game-ui');
        this.gameOverOverlay = document.getElementById('game-over-overlay');
        this.victoryOverlay = document.getElementById('victory-overlay');
        
        this.startBtn = document.getElementById('start-game-btn');
        this.toggleAudioBtn = document.getElementById('toggle-audio');
        this.restartBtn = document.getElementById('restart-btn');
        this.keepPlayingBtn = document.getElementById('keep-playing-btn');
        this.retryBtns = document.querySelectorAll('.retry-btn');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.restartBtn.addEventListener('click', () => this.reset());
        this.keepPlayingBtn.addEventListener('click', () => {
            this.keepPlaying = true;
            this.victoryOverlay.classList.add('hidden');
        });
        this.retryBtns.forEach(btn => btn.addEventListener('click', () => this.reset()));

        window.addEventListener('keydown', (e) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
                this.move(e.key.replace('Arrow', '').toUpperCase());
            }
        });

        let startX, startY;
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
                if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'RIGHT' : 'LEFT');
                else this.move(dy > 0 ? 'DOWN' : 'UP');
            }
        });
    }

    start() {
        this.introScreen.classList.add('hidden');
        this.gameUI.classList.remove('hidden');
        this.sound.init();
        this.sound.startBGM();
        this.reset();
    }

    reset() {
        this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        this.score = 0;
        this.won = false;
        this.keepPlaying = false;
        this.gameOver = false;
        this.tileContainer.innerHTML = '';
        this.tileElements.clear();
        this.gameOverOverlay.classList.add('hidden');
        this.victoryOverlay.classList.add('hidden');
        this.scoreElement.innerText = "0";
        this.addTile();
        this.addTile();
        this.render();
    }

    addTile() {
        const empty = [];
        for (let r = 0; r < GRID_SIZE; r++)
            for (let c = 0; c < GRID_SIZE; c++)
                if (!this.grid[r][c]) empty.push({ r, c });

        if (empty.length) {
            const { r, c } = empty[Math.floor(Math.random() * empty.length)];
            this.grid[r][c] = {
                id: Math.random().toString(36).substr(2, 9),
                value: Math.random() < 0.9 ? 2 : 4,
                r, c, new: true
            };
        }
    }

    move(direction) {
        if (this.gameOver || (this.won && !this.keepPlaying)) return;

        let moved = false;
        const vectors = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] };
        const [dr, dc] = vectors[direction];

        const rowIndices = direction === 'DOWN' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const colIndices = direction === 'RIGHT' ? [3, 2, 1, 0] : [0, 1, 2, 3];

        const nextGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

        for (const r of rowIndices) {
            for (const c of colIndices) {
                const tile = this.grid[r][c];
                if (!tile) continue;

                let nr = r, nc = c;
                while (true) {
                    const cr = nr + dr, cc = nc + dc;
                    if (cr < 0 || cr >= GRID_SIZE || cc < 0 || cc >= GRID_SIZE) break;
                    const target = nextGrid[cr][cc];
                    if (!target) { nr = cr; nc = cc; continue; }
                    if (target.value === tile.value && !target.merged) { nr = cr; nc = cc; break; }
                    break;
                }

                const target = nextGrid[nr][nc];
                if (target && target.value === tile.value && !target.merged) {
                    this.score += tile.value * 2;
                    nextGrid[nr][nc] = { ...tile, value: tile.value * 2, r: nr, c: nc, merged: true, mergedId: target.id };
                    moved = true;
                    if (tile.value * 2 === 2048) this.won = true;
                } else {
                    if (nr !== r || nc !== c) moved = true;
                    nextGrid[nr][nc] = { ...tile, r: nr, c: nc, new: false, merged: false };
                }
            }
        }

        if (moved) {
            this.grid = nextGrid;
            this.addTile();
            this.render();
            this.updateScores();
            this.sound.playMorse(this.won ? 'fusion' : 'move');
            this.checkGameOver();
        }
    }

    updateScores() {
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('wwii-best-score', this.bestScore);
            this.bestScoreElement.innerText = this.bestScore;
        }
        this.scoreElement.innerText = this.score;
    }

    checkGameOver() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!this.grid[r][c]) return;
                const v = this.grid[r][c].value;
                if (r > 0 && this.grid[r - 1][c]?.value === v) return;
                if (r < GRID_SIZE - 1 && this.grid[r + 1][c]?.value === v) return;
                if (c > 0 && this.grid[r][c - 1]?.value === v) return;
                if (c < GRID_SIZE - 1 && this.grid[r][c + 1]?.value === v) return;
            }
        }
        this.gameOver = true;
        this.gameOverOverlay.classList.remove('hidden');
    }

    getTilePos(r, c) {
        return {
            left: PADDING + (c * (CELL_SIZE + GAP)),
            top: PADDING + (r * (CELL_SIZE + GAP))
        };
    }

    render() {
        if (this.won && !this.keepPlaying) this.victoryOverlay.classList.remove('hidden');

        const currentIds = new Set();
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const data = this.grid[r][c];
                if (!data) continue;
                currentIds.add(data.id);
                let el = this.tileElements.get(data.id);
                if (!el) {
                    el = this.createTileEl(data);
                    this.tileElements.set(data.id, el);
                    this.tileContainer.appendChild(el);
                }
                const pos = this.getTilePos(r, c);
                el.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
                el.className = `tile tile-${data.value} ${data.new ? 'tile-new' : ''} ${data.merged ? 'tile-merged' : ''}`;
                el.querySelector('.tile-inner').innerText = YEAR_MAP[data.value] || data.value;
            }
        }
        for (const [id, el] of this.tileElements.entries()) {
            if (!currentIds.has(id)) { el.remove(); this.tileElements.delete(id); }
        }
    }

    createTileEl(data) {
        const div = document.createElement('div');
        const pos = this.getTilePos(data.r, data.c);
        div.className = `tile tile-${data.value}`;
        div.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
        const inner = document.createElement('div');
        inner.className = 'tile-inner';
        inner.innerText = YEAR_MAP[data.value] || data.value;
        div.appendChild(inner);
        return div;
    }

    toggleAudio() {
        const active = this.sound.toggleMusic();
        const led = this.toggleAudioBtn.querySelector('.led');
        led.className = `led ${active ? 'on' : 'off'}`;
        return active;
    }
}

new Game();
