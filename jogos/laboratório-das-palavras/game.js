
import { SoundManager } from './audio.js';

const DATABASE = [
    { word: "BOLA", emoji: "⚽", silabas: ["BO", "LA"] },
    { word: "PATO", emoji: "🦆", silabas: ["PA", "TO"] },
    { word: "VACA", emoji: "🐄", silabas: ["VA", "CA"] },
    { word: "SAPO", emoji: "🐸", silabas: ["SA", "PO"] },
    { word: "GATO", emoji: "🐱", silabas: ["GA", "TO"] },
    { word: "BANANA", emoji: "🍌", silabas: ["BA", "NA", "NA"] },
    { word: "CASA", emoji: "🏠", silabas: ["CA", "SA"] },
    { word: "FOGO", emoji: "🔥", silabas: ["FO", "GO"] },
    { word: "DADO", emoji: "🎲", silabas: ["DA", "DO"] },
    { word: "MACACO", emoji: "🐒", silabas: ["MA", "CA", "CO"] },
    { word: "PIPOCA", emoji: "🍿", silabas: ["PI", "PO", "CA"] },
    { word: "BONECA", emoji: "🪆", silabas: ["BO", "NE", "CA"] },
    { word: "CAVALO", emoji: "🐎", silabas: ["CA", "VA", "LO"] },
    { word: "JACARÉ", emoji: "🐊", silabas: ["JA", "CA", "RÉ"] },
    { word: "PANELA", emoji: "🍳", silabas: ["PA", "NE", "LA"] },
    { word: "MENINA", emoji: "👧", silabas: ["ME", "NI", "NA"] },
    { word: "CANETA", emoji: "🖊️", silabas: ["CA", "NE", "TA"] },
    { word: "JANELA", emoji: "🪟", silabas: ["JA", "NE", "LA"] },
    { word: "SAPATO", emoji: "👞", silabas: ["SA", "PA", "TO"] },
    { word: "TOMATE", emoji: "🍅", silabas: ["TO", "MA", "TE"] },
    { word: "XÍCARA", emoji: "☕", silabas: ["XÍ", "CA", "RA"] },
    { word: "ESCOLA", emoji: "🏫", silabas: ["ES", "CO", "LA"] },
    { word: "PETECA", emoji: "🏸", silabas: ["PE", "TE", "CA"] },
    { word: "AMORA", emoji: "🫐", silabas: ["A", "MO", "RA"] },
    { word: "ABELHA", emoji: "🐝", silabas: ["A", "BE", "LHA"] },
    { word: "OVELHA", emoji: "🐑", silabas: ["O", "VE", "LHA"] },
    { word: "PIRULITO", emoji: "🍭", silabas: ["PI", "RU", "LI", "TO"] },
    { word: "TELEFONE", emoji: "📞", silabas: ["TE", "LE", "FO", "NE"] },
    { word: "CABELO", emoji: "💇", silabas: ["CA", "BE", "LO"] },
    { word: "CAMELO", emoji: "🐪", silabas: ["CA", "ME", "LO"] },
];

const COLORS = {
    purple: "#9d4edd", blue: "#4cc9f0", pink: "#f72585", green: "#adff2f",
    gold: "#ffca3a", red: "#ff595e", orange: "#ff924c", bg: "#240046",
    panel: "#f8f9fa", dark: "#3c096c"
};

const SYLLABLE_COLORS = [
    COLORS.red, COLORS.orange, COLORS.gold, COLORS.green, COLORS.blue, COLORS.purple, COLORS.pink
];

class PotionsLabGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.audio = new SoundManager();
        this.gameState = 'START';
        this.points = 0;
        this.currentWord = null;
        this.lastTime = 0;
        this.maxWidth = 480;

        this.data = {
            worldY: 0,
            playerX: 240,
            playerRadius: 25,
            entities: [],
            particles: [],
            bubbles: [],
            targetSyllableIdx: 0,
            keys: {}
        };

        this.initEventListeners();
        this.resize();
        requestAnimationFrame(this.loop.bind(this));
    }

    initEventListeners() {
        window.addEventListener('resize', this.resize.bind(this));
        
        document.getElementById('btn-start').addEventListener('click', () => {
            window.parent.postMessage({ type: 'RESTART' }, '*');
            this.startGame();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            window.parent.postMessage({ type: 'RESTART' }, '*');
            location.reload();
        });

        window.addEventListener('keydown', (e) => this.data.keys[e.key] = true);
        window.addEventListener('keyup', (e) => this.data.keys[e.key] = false);

        this.canvas.addEventListener('mousedown', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.handleInput(e.clientX - r.left, e.clientY - r.top);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.data.keys['mX'] = e.clientX - r.left;
            this.data.keys['mY'] = e.clientY - r.top;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            const r = this.canvas.getBoundingClientRect();
            const x = t.clientX - r.left;
            const y = t.clientY - r.top;
            
            if (this.gameState === 'PLAYING') {
                if (x < r.width / 2) this.data.keys['touchLeft'] = true;
                else this.data.keys['touchRight'] = true;
            } else {
                this.handleInput(x, y);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.data.keys['touchLeft'] = false;
            this.data.keys['touchRight'] = false;
        });
    }

    resize() {
        this.canvas.width = Math.min(window.innerWidth, this.maxWidth);
        this.canvas.height = window.innerHeight;
        this.data.playerX = this.canvas.width / 2;
    }

    async startGame() {
        await this.audio.init();
        this.audio.startMusic();
        this.points = 0;
        this.gameState = 'PLAYING';
        this.data.entities = [];
        this.data.particles = [];
        this.data.worldY = 0;
        this.spawnBatch(0, 5, 0);
        
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.updateHUD();
    }

    spawnBatch(startY, count, currentPoints) {
        const width = this.canvas.width;
        const gap = Math.max(320, 480 - (Math.min(currentPoints / 1000, 1) * 160));
        const extraSpikes = Math.floor(Math.min(currentPoints / 333, 2));

        for (let i = 0; i < count; i++) {
            const y = startY - (i * gap) - 600;
            
            this.data.entities.push({
                type: 'FLASK', x: Math.random() * (width - 100) + 50, y, radius: 45, active: true,
                data: DATABASE[Math.floor(Math.random() * DATABASE.length)],
                floatOff: Math.random() * 10
            });

            const numSpikes = 1 + extraSpikes;
            for(let s = 0; s < numSpikes; s++) {
                this.data.entities.push({
                    type: 'SPIKE', 
                    x: (width / (numSpikes + 1)) * (s + 1) + (Math.random() - 0.5) * 40, 
                    y: y + (gap * 0.5), 
                    radius: 30, active: true
                });
            }

            for(let j=0; j<2; j++) {
                this.data.entities.push({
                    type: 'STAR', x: Math.random() * (width - 100) + 50, y: y + (gap * 0.25) + (j*40), radius: 15, active: true
                });
            }
        }
    }

    handleInput(x, y) {
        if (this.gameState !== 'CHALLENGE') return;
        this.data.bubbles.forEach((b) => {
            if (!b.active) return;
            if (Math.hypot(x - b.x, y - b.y) < b.radius + 10) {
                if (b.text === this.currentWord.silabas[this.data.targetSyllableIdx]) {
                    this.audio.playCorrectSyllable(this.data.targetSyllableIdx);
                    b.active = false;
                    this.data.targetSyllableIdx++;
                    if (this.data.targetSyllableIdx >= this.currentWord.silabas.length) {
                        this.gameState = 'SUCCESS';
                        const reward = this.currentWord.silabas.length * 10;
                        this.spawnGoldRain(this.canvas.width/2, this.canvas.height/2, reward);
                        this.points += reward;
                        this.updateHUD();
                        setTimeout(() => {
                            this.gameState = 'PLAYING';
                            document.getElementById('hud').classList.remove('challenge-mode');
                            this.data.entities.forEach(e => { if(e.data === this.currentWord) e.active = false; });
                        }, 2000);
                    }
                } else {
                    this.audio.playIncorrectSyllable();
                    b.shake = 10;
                }
            }
        });
    }

    spawnGoldRain(x, y, count) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 5 + Math.random() * 10;
            this.data.particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                radius: 6 + Math.random() * 8, color: COLORS.gold, life: 2.0, decay: 0.015,
                isCoin: true, rotation: Math.random() * Math.PI * 2, rotationSpeed: 0.1
            });
        }
    }

    updateHUD() {
        document.getElementById('score-display').innerText = `✨ ${this.points}`;
    }

    startChallenge(flask) {
        this.gameState = 'CHALLENGE';
        this.currentWord = flask.data;
        this.data.targetSyllableIdx = 0;
        this.data.bubbles = [];
        document.getElementById('hud').classList.add('challenge-mode');

        const syls = [...this.currentWord.silabas];
        const decoys = ["MA", "PA", "BO", "LA", "CA", "VA", "TO", "SA", "ME", "LU", "RI", "DE", "JU", "KI"];
        while(syls.length < 6) {
            const d = decoys[Math.floor(Math.random()*decoys.length)];
            if(!syls.includes(d)) syls.push(d);
        }
        syls.sort(() => Math.random() - 0.5);
        
        const canvasWidth = this.canvas.width;
        syls.forEach((s, i) => {
            this.data.bubbles.push({
                x: (canvasWidth / 3) * ((i % 3) + 0.5),
                y: (this.canvas.height * 0.62) + (Math.floor(i / 3) * 120),
                text: s, radius: 48, active: true, 
                color: SYLLABLE_COLORS[i % SYLLABLE_COLORS.length],
                orbitAngle: Math.random() * Math.PI * 2
            });
        });
    }

    update(dt) {
        const data = this.data;
        
        for (let i = data.particles.length - 1; i >= 0; i--) {
            const p = data.particles[i];
            p.x += p.vx; p.y += p.vy;
            if(p.isCoin) { p.vy += 0.3; p.rotation += p.rotationSpeed; }
            p.life -= p.decay;
            if (p.life <= 0) data.particles.splice(i, 1);
        }

        if (this.gameState === 'PLAYING') {
            const scrollSpeed = (220 + (Math.min(this.points / 1000, 1) * 400)) * dt;
            data.worldY += scrollSpeed;
            
            if (data.keys['ArrowLeft'] || data.keys['touchLeft']) data.playerX -= 500 * dt;
            if (data.keys['ArrowRight'] || data.keys['touchRight']) data.playerX += 500 * dt;
            
            data.playerX = Math.max(30, Math.min(this.canvas.width - 30, data.playerX));

            data.entities.forEach((ent) => {
                ent.y += scrollSpeed;
                if (!ent.active) return;
                const dist = Math.hypot(data.playerX - ent.x, (this.canvas.height * 0.8) - ent.y);
                if (dist < data.playerRadius + ent.radius) {
                    if (ent.type === 'SPIKE') {
                        this.audio.playExplode();
                        this.audio.stopMusic();
                        this.gameState = 'GAMEOVER';
                        document.getElementById('final-score').innerText = `Nível atingido: ${this.points} cristais!`;
                        document.getElementById('game-over-screen').classList.remove('hidden');
                        window.parent.postMessage({ type: 'GAME_OVER', score: this.points }, '*');
                    } else if (ent.type === 'STAR') {
                        ent.active = false;
                        this.points += 1;
                        this.updateHUD();
                        this.audio.playPop(1100);
                        for(let i=0; i<5; i++) {
                            data.particles.push({ 
                                x: ent.x, y: ent.y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, 
                                radius: 4, color: COLORS.gold, life: 0.5, decay: 0.05 
                            });
                        }
                    } else if (ent.type === 'FLASK') {
                        this.startChallenge(ent);
                    }
                }
            });

            if (data.entities.length > 0 && data.entities[0].y > this.canvas.height + 200) {
                data.entities = data.entities.filter(e => e.y < this.canvas.height + 600);
                this.spawnBatch(data.entities[data.entities.length - 1].y, 2, this.points);
            }
        }

        if (this.gameState === 'CHALLENGE' || this.gameState === 'SUCCESS') {
            data.bubbles.forEach(b => {
                b.y += Math.sin(Date.now() * 0.004 + b.x) * 0.4;
                b.orbitAngle = (b.orbitAngle || 0) + 0.05;
            });
        }
    }

    draw() {
        const { ctx, canvas } = this;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, width, height);

        const difficultyProgress = Math.min(this.points / 1000, 1);
        ctx.strokeStyle = `rgba(255,255,255, ${0.08 + difficultyProgress * 0.05})`;
        const gridSize = 60;
        const offset = this.data.worldY % gridSize;
        for(let i=0; i<width; i+=gridSize) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
        for(let j=offset; j<height; j+=gridSize) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke(); }

        this.data.entities.forEach(ent => {
            if (!ent.active) return;
            ctx.save();
            ctx.translate(ent.x, ent.y + (ent.floatOff ? Math.sin(Date.now()*0.005 + ent.floatOff)*10 : 0));
            if (ent.type === 'SPIKE') {
                ctx.fillStyle = COLORS.red;
                ctx.beginPath(); ctx.moveTo(-ent.radius, ent.radius); ctx.lineTo(0, -ent.radius); ctx.lineTo(ent.radius, ent.radius); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(0, 5, 5, 0, Math.PI*2); ctx.fill();
                if(this.points > 500) { ctx.shadowBlur = 10; ctx.shadowColor = COLORS.red; ctx.stroke(); }
            } else if (ent.type === 'STAR') {
                ctx.fillStyle = COLORS.gold; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("⭐", 0, 10);
            } else if (ent.type === 'FLASK') {
                ctx.fillStyle = COLORS.blue; ctx.beginPath(); ctx.arc(0, 10, ent.radius * 0.8, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.arc(-10, -5, 10, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "white"; ctx.font = "40px Arial"; ctx.textAlign = "center"; ctx.fillText("🧪", 0, 15);
            }
            ctx.restore();
        });

        ctx.save(); ctx.translate(this.data.playerX, height * 0.8);
        ctx.fillStyle = COLORS.pink; ctx.beginPath(); 
        this.roundRect(ctx, -22, -22, 44, 44, 12); ctx.fill();
        ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-10, -5, 8, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(10, -5, 8, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -5); ctx.stroke();
        ctx.fillStyle = "black"; ctx.beginPath(); ctx.arc(-10, -5, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, -5, 3, 0, Math.PI*2); ctx.fill();
        ctx.restore();

        if (this.gameState === 'CHALLENGE' || this.gameState === 'SUCCESS') {
            ctx.fillStyle = COLORS.panel; ctx.fillRect(0, 0, width, height);
            
            const pulse = this.gameState === 'SUCCESS' ? 1 + Math.sin(Date.now() * 0.015) * 0.1 : 1;
            ctx.save(); ctx.translate(width/2, height * 0.25); ctx.scale(pulse, pulse);
            ctx.textAlign = "center"; ctx.font = "120px Fredoka"; ctx.fillText(this.currentWord.emoji, 0, 0); ctx.restore();

            ctx.fillStyle = COLORS.dark; ctx.font = "bold 54px Fredoka"; ctx.textAlign = "center";
            let display = this.currentWord.silabas.map((s, i) => i < this.data.targetSyllableIdx ? s : "_").join(" ");
            ctx.fillText(display, width/2, height * 0.42);

            if (this.gameState === 'CHALLENGE') {
                this.data.bubbles.forEach(b => {
                    if (!b.active) return;
                    ctx.save(); 
                    let bx = b.x; if(b.shake) { bx += (Math.random()-0.5)*b.shake; b.shake *= 0.8; if(b.shake < 0.1) b.shake = 0; }
                    ctx.translate(bx, b.y);
                    
                    ctx.strokeStyle = b.color + "44"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.ellipse(0, 0, b.radius + 18, (b.radius + 18) * 0.5, b.orbitAngle * 0.3, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = b.color;
                    ctx.beginPath(); ctx.arc(Math.cos(b.orbitAngle) * (b.radius + 18), Math.sin(b.orbitAngle) * (b.radius + 18) * 0.5, 6, 0, Math.PI * 2); ctx.fill();

                    ctx.shadowBlur = 15; ctx.shadowColor = b.color + "88";
                    ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI*2); ctx.fillStyle = b.color; ctx.fill();
                    ctx.strokeStyle = "white"; ctx.lineWidth = 5; ctx.stroke();
                    
                    ctx.fillStyle = "white"; ctx.font = "bold 38px Fredoka"; ctx.textAlign = "center"; ctx.shadowBlur = 0;
                    ctx.fillText(b.text, 0, 14);
                    ctx.restore();
                });
            }
        }

        this.data.particles.forEach(p => {
            ctx.save(); ctx.globalAlpha = Math.min(1.0, p.life); ctx.translate(p.x, p.y);
            if(p.isCoin) {
                ctx.rotate(p.rotation); ctx.fillStyle = COLORS.gold;
                ctx.beginPath(); ctx.ellipse(0, 0, p.radius, p.radius * Math.abs(Math.sin(p.rotation*2)), 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 2; ctx.stroke();
            } else {
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });
        ctx.globalAlpha = 1.0;

        if (this.gameState !== 'PLAYING' && this.gameState !== 'SUCCESS') {
            ctx.font = "40px Fredoka"; ctx.fillText("🔬", this.data.keys['mX'] || 0, this.data.keys['mY'] || 0);
        }
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
    }

    loop(now) {
        const dt = Math.min((now - (this.lastTime || now)) / 1000, 0.1);
        this.lastTime = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }
}

new PotionsLabGame();
