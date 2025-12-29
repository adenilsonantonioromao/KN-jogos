import { SoundManager } from './audio.js';

const GRID_SIZE = 4;
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
        this.audioActive = true;

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

        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Touch para mobile
        let touchStartX = 0;
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            
            if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.move(dx > 0 ? 'RIGHT' : 'LEFT');
                } else {
                    this.move(dy > 0 ? 'DOWN' : 'UP');
                }
            }
        });
    }

    start() {
        this.introScreen.classList.add('hidden');
        this.gameUI.classList.remove('hidden');
        this.sound.init();
        this.sound.startBGM();
        this.sound.playMorse('start');
        this.reset();
    }

    reset() {
        this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        this.score = 0;
        this.won = false;
        this.keepPlaying = false;
        this.gameOver = false;
        this.gameOverOverlay.classList.add('hidden');
        this.victoryOverlay.classList.add('hidden');
        this.scoreElement.innerText = "0";
        this.addTile();
        this.addTile();
        this.render();
    }

    toggleAudio() {
        const active = this.sound.toggleMusic();
        this.audioActive = active;
        const led = this.toggleAudioBtn.querySelector('.led');
        const label = this.toggleAudioBtn.querySelector('.label');
        if (active) {
            led.classList.replace('off', 'on');
            label.innerHTML = "RÁDIO<br>LIG";
        } else {
            led.classList.replace('on', 'off');
            label.innerHTML = "RÁDIO<br>DES";
        }
    }

    addTile() {
        const emptyCells = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!this.grid[r][c]) emptyCells.push({ r, c });
            }
        }
        if (emptyCells.length > 0) {
            const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.grid[r][c] = {
                id: Math.random(),
                value: Math.random() < 0.9 ? 2 : 4,
                r, c,
                new: true
            };
        }
    }

    handleKeyDown(e) {
        if (this.gameOver || (this.won && !this.keepPlaying)) return;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            const dir = e.key.replace('Arrow', '').toUpperCase();
            this.move(dir);
        }
    }

    move(direction) {
        if (this.gameOver) return;
        
        let moved = false;
        const vectors = {
            'UP': { r: -1, c: 0 },
            'DOWN': { r: 1, c: 0 },
            'LEFT': { r: 0, c: -1 },
            'RIGHT': { r: 0, c: 1 }
        };
        const vector = vectors[direction];

        // Ordem de processamento
        const rowIndices = direction === 'DOWN' ? [3, 2, 1, 0] : [0, 1, 2, 3];
        const colIndices = direction === 'RIGHT' ? [3, 2, 1, 0] : [0, 1, 2, 3];

        const newGrid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

        for (const r of rowIndices) {
            for (const c of colIndices) {
                const tile = this.grid[r][c];
                if (!tile) continue;

                let nextR = r;
                let nextC = c;

                // Tenta mover o mais longe possível
                while (true) {
                    const checkR = nextR + vector.r;
                    const checkC = nextC + vector.c;

                    if (checkR < 0 || checkR >= GRID_SIZE || checkC < 0 || checkC >= GRID_SIZE) break;

                    const target = newGrid[checkR][checkC];
                    if (!target) {
                        nextR = checkR;
                        nextC = checkC;
                        continue;
                    } else if (target.value === tile.value && !target.merged) {
                        nextR = checkR;
                        nextC = checkC;
                        break;
                    } else {
                        break;
                    }
                }

                const target = newGrid[nextR][nextC];
                if (target && target.value === tile.value && !target.merged) {
                    const newValue = tile.value * 2;
                    this.score += newValue;
                    newGrid[nextR][nextC] = { 
                        id: tile.id, value: newValue, 
                        r: nextR, c: nextC, merged: true 
                    };
                    moved = true;
                    if (newValue === 2048) this.won = true;
                } else {
                    if (nextR !== r || nextC !== c) moved = true;
                    newGrid[nextR][nextC] = { ...tile, r: nextR, c: nextC, new: false, merged: false };
                }
            }
        }

        if (moved) {
            this.grid = newGrid;
            this.addTile();
            this.render();
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                localStorage.setItem('wwii-best-score', this.bestScore);
                this.bestScoreElement.innerText = this.bestScore;
            }
            this.scoreElement.innerText = this.score;
            this.sound.playMorse(this.won ? 'fusion' : 'move');
            this.checkGameOver();
        }
    }

    checkGameOver() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!this.grid[r][c]) return;
                const val = this.grid[r][c].value;
                if (r > 0 && this.grid[r - 1][c]?.value === val) return;
                if (r < GRID_SIZE - 1 && this.grid[r + 1][c]?.value === val) return;
                if (c > 0 && this.grid[r][c - 1]?.value === val) return;
                if (c < GRID_SIZE - 1 && this.grid[r][c + 1]?.value === val) return;
            }
        }
        this.gameOver = true;
        this.gameOverOverlay.classList.remove('hidden');
        window.parent.postMessage({ type: 'GAME_OVER', score: Math.floor(this.score) }, '*');
    }

    render() {
        this.tileContainer.innerHTML = '';
        if (this.won && !this.keepPlaying) this.victoryOverlay.classList.remove('hidden');

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const tileData = this.grid[r][c];
                if (tileData) {
                    const tileEl = document.createElement('div');
                    tileEl.className = `tile tile-${tileData.value} ${tileData.new ? 'tile-new' : ''} ${tileData.merged ? 'tile-merged' : ''}`;
                    tileEl.style.transform = `translate(${tileData.c * 100}%, ${tileData.r * 100}%)`;
                    
                    const inner = document.createElement('div');
                    inner.className = 'tile-inner';
                    inner.innerText = YEAR_MAP[tileData.value] || tileData.value;
                    
                    tileEl.appendChild(inner);
                    this.tileContainer.appendChild(tileEl);
                }
            }
        }
    }
}

// Inicializa o jogo
new Game();