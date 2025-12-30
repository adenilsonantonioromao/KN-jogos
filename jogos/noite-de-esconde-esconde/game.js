
import { SoundManager } from './audio.js';

const audio = new SoundManager();

// Constantes de Configuração
const WORLD_WIDTH = 1500;
const WORLD_HEIGHT = 2500;
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 800;
const TOTAL_CHILDREN = 20;
const CHILD_SCORE = 50;
const PLAYER_SPEED = 260;
const MONSTER_SPEED = 105;
const MONSTER_ACTIVATE_TIME = 40;
const BASE_SIZE = 180;
const CLOCK_BONUS = 5;
const VISION_DISTANCE = 350;
const VISION_ANGLE = Math.PI / 4;

const Phases = { START: 0, COUNTDOWN: 1, SEEKING: 2, GAMEOVER: 3, KILLED: 4 };
const ChildStates = { HIDING: 0, HIDDEN: 1, RUNNING: 2, SAVED: 3 };

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = VIEW_WIDTH;
        this.canvas.height = VIEW_HEIGHT;

        this.state = {
            phase: Phases.START,
            score: 0,
            timer: 60,
            countdown: 10,
            processedCount: 0,
            lastTime: performance.now()
        };

        this.world = {
            player: { pos: { x: 0, y: 0 }, angle: -Math.PI / 2, radius: 15 },
            camera: { x: 0, y: 0 },
            monster: { pos: { x: 0, y: 0 }, radius: 26, active: false, opacity: 0, teleportTimer: 7 },
            children: [],
            obstacles: [],
            clocks: [],
            particles: [],
            base: { x: 0, y: 0, w: BASE_SIZE, h: BASE_SIZE }
        };

        this.inputs = {
            keys: new Set(),
            joystick: { active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } }
        };

        this.initEvents();
        this.loop();
    }

    initEvents() {
        window.addEventListener('keydown', e => this.inputs.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', e => this.inputs.keys.delete(e.key.toLowerCase()));

        const startInp = (e) => {
            if (this.state.phase !== Phases.SEEKING) return;
            const touch = e.touches ? e.touches[0] : e;
            const r = this.canvas.getBoundingClientRect();
            const x = (touch.clientX - r.left) * (VIEW_WIDTH / r.width);
            const y = (touch.clientY - r.top) * (VIEW_HEIGHT / r.height);
            this.inputs.joystick = { active: true, start: { x, y }, current: { x, y } };
        };
        const moveInp = (e) => {
            if (!this.inputs.joystick.active) return;
            const touch = e.touches ? e.touches[0] : e;
            const r = this.canvas.getBoundingClientRect();
            this.inputs.joystick.current = {
                x: (touch.clientX - r.left) * (VIEW_WIDTH / r.width),
                y: (touch.clientY - r.top) * (VIEW_HEIGHT / r.height)
            };
        };
        const endInp = () => this.inputs.joystick.active = false;

        this.canvas.addEventListener('mousedown', startInp);
        this.canvas.addEventListener('mousemove', moveInp);
        window.addEventListener('mouseup', endInp);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startInp(e); });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveInp(e); });
        window.addEventListener('touchend', endInp);

        document.getElementById('btn-start').onclick = () => this.startCountdown();
        document.getElementById('btn-retry').onclick = () => this.startCountdown();
        document.getElementById('btn-restart').onclick = () => this.startCountdown();
    }

    startCountdown() {
        audio.playWin();
        this.resetWorld();
        this.state.phase = Phases.COUNTDOWN;
        this.state.countdown = 10;
        this.updateUI();

        const cd = setInterval(() => {
            this.state.countdown--;
            if (this.state.countdown <= 0) {
                clearInterval(cd);
                this.state.phase = Phases.SEEKING;
            }
            this.updateUI();
        }, 1000);
    }

    resetWorld() {
        this.state.score = 0;
        this.state.timer = 60;
        this.state.processedCount = 0;
        this.world.player.pos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        this.world.monster.active = false;
        this.world.monster.opacity = 0;
        this.world.clocks = [];
        this.world.particles = [];
        this.world.base = { 
            x: WORLD_WIDTH / 2 - BASE_SIZE / 2, 
            y: WORLD_HEIGHT / 2 - BASE_SIZE / 2, 
            w: BASE_SIZE, h: BASE_SIZE 
        };
        
        // Crianças
        this.world.children = Array.from({ length: TOTAL_CHILDREN }).map((_, i) => ({
            id: i, pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
            radius: 12, state: ChildStates.HIDING, 
            targetPos: this.getRandomExtremity(), speed: 190
        }));

        // Obstáculos
        this.world.obstacles = [];
        const colors = { house: '#4e342e', tree: '#1b5e20', car: '#0d47a1', bush: '#2e7d32' };
        for (let i = 0; i < 60; i++) {
            const type = ['house', 'tree', 'car', 'bush'][Math.floor(Math.random() * 4)];
            const w = type === 'house' ? 140 : type === 'car' ? 90 : 50;
            const h = type === 'house' ? 120 : type === 'car' ? 60 : 50;
            const x = Math.random() * (WORLD_WIDTH - w);
            const y = Math.random() * (WORLD_HEIGHT - h);
            if (Math.hypot(x - WORLD_WIDTH/2, y - WORLD_HEIGHT/2) > 300) {
                this.world.obstacles.push({ x, y, w, h, color: colors[type] });
            }
        }
    }

    getRandomExtremity() {
        const side = Math.floor(Math.random() * 4);
        const m = 200;
        if(side === 0) return { x: Math.random() * WORLD_WIDTH, y: Math.random() * m };
        if(side === 1) return { x: WORLD_WIDTH - m, y: Math.random() * WORLD_HEIGHT };
        if(side === 2) return { x: Math.random() * WORLD_WIDTH, y: WORLD_HEIGHT - m };
        return { x: m, y: Math.random() * WORLD_HEIGHT };
    }

    updateUI() {
        const { phase, score, timer, countdown, processedCount } = this.state;
        
        document.getElementById('menu-start').classList.toggle('hidden', phase !== Phases.START);
        document.getElementById('screen-countdown').classList.toggle('hidden', phase !== Phases.COUNTDOWN);
        document.getElementById('menu-killed').classList.toggle('hidden', phase !== Phases.KILLED);
        document.getElementById('menu-gameover').classList.toggle('hidden', phase !== Phases.GAMEOVER);
        document.getElementById('hud').classList.toggle('hidden', phase !== Phases.SEEKING);

        if (phase === Phases.COUNTDOWN) document.getElementById('countdown-val').innerText = countdown;
        if (phase === Phases.SEEKING) {
            document.getElementById('score-val').innerText = score;
            document.getElementById('timer-val').innerText = Math.ceil(timer) + 's';
            document.getElementById('friends-val').innerText = TOTAL_CHILDREN - processedCount;
        }
        if (phase === Phases.KILLED) document.getElementById('killed-score-val').innerText = score;
        if (phase === Phases.GAMEOVER) {
            document.getElementById('final-score-val').innerText = score;
            document.getElementById('final-friends-val').innerText = `AMIGOS SALVOS: ${processedCount}`;
            document.getElementById('gameover-title').innerText = processedCount >= TOTAL_CHILDREN ? "TODOS SALVOS!" : "TEMPO ESGOTADO";
        }
    }

    checkCollision(nx, ny, r) {
        return this.world.obstacles.some(o => 
            nx + r > o.x && nx - r < o.x + o.w && ny + r > o.y && ny - r < o.y + o.h
        );
    }

    update(dt) {
        if (this.state.phase !== Phases.SEEKING && this.state.phase !== Phases.COUNTDOWN) return;
        
        const gs = this.world;

        // Movimento do Jogador
        if (this.state.phase === Phases.SEEKING) {
            this.state.timer -= dt;
            if (this.state.timer <= 0) this.endGame();

            let dx = 0, dy = 0;
            if (this.inputs.keys.has('w') || this.inputs.keys.has('arrowup')) dy -= 1;
            if (this.inputs.keys.has('s') || this.inputs.keys.has('arrowdown')) dy += 1;
            if (this.inputs.keys.has('a') || this.inputs.keys.has('arrowleft')) dx -= 1;
            if (this.inputs.keys.has('d') || this.inputs.keys.has('arrowright')) dx += 1;

            if (this.inputs.joystick.active) {
                const jdx = this.inputs.joystick.current.x - this.inputs.joystick.start.x;
                const jdy = this.inputs.joystick.current.y - this.inputs.joystick.start.y;
                if (Math.hypot(jdx, jdy) > 10) { dx = jdx; dy = jdy; }
            }

            if (dx !== 0 || dy !== 0) {
                const mag = Math.hypot(dx, dy);
                const vx = (dx / mag) * PLAYER_SPEED * dt;
                const vy = (dy / mag) * PLAYER_SPEED * dt;
                if (!this.checkCollision(gs.player.pos.x + vx, gs.player.pos.y, gs.player.radius)) gs.player.pos.x += vx;
                if (!this.checkCollision(gs.player.pos.x, gs.player.pos.y + vy, gs.player.radius)) gs.player.pos.y += vy;
                gs.player.angle = Math.atan2(dy, dx);
            }

            // Captura na Base
            const inBase = gs.player.pos.x > gs.base.x && gs.player.pos.x < gs.base.x + gs.base.w &&
                          gs.player.pos.y > gs.base.y && gs.player.pos.y < gs.base.y + gs.base.h;
            if (inBase) {
                gs.children.forEach(c => {
                    if (c.state === ChildStates.RUNNING) {
                        c.state = ChildStates.SAVED;
                        c.pos = { x: gs.base.x + 20 + Math.random()*(gs.base.w-40), y: gs.base.y + 20 + Math.random()*(gs.base.h-40) };
                        this.state.score += CHILD_SCORE;
                        this.state.processedCount++;
                        audio.playWin();
                    }
                });
            }

            // Spawn Relógios
            if (Math.random() < 0.002) {
                gs.clocks.push({ pos: { x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT }, radius: 18 });
            }
            gs.clocks = gs.clocks.filter(c => {
                if (Math.hypot(c.pos.x - gs.player.pos.x, c.pos.y - gs.player.pos.y) < 30) {
                    this.state.timer += CLOCK_BONUS; audio.playWin(); return false;
                }
                return true;
            });
        }

        // IA das Crianças
        gs.children.forEach(c => {
            if (c.state === ChildStates.HIDING) {
                const dx = c.targetPos.x - c.pos.x, dy = c.targetPos.y - c.pos.y, dist = Math.hypot(dx, dy);
                if (dist < 10) c.targetPos = this.getRandomExtremity();
                else { c.pos.x += (dx/dist)*c.speed*dt; c.pos.y += (dy/dist)*c.speed*dt; }
                if (this.state.phase === Phases.SEEKING) c.state = ChildStates.HIDDEN;
            } else if (c.state === ChildStates.HIDDEN) {
                const pdx = c.pos.x - gs.player.pos.x, pdy = c.pos.y - gs.player.pos.y, pdist = Math.hypot(pdx, pdy);
                const ang = Math.atan2(pdy, pdx);
                let diff = Math.abs(ang - gs.player.angle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if (pdist < VISION_DISTANCE && diff < VISION_ANGLE) {
                    c.state = ChildStates.RUNNING; audio.playAlert();
                }
            } else if (c.state === ChildStates.RUNNING) {
                const tx = WORLD_WIDTH/2, ty = WORLD_HEIGHT/2, dx = tx - c.pos.x, dy = ty - c.pos.y, d = Math.hypot(dx, dy);
                c.pos.x += (dx/d)*285*dt; c.pos.y += (dy/d)*285*dt;
                if (c.pos.x > gs.base.x && c.pos.x < gs.base.x + gs.base.w && c.pos.y > gs.base.y && c.pos.y < gs.base.y + gs.base.h) {
                    c.state = ChildStates.SAVED; this.state.processedCount++; audio.playLose();
                }
            }
        });

        // IA do Monstro
        if (this.state.phase === Phases.SEEKING && !gs.monster.active && this.state.timer < 20) {
            gs.monster.active = true; gs.monster.pos = this.getRandomExtremity(); audio.playMonsterTeleport();
        }
        if (gs.monster.active) {
            gs.monster.opacity = Math.min(1, gs.monster.opacity + dt);
            const dx = gs.player.pos.x - gs.monster.pos.x, dy = gs.player.pos.y - gs.monster.pos.y, d = Math.hypot(dx, dy);
            gs.monster.pos.x += (dx/d)*MONSTER_SPEED*dt; gs.monster.pos.y += (dy/d)*MONSTER_SPEED*dt;
            if (d < 30) { 
                this.state.score = Math.floor(this.state.score/2);
                this.state.phase = Phases.KILLED;
                this.updateUI();
                audio.playLose();
                window.parent.postMessage({ type: 'GAME_OVER', score: this.state.score }, '*');
            }
        }

        if (this.state.processedCount >= TOTAL_CHILDREN) this.endGame();

        // Câmera
        gs.camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, gs.player.pos.x - VIEW_WIDTH / 2));
        gs.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, gs.player.pos.y - VIEW_HEIGHT / 2));
    }

    endGame() {
        this.state.phase = Phases.GAMEOVER;
        this.updateUI();
        window.parent.postMessage({ type: 'GAME_OVER', score: this.state.score }, '*');
    }

    draw() {
        const { ctx, world: gs } = this;
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        ctx.save();
        ctx.translate(-gs.camera.x, -gs.camera.y);

        // Grid
        ctx.strokeStyle = '#244a1f';
        for (let i = 0; i < WORLD_WIDTH; i += 200) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, WORLD_HEIGHT); ctx.stroke(); }
        for (let i = 0; i < WORLD_HEIGHT; i += 200) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(WORLD_WIDTH, i); ctx.stroke(); }

        // Base
        ctx.fillStyle = 'rgba(253, 216, 53, 0.2)';
        ctx.fillRect(gs.base.x, gs.base.y, gs.base.w, gs.base.h);

        // Obstáculos
        gs.obstacles.forEach(o => { ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h); });

        // Relógios
        gs.clocks.forEach(c => {
            ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI*2); ctx.fill();
        });

        // Crianças
        gs.children.forEach(c => {
            if (c.state === ChildStates.HIDDEN) return;
            ctx.fillStyle = c.state === ChildStates.SAVED ? '#00b0ff' : '#ff1744';
            ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI*2); ctx.fill();
        });

        // Jogador
        ctx.fillStyle = '#00b0ff';
        ctx.beginPath(); ctx.arc(gs.player.pos.x, gs.player.pos.y, gs.player.radius, 0, Math.PI*2); ctx.fill();

        // Monstro
        if (gs.monster.active) {
            ctx.globalAlpha = gs.monster.opacity;
            ctx.fillStyle = '#1a0033';
            ctx.beginPath(); ctx.arc(gs.monster.pos.x, gs.monster.pos.y, gs.monster.radius, 0, Math.PI*2); ctx.fill();
            // Olhos Vermelhos
            ctx.fillStyle = 'red';
            ctx.beginPath(); ctx.arc(gs.monster.pos.x-8, gs.monster.pos.y-5, 6, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gs.monster.pos.x+8, gs.monster.pos.y-5, 6, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Lanterna (Fog of War)
        if (this.state.phase === Phases.SEEKING) {
            const temp = document.createElement('canvas');
            temp.width = VIEW_WIDTH; temp.height = VIEW_HEIGHT;
            const tctx = temp.getContext('2d');
            tctx.fillStyle = 'rgba(0,0,0,0.8)'; tctx.fillRect(0,0, VIEW_WIDTH, VIEW_HEIGHT);
            tctx.globalCompositeOperation = 'destination-out';
            const px = gs.player.pos.x - gs.camera.x, py = gs.player.pos.y - gs.camera.y;
            tctx.beginPath(); tctx.moveTo(px, py);
            tctx.arc(px, py, VISION_DISTANCE, gs.player.angle - VISION_ANGLE, gs.player.angle + VISION_ANGLE);
            tctx.fill();
            tctx.beginPath(); tctx.arc(px, py, 80, 0, Math.PI*2); tctx.fill();
            ctx.drawImage(temp, 0, 0);
        }

        // Joystick
        if (this.inputs.joystick.active) {
            ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.arc(this.inputs.joystick.start.x, this.inputs.joystick.start.y, 50, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.inputs.joystick.current.x, this.inputs.joystick.current.y, 25, 0, Math.PI*2); ctx.stroke();
        }
    }

    loop(t) {
        const dt = (t - this.state.lastTime) / 1000;
        this.state.lastTime = t;
        this.update(Math.min(dt, 0.1));
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    }
}

new Game();
