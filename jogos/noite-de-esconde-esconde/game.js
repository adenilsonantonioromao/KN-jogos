
import { SoundManager } from './audio.js';

// Configuration Constants
const WORLD_WIDTH = 1500;
const WORLD_HEIGHT = 2500;
const VIRTUAL_WIDTH = 480;
const VIRTUAL_HEIGHT = 800;

const PLAYER_SPEED = 260;
const MONSTER_SPEED = 105;
const MONSTER_ACTIVATE_TIME = 40;
const CHILD_SPEED_HIDING = 190;
const CHILD_SPEED_FLEEING = 285;
const BASE_SIZE = 180;
const TOTAL_CHILDREN = 20;
const CHILD_SCORE = 50;
const CLOCK_BONUS = 5;
const CLOCK_SPAWN_INTERVAL = 10;
const VISION_DISTANCE = 350;
const VISION_ANGLE = Math.PI / 4;
const CHILD_DETECTION_RADIUS = 110;

const Phases = { START: 0, COUNTDOWN: 1, SEEKING: 2, GAMEOVER: 3, KILLED: 4 };
const ChildStates = { HIDING: 0, HIDDEN: 1, RUNNING: 2, SAVED: 3 };

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.audio = new SoundManager();

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
            monster: { pos: { x: 0, y: 0 }, radius: 26, color: '#1a0033', active: false, opacity: 0, teleportTimer: 7, isTeleporting: false },
            children: [],
            obstacles: [],
            clocks: [],
            particles: [],
            base: { x: 0, y: 0, w: BASE_SIZE, h: BASE_SIZE }
        };

        this.inputs = {
            keys: new Set(),
            joystick: { active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
            footstepTimer: 0,
            clockSpawnTimer: 0,
            gameElapsedTime: 0
        };

        this.initDPI();
        this.initEvents();
        this.loop();
    }

    initDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        // Internal buffer resolution
        this.canvas.width = VIRTUAL_WIDTH * dpr;
        this.canvas.height = VIRTUAL_HEIGHT * dpr;
        
        // CSS display size
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        this.ctx.scale(dpr, dpr);
    }

    initEvents() {
        window.addEventListener('keydown', e => this.inputs.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', e => this.inputs.keys.delete(e.key.toLowerCase()));

        const getPointerPos = (e) => {
            const touch = e.touches ? e.touches[0] : e;
            const r = this.canvas.getBoundingClientRect();
            // Map client coords back to virtual 480x800 space
            return {
                x: (touch.clientX - r.left) * (VIRTUAL_WIDTH / r.width),
                y: (touch.clientY - r.top) * (VIRTUAL_HEIGHT / r.height)
            };
        };

        const onDown = (e) => {
            if (this.state.phase !== Phases.SEEKING) return;
            const pos = getPointerPos(e);
            this.inputs.joystick = { active: true, start: pos, current: pos };
        };

        const onMove = (e) => {
            if (!this.inputs.joystick.active) return;
            this.inputs.joystick.current = getPointerPos(e);
        };

        const onUp = () => this.inputs.joystick.active = false;

        this.canvas.addEventListener('mousedown', onDown);
        this.canvas.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
        this.canvas.addEventListener('touchmove', e => { e.preventDefault(); onMove(e); }, { passive: false });
        window.addEventListener('touchend', onUp);

        window.addEventListener('resize', () => this.initDPI());

        // Buttons
        document.getElementById('btn-start').onclick = () => this.startCountdown();
        document.getElementById('btn-retry').onclick = () => this.startCountdown();
        document.getElementById('btn-restart').onclick = () => this.startCountdown();
    }

    startCountdown() {
        this.audio.init();
        this.audio.playWin();
        this.resetGame();
        this.state.phase = Phases.COUNTDOWN;
        this.state.countdown = 10;
        this.updateUI();

        const timer = setInterval(() => {
            this.state.countdown--;
            if (this.state.countdown <= 0) {
                clearInterval(timer);
                this.state.phase = Phases.SEEKING;
            }
            this.updateUI();
        }, 1000);
    }

    resetGame() {
        this.state.score = 0;
        this.state.timer = 60;
        this.state.processedCount = 0;
        this.inputs.gameElapsedTime = 0;
        this.inputs.clockSpawnTimer = 0;
        
        this.world.player.pos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        this.world.player.angle = -Math.PI / 2;
        this.world.monster.active = false;
        this.world.monster.opacity = 0;
        this.world.clocks = [];
        this.world.particles = [];
        this.world.base = { 
            x: WORLD_WIDTH / 2 - BASE_SIZE / 2, 
            y: WORLD_HEIGHT / 2 - BASE_SIZE / 2, 
            w: BASE_SIZE, h: BASE_SIZE 
        };

        // Obstacles
        this.world.obstacles = [];
        const types = ['house', 'tree', 'car', 'bush'];
        const colors = { house: '#4e342e', tree: '#1b5e20', car: '#0d47a1', bush: '#2e7d32' };
        for (let i = 0; i < 60; i++) {
            const type = types[Math.floor(Math.random() * 4)];
            const w = type === 'house' ? 140 : type === 'car' ? 90 : 50;
            const h = type === 'house' ? 120 : type === 'car' ? 60 : 50;
            const x = Math.random() * (WORLD_WIDTH - w);
            const y = Math.random() * (WORLD_HEIGHT - h);
            if (Math.hypot(x - WORLD_WIDTH/2, y - WORLD_HEIGHT/2) > 300) {
                this.world.obstacles.push({ x, y, w, h, color: colors[type] });
            }
        }

        // Children
        this.world.children = Array.from({ length: TOTAL_CHILDREN }).map((_, i) => ({
            pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
            radius: 12,
            state: ChildStates.HIDING,
            targetPos: this.getRandomExtremity(),
            speed: CHILD_SPEED_HIDING
        }));
    }

    getRandomExtremity() {
        const m = 200;
        const side = Math.floor(Math.random() * 4);
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
        if (phase === Phases.KILLED) {
            document.getElementById('killed-score-val').innerText = score;
        }
        if (phase === Phases.GAMEOVER) {
            document.getElementById('final-score-val').innerText = score;
            document.getElementById('final-friends-val').innerText = `AMIGOS SALVOS: ${processedCount}`;
            document.getElementById('gameover-title').innerText = processedCount >= TOTAL_CHILDREN ? "TODOS SALVOS!" : "TEMPO ESGOTADO";
        }
    }

    checkCollision(nx, ny, r) {
        for (const o of this.world.obstacles) {
            if (nx + r > o.x && nx - r < o.x + o.w && ny + r > o.y && ny - r < o.y + o.h) return true;
        }
        return false;
    }

    update(dt) {
        if (this.state.phase === Phases.START || this.state.phase === Phases.GAMEOVER || this.state.phase === Phases.KILLED) return;

        const gs = this.world;

        // Particle update
        for (let i = gs.particles.length - 1; i >= 0; i--) {
            const p = gs.particles[i];
            p.pos.x += p.vel.x * dt;
            p.pos.y += p.vel.y * dt;
            p.life -= dt * 0.8;
            if (p.life <= 0) gs.particles.splice(i, 1);
        }

        if (this.state.phase === Phases.SEEKING) {
            this.state.timer -= dt;
            if (this.state.timer <= 0) {
                this.state.timer = 0;
                this.endGame(Phases.GAMEOVER);
            }

            // Spawn Clocks
            this.inputs.clockSpawnTimer += dt;
            if (this.inputs.clockSpawnTimer >= CLOCK_SPAWN_INTERVAL) {
                this.inputs.clockSpawnTimer = 0;
                gs.clocks.push({ pos: { x: 100 + Math.random()*(WORLD_WIDTH-200), y: 100 + Math.random()*(WORLD_HEIGHT-200) }, radius: 18 });
            }

            // Monster activation
            this.inputs.gameElapsedTime += dt;
            if (!gs.monster.active && this.inputs.gameElapsedTime > MONSTER_ACTIVATE_TIME) {
                gs.monster.active = true;
                gs.monster.pos = this.getRandomExtremity();
                this.audio.playMonsterTeleport();
            }

            // Player Movement
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
                this.inputs.footstepTimer += dt;
                if(this.inputs.footstepTimer > 0.22) { this.audio.playFootstep(); this.inputs.footstepTimer = 0; }
            }

            // Clock collision
            for (let i = gs.clocks.length - 1; i >= 0; i--) {
                const c = gs.clocks[i];
                if (Math.hypot(c.pos.x - gs.player.pos.x, c.pos.y - gs.player.pos.y) < gs.player.radius + c.radius) {
                    this.state.timer += CLOCK_BONUS;
                    gs.clocks.splice(i, 1);
                    this.audio.playWin();
                }
            }

            // Base Capture
            const inBase = gs.player.pos.x > gs.base.x && gs.player.pos.x < gs.base.x + gs.base.w &&
                          gs.player.pos.y > gs.base.y && gs.player.pos.y < gs.base.y + gs.base.h;
            if (inBase) {
                gs.children.forEach(c => {
                    if (c.state === ChildStates.RUNNING) {
                        c.state = ChildStates.SAVED;
                        c.pos = { x: gs.base.x + 20 + Math.random()*(gs.base.w-40), y: gs.base.y + 20 + Math.random()*(gs.base.h-40) };
                        this.state.score += CHILD_SCORE;
                        this.state.processedCount++;
                        this.audio.playWin();
                    }
                });
            }
        }

        // IA - Children
        gs.children.forEach(c => {
            if (c.state === ChildStates.HIDING) {
                const dx = c.targetPos.x - c.pos.x, dy = c.targetPos.y - c.pos.y, d = Math.hypot(dx, dy);
                if (d < 20) c.targetPos = this.getRandomExtremity();
                else { c.pos.x += (dx/d)*c.speed*dt; c.pos.y += (dy/d)*c.speed*dt; }
                if (this.state.phase === Phases.SEEKING) c.state = ChildStates.HIDDEN;
            } else if (c.state === ChildStates.HIDDEN) {
                const pdx = c.pos.x - gs.player.pos.x, pdy = c.pos.y - gs.player.pos.y, pdist = Math.hypot(pdx, pdy);
                const ang = Math.atan2(pdy, pdx);
                let diff = Math.abs(ang - gs.player.angle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                if ((pdist < VISION_DISTANCE && diff < VISION_ANGLE) || pdist < CHILD_DETECTION_RADIUS) {
                    c.state = ChildStates.RUNNING;
                    this.audio.playAlert();
                }
            } else if (c.state === ChildStates.RUNNING) {
                const tx = WORLD_WIDTH/2, ty = WORLD_HEIGHT/2, dx = tx - c.pos.x, dy = ty - c.pos.y, d = Math.hypot(dx, dy);
                c.pos.x += (dx/d)*CHILD_SPEED_FLEEING*dt; c.pos.y += (dy/d)*CHILD_SPEED_FLEEING*dt;
                if (c.pos.x > gs.base.x && c.pos.x < gs.base.x + gs.base.w && c.pos.y > gs.base.y && c.pos.y < gs.base.y + gs.base.h) {
                    c.state = ChildStates.SAVED;
                    this.state.processedCount++;
                    this.audio.playLose();
                }
            }
        });

        // IA - Monster
        if (gs.monster.active) {
            if (Math.random() > 0.2) {
                gs.particles.push({
                    pos: { x: gs.monster.pos.x + (Math.random()-0.5)*20, y: gs.monster.pos.y + (Math.random()-0.5)*20 },
                    vel: { x: (Math.random()-0.5)*30, y: (Math.random()-0.5)*30 - 20 },
                    life: 1.0, size: 10 + Math.random()*18
                });
            }

            if (gs.monster.isTeleporting) {
                gs.monster.opacity -= dt * 2;
                if (gs.monster.opacity <= 0) {
                    gs.monster.pos = { x: gs.player.pos.x + (Math.random()-0.5)*600, y: gs.player.pos.y + (Math.random()-0.5)*600 };
                    gs.monster.isTeleporting = false;
                    this.audio.playMonsterTeleport();
                }
            } else {
                gs.monster.opacity = Math.min(1, gs.monster.opacity + dt * 2);
                const dx = gs.player.pos.x - gs.monster.pos.x, dy = gs.player.pos.y - gs.monster.pos.y, d = Math.hypot(dx, dy);
                if (d < gs.player.radius + gs.monster.radius - 8) {
                    this.state.score = Math.floor(this.state.score / 2);
                    this.endGame(Phases.KILLED);
                    this.audio.playLose();
                } else {
                    gs.monster.pos.x += (dx/d)*MONSTER_SPEED*dt;
                    gs.monster.pos.y += (dy/d)*MONSTER_SPEED*dt;
                    gs.monster.teleportTimer -= dt;
                    if (gs.monster.teleportTimer <= 0) {
                        gs.monster.isTeleporting = true;
                        gs.monster.teleportTimer = 6 + Math.random()*4;
                    }
                }
            }
        }

        if (this.state.processedCount >= TOTAL_CHILDREN) this.endGame(Phases.GAMEOVER);

        // Camera
        gs.camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIRTUAL_WIDTH, gs.player.pos.x - VIRTUAL_WIDTH / 2));
        gs.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - VIRTUAL_HEIGHT, gs.player.pos.y - VIRTUAL_HEIGHT / 2));
        
        this.updateUI();
    }

    endGame(phase) {
        this.state.phase = phase;
        this.updateUI();
        window.parent.postMessage({ type: 'GAME_OVER', score: this.state.score }, '*');
    }

    draw() {
        const { ctx, world: gs } = this;
        ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        
        // Background Green
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

        ctx.save();
        ctx.translate(-gs.camera.x, -gs.camera.y);

        // Grid
        ctx.strokeStyle = '#244a1f';
        ctx.lineWidth = 1;
        for (let x = 0; x < WORLD_WIDTH; x += 150) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke(); }
        for (let y = 0; y < WORLD_HEIGHT; y += 150) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke(); }

        // Base
        ctx.fillStyle = 'rgba(255, 235, 59, 0.15)';
        ctx.fillRect(gs.base.x, gs.base.y, gs.base.w, gs.base.h);
        ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 4; ctx.strokeRect(gs.base.x, gs.base.y, gs.base.w, gs.base.h);

        // Obstacles
        gs.obstacles.forEach(o => {
            ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(o.x, o.y + o.h - 12, o.w, 12);
        });

        // Clocks
        gs.clocks.forEach(c => {
            ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fbc02d'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#000'; ctx.fillRect(c.pos.x - 1, c.pos.y - 10, 2, 10); ctx.fillRect(c.pos.x - 1, c.pos.y - 1, 8, 2);
        });

        // Particles
        gs.particles.forEach(p => {
            ctx.globalAlpha = p.life * 0.4; ctx.fillStyle = '#1a0033'; ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.size * (1.5 - p.life), 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Children
        gs.children.forEach(c => {
            if (c.state === ChildStates.HIDDEN && this.state.phase === Phases.SEEKING) return;
            ctx.fillStyle = (c.state === ChildStates.SAVED) ? '#ff1744' : '#ff1744'; 
            if (c.state === ChildStates.SAVED) ctx.globalAlpha = 0.6;
            ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI*2); ctx.fill();
            // Eyes
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(c.pos.x-4, c.pos.y-2, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(c.pos.x+4, c.pos.y-2, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(c.pos.x-4, c.pos.y-2, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(c.pos.x+4, c.pos.y-2, 1, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        });

        // Player
        ctx.fillStyle = '#00b0ff'; ctx.beginPath(); ctx.arc(gs.player.pos.x, gs.player.pos.y, gs.player.radius, 0, Math.PI*2); ctx.fill();
        ctx.save();
        ctx.translate(gs.player.pos.x, gs.player.pos.y);
        ctx.rotate(gs.player.angle + Math.PI/2);
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-5, -4, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5, -5, 1.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(5, -5, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        // Monster
        if (gs.monster.active) {
            ctx.globalAlpha = gs.monster.opacity;
            ctx.fillStyle = gs.monster.color;
            ctx.beginPath(); ctx.arc(gs.monster.pos.x, gs.monster.pos.y, gs.monster.radius, 0, Math.PI*2); ctx.fill();
            // Glowing red eyes
            ctx.fillStyle = '#ff0000';
            ctx.shadowBlur = 10; ctx.shadowColor = 'red';
            ctx.beginPath(); ctx.arc(gs.monster.pos.x - 8, gs.monster.pos.y - 6, 7, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gs.monster.pos.x + 8, gs.monster.pos.y - 6, 7, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // Darkness / Lantern
        if (this.state.phase === Phases.SEEKING) {
            const temp = document.createElement('canvas');
            temp.width = VIRTUAL_WIDTH; temp.height = VIRTUAL_HEIGHT;
            const tctx = temp.getContext('2d');
            tctx.fillStyle = 'rgba(0,0,0,0.75)'; tctx.fillRect(0,0,VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
            tctx.globalCompositeOperation = 'destination-out';
            const px = gs.player.pos.x - gs.camera.x, py = gs.player.pos.y - gs.camera.y;
            tctx.beginPath(); tctx.moveTo(px, py);
            tctx.arc(px, py, VISION_DISTANCE, gs.player.angle - VISION_ANGLE, gs.player.angle + VISION_ANGLE);
            tctx.fill();
            // Center light
            const grad = tctx.createRadialGradient(px, py, 5, px, py, 130);
            grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
            tctx.fillStyle = grad; tctx.beginPath(); tctx.arc(px, py, 130, 0, Math.PI*2); tctx.fill();
            ctx.drawImage(temp, 0, 0);
        }

        // Virtual Joystick Draw
        if (this.inputs.joystick.active) {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(this.inputs.joystick.start.x, this.inputs.joystick.start.y, 70, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(this.inputs.joystick.current.x, this.inputs.joystick.current.y, 35, 0, Math.PI*2); ctx.stroke();
        }
    }

    loop() {
        const now = performance.now();
        const dt = (now - this.state.lastTime) / 1000;
        this.state.lastTime = now;
        this.update(Math.min(dt, 0.1));
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Start Engine
const game = new GameEngine();
