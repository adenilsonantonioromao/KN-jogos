
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GamePhase, ChildState, Vector2D, Child, Obstacle, Monster, Particle, ClockItem } from './types';
import { audio } from './audioService';

const WORLD_WIDTH = 1500;
const WORLD_HEIGHT = 2500;
const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 800;

const BASE_SIZE = 180; 
const PLAYER_SPEED = 260;
const MONSTER_SPEED = 105; 
const MONSTER_ACTIVATE_TIME = 40; 
const CHILD_SPEED_HIDING = 190;
const CHILD_SPEED_FLEEING = 285;
const VISION_CONE_ANGLE = Math.PI / 4;
const VISION_DISTANCE = 350;
const CHILD_DETECTION_RADIUS = 110;

const TOTAL_CHILDREN = 20;
const CHILD_SCORE = 50;
const CLOCK_BONUS_SECONDS = 5;
const CLOCK_SPAWN_INTERVAL = 10;

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.START);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [processedCount, setProcessedCount] = useState(0);
  const [timer, setTimer] = useState(60);

  const gameState = useRef({
    player: { pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }, angle: -Math.PI / 2, radius: 15 },
    camera: { x: WORLD_WIDTH / 2 - VIEW_WIDTH / 2, y: WORLD_HEIGHT / 2 - VIEW_HEIGHT / 2 },
    monster: {
      id: 'stalker',
      pos: { x: 0, y: 0 },
      radius: 26,
      color: '#1a0033',
      active: false,
      teleportTimer: 7,
      isTeleporting: false,
      opacity: 0
    } as Monster,
    particles: [] as Particle[],
    clocks: [] as ClockItem[],
    children: [] as Child[],
    obstacles: [] as Obstacle[],
    keys: new Set<string>(),
    joystick: { active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } },
    base: { 
      x: WORLD_WIDTH / 2 - BASE_SIZE / 2, 
      y: WORLD_HEIGHT / 2 - BASE_SIZE / 2, 
      w: BASE_SIZE, 
      h: BASE_SIZE 
    },
    lastTime: performance.now(),
    footstepTimer: 0,
    clockSpawnTimer: 0,
    worldCenter: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    gameElapsedTime: 0
  });

  const getExtremityPos = (): Vector2D => {
    const margin = 200;
    const side = Math.floor(Math.random() * 4);
    switch(side) {
      case 0: return { x: Math.random() * WORLD_WIDTH, y: Math.random() * margin };
      case 1: return { x: WORLD_WIDTH - (Math.random() * margin), y: Math.random() * WORLD_HEIGHT };
      case 2: return { x: Math.random() * WORLD_WIDTH, y: WORLD_HEIGHT - (Math.random() * margin) };
      case 3: default: return { x: Math.random() * margin, y: Math.random() * WORLD_HEIGHT };
    }
  };

  const generateObstacles = () => {
    const obs: Obstacle[] = [];
    const types: ('house' | 'tree' | 'car' | 'bush')[] = ['house', 'tree', 'car', 'bush'];
    const colors = { house: '#4e342e', tree: '#1b5e20', car: '#0d47a1', bush: '#2e7d32' };
    for (let i = 0; i < 60; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const w = type === 'house' ? 140 : type === 'car' ? 90 : 50;
      const h = type === 'house' ? 120 : type === 'car' ? 60 : 50;
      const x = Math.random() * (WORLD_WIDTH - w);
      const y = Math.random() * (WORLD_HEIGHT - h);
      const distToBase = Math.sqrt(Math.pow(x - WORLD_WIDTH/2, 2) + Math.pow(y - WORLD_HEIGHT/2, 2));
      if (distToBase > 300) {
        obs.push({ x, y, w, h, color: colors[type], type });
      }
    }
    return obs;
  };

  const initLevel = useCallback(() => {
    gameState.current.obstacles = generateObstacles();
    gameState.current.particles = [];
    gameState.current.clocks = [];
    gameState.current.children = Array.from({ length: TOTAL_CHILDREN }).map((_, i) => ({
      id: `child-${i}`,
      pos: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
      radius: 12,
      color: '#ff1744',
      state: ChildState.HIDING,
      targetPos: getExtremityPos(),
      speed: CHILD_SPEED_HIDING
    }));

    gameState.current.player.pos = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    gameState.current.monster.active = false;
    gameState.current.monster.opacity = 0;
    gameState.current.monster.teleportTimer = 7;
    gameState.current.keys.clear();
    gameState.current.gameElapsedTime = 0;
    gameState.current.clockSpawnTimer = 0;
    setScore(0);
    setProcessedCount(0);
    setCountdown(10);
    setTimer(60);
    setPhase(GamePhase.COUNTDOWN);
    gameState.current.lastTime = performance.now();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => gameState.current.keys.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => gameState.current.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const checkCollision = (nx: number, ny: number, radius: number) => {
    for (const obs of gameState.current.obstacles) {
      if (nx + radius > obs.x && nx - radius < obs.x + obs.w &&
          ny + radius > obs.y && ny - radius < obs.y + obs.h) {
        return true;
      }
    }
    return false;
  };

  const update = (dt: number) => {
    if (phase === GamePhase.START || phase === GamePhase.GAME_OVER || phase === GamePhase.MONSTER_KILLED) return;

    const gs = gameState.current;

    for (let i = gs.particles.length - 1; i >= 0; i--) {
      const p = gs.particles[i];
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.life -= dt * 0.8;
      if (p.life <= 0) gs.particles.splice(i, 1);
    }

    if (phase === GamePhase.SEEKING) {
      // Atualizar Timer
      setTimer(prev => {
        const next = prev - dt;
        if (next <= 0) {
          setPhase(GamePhase.GAME_OVER);
          return 0;
        }
        return next;
      });

      // Spawn de Relógios
      gs.clockSpawnTimer += dt;
      if (gs.clockSpawnTimer >= CLOCK_SPAWN_INTERVAL) {
        gs.clockSpawnTimer = 0;
        gs.clocks.push({
          pos: { 
            x: 100 + Math.random() * (WORLD_WIDTH - 200),
            y: 100 + Math.random() * (WORLD_HEIGHT - 200)
          },
          radius: 18,
          active: true
        });
      }

      gs.gameElapsedTime += dt;
      if (!gs.monster.active && gs.gameElapsedTime > MONSTER_ACTIVATE_TIME) {
        gs.monster.active = true;
        gs.monster.pos = getExtremityPos();
        audio.playMonsterTeleport();
      }
    }

    if (phase === GamePhase.SEEKING) {
      let dx = 0; let dy = 0;
      if (gs.keys.has('arrowup') || gs.keys.has('w')) dy -= 1;
      if (gs.keys.has('arrowdown') || gs.keys.has('s')) dy += 1;
      if (gs.keys.has('arrowleft') || gs.keys.has('a')) dx -= 1;
      if (gs.keys.has('arrowright') || gs.keys.has('d')) dx += 1;

      if (gs.joystick.active) {
        const jdx = gs.joystick.current.x - gs.joystick.start.x;
        const jdy = gs.joystick.current.y - gs.joystick.start.y;
        const dist = Math.sqrt(jdx * jdx + jdy * jdy);
        if (dist > 10) { dx = jdx / dist; dy = jdy / dist; }
      }

      if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        const vx = (dx / mag) * PLAYER_SPEED * dt;
        const vy = (dy / mag) * PLAYER_SPEED * dt;
        if (!checkCollision(gs.player.pos.x + vx, gs.player.pos.y, gs.player.radius)) {
          gs.player.pos.x = Math.max(gs.player.radius, Math.min(WORLD_WIDTH - gs.player.radius, gs.player.pos.x + vx));
        }
        if (!checkCollision(gs.player.pos.x, gs.player.pos.y + vy, gs.player.radius)) {
          gs.player.pos.y = Math.max(gs.player.radius, Math.min(WORLD_HEIGHT - gs.player.radius, gs.player.pos.y + vy));
        }
        gs.player.angle = Math.atan2(dy, dx);
        gs.footstepTimer += dt;
        if (gs.footstepTimer > 0.22) { audio.playFootstep(); gs.footstepTimer = 0; }
      }

      // Colisão com Relógios
      for (let i = gs.clocks.length - 1; i >= 0; i--) {
        const clock = gs.clocks[i];
        const dist = Math.sqrt(Math.pow(gs.player.pos.x - clock.pos.x, 2) + Math.pow(gs.player.pos.y - clock.pos.y, 2));
        if (dist < gs.player.radius + clock.radius) {
          setTimer(t => t + CLOCK_BONUS_SECONDS);
          gs.clocks.splice(i, 1);
          audio.playWin();
        }
      }

      const targetCamX = gs.player.pos.x - VIEW_WIDTH / 2;
      const targetCamY = gs.player.pos.y - VIEW_HEIGHT / 2;
      gs.camera.x += (targetCamX - gs.camera.x) * 0.1;
      gs.camera.y += (targetCamY - gs.camera.y) * 0.1;
      gs.camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, gs.camera.x));
      gs.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, gs.camera.y));

      const playerInBaseZone = gs.player.pos.x > gs.base.x && gs.player.pos.x < gs.base.x + gs.base.w &&
                               gs.player.pos.y > gs.base.y && gs.player.pos.y < gs.base.y + gs.base.h;

      if (playerInBaseZone) {
        gs.children.forEach(child => {
          if (child.state === ChildState.RUNNING_TO_BASE) {
            child.state = ChildState.CAPTURED;
            child.color = '#00b0ff'; 
            child.pos = { 
              x: gs.base.x + 20 + Math.random() * (gs.base.w - 40),
              y: gs.base.y + 20 + Math.random() * (gs.base.h - 40)
            };
            setScore(s => s + CHILD_SCORE); 
            setProcessedCount(c => c + 1);
            audio.playWin();
          }
        });
      }
    }

    if (gs.monster.active && phase === GamePhase.SEEKING) {
      if (Math.random() > 0.2) {
        gs.particles.push({
          pos: { x: gs.monster.pos.x + (Math.random() - 0.5) * 20, y: gs.monster.pos.y + (Math.random() - 0.5) * 20 },
          vel: { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 - 20 },
          life: 1.0,
          size: 10 + Math.random() * 18
        });
      }

      if (gs.monster.isTeleporting) {
        gs.monster.opacity -= dt * 2;
        if (gs.monster.opacity <= 0) {
          gs.monster.pos = {
            x: gs.player.pos.x + (Math.random() - 0.5) * 600,
            y: gs.player.pos.y + (Math.random() - 0.5) * 600
          };
          gs.monster.isTeleporting = false;
          audio.playMonsterTeleport();
        }
      } else {
        gs.monster.opacity = Math.min(1, gs.monster.opacity + dt * 2);
        const mdx = gs.player.pos.x - gs.monster.pos.x;
        const mdy = gs.player.pos.y - gs.monster.pos.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        
        if (mdist < gs.player.radius + gs.monster.radius - 8) {
          setScore(s => Math.floor(s / 2));
          setPhase(GamePhase.MONSTER_KILLED);
          audio.playLose();
          return;
        }

        gs.monster.pos.x += (mdx / mdist) * MONSTER_SPEED * dt;
        gs.monster.pos.y += (mdy / mdist) * MONSTER_SPEED * dt;
        
        gs.monster.teleportTimer -= dt;
        if (gs.monster.teleportTimer <= 0) {
          gs.monster.isTeleporting = true;
          gs.monster.teleportTimer = 6 + Math.random() * 4;
        }
      }
    }

    gs.children.forEach(child => {
      if (child.state === ChildState.HIDING) {
        if (phase === GamePhase.SEEKING) {
          child.state = ChildState.HIDDEN;
          return;
        }
        const dx = child.targetPos.x - child.pos.x;
        const dy = child.targetPos.y - child.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 20) child.targetPos = getExtremityPos();
        else {
          child.pos.x += (dx / d) * child.speed * dt;
          child.pos.y += (dy / d) * child.speed * dt;
        }
      } 
      else if (child.state === ChildState.HIDDEN && phase === GamePhase.SEEKING) {
        const pdx = child.pos.x - gs.player.pos.x;
        const pdy = child.pos.y - gs.player.pos.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        const ang = Math.atan2(pdy, pdx);
        let diff = Math.abs(ang - gs.player.angle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if ((pdist < VISION_DISTANCE && diff < VISION_CONE_ANGLE) || pdist < CHILD_DETECTION_RADIUS) {
          child.state = ChildState.RUNNING_TO_BASE;
          child.speed = CHILD_SPEED_FLEEING; 
          child.targetPos = { x: gs.worldCenter.x, y: gs.worldCenter.y };
          audio.playAlert();
        }
      } 
      else if (child.state === ChildState.RUNNING_TO_BASE) {
        const childInBaseZone = child.pos.x > gs.base.x && child.pos.x < gs.base.x + gs.base.w &&
                                child.pos.y > gs.base.y && child.pos.y < gs.base.y + gs.base.h;
        if (childInBaseZone) {
          child.state = ChildState.SAVED;
          child.color = '#ff1744'; 
          child.pos = { x: gs.base.x + 20 + Math.random() * (gs.base.w - 40), y: gs.base.y + 20 + Math.random() * (gs.base.h - 40) };
          setProcessedCount(c => c + 1);
          audio.playLose();
        } else {
          const tDx = gs.worldCenter.x - child.pos.x;
          const tDy = gs.worldCenter.y - child.pos.y;
          const dist = Math.sqrt(tDx * tDx + tDy * tDy);
          let moveX = tDx / dist;
          let moveY = tDy / dist;
          if (checkCollision(child.pos.x + moveX * 40, child.pos.y + moveY * 40, child.radius)) {
            const temp = moveX; moveX = -moveY; moveY = temp;
          }
          child.pos.x += moveX * child.speed * dt;
          child.pos.y += moveY * child.speed * dt;
        }
      }
    });

    if (processedCount >= TOTAL_CHILDREN && phase === GamePhase.SEEKING) {
      setPhase(GamePhase.GAME_OVER);
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const gs = gameState.current;
    const camX = gs.camera.x;
    const camY = gs.camera.y;

    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.save();
    ctx.translate(-camX, -camY);

    ctx.strokeStyle = '#244a1f';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += 150) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 150) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 235, 59, 0.15)';
    ctx.fillRect(gs.base.x, gs.base.y, gs.base.w, gs.base.h);
    ctx.strokeStyle = '#fdd835';
    ctx.lineWidth = 4;
    ctx.strokeRect(gs.base.x, gs.base.y, gs.base.w, gs.base.h);

    gs.obstacles.forEach(o => {
      ctx.fillStyle = o.color;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(o.x, o.y + o.h - 12, o.w, 12);
    });

    // Desenhar Relógios
    gs.clocks.forEach(c => {
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fbc02d'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.fillRect(c.pos.x - 1, c.pos.y - 10, 2, 10);
      ctx.fillRect(c.pos.x - 1, c.pos.y - 1, 8, 2);
    });

    gs.particles.forEach(p => {
      ctx.globalAlpha = p.life * 0.4;
      ctx.fillStyle = '#1a0033';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size * (1.5 - p.life), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    gs.children.forEach(c => {
      if (c.state === ChildState.HIDDEN && phase === GamePhase.SEEKING) return;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'white';
      ctx.beginPath(); ctx.arc(c.pos.x - 4, c.pos.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(c.pos.x + 4, c.pos.y - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath(); ctx.arc(c.pos.x - 4, c.pos.y - 2, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(c.pos.x + 4, c.pos.y - 2, 1, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#00b0ff';
    ctx.beginPath(); ctx.arc(gs.player.pos.x, gs.player.pos.y, gs.player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(gs.player.pos.x, gs.player.pos.y);
    ctx.rotate(gs.player.angle + Math.PI/2);
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(-5, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(-5, -5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.restore();

    if (phase === GamePhase.SEEKING) {
      const darkCanvas = document.createElement('canvas');
      darkCanvas.width = VIEW_WIDTH; darkCanvas.height = VIEW_HEIGHT;
      const dctx = darkCanvas.getContext('2d')!;
      
      const darknessLevel = 0.75; 
      dctx.fillStyle = `rgba(0, 0, 0, ${darknessLevel})`;
      dctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      
      dctx.globalCompositeOperation = 'destination-out';
      const px = gs.player.pos.x - camX;
      const py = gs.player.pos.y - camY;
      
      dctx.beginPath();
      dctx.moveTo(px, py);
      dctx.arc(px, py, VISION_DISTANCE, gs.player.angle - VISION_CONE_ANGLE, gs.player.angle + VISION_CONE_ANGLE);
      dctx.closePath(); dctx.fill();
      
      const radial = dctx.createRadialGradient(px, py, 5, px, py, 130);
      radial.addColorStop(0, 'rgba(255, 255, 255, 1)');
      radial.addColorStop(1, 'rgba(255, 255, 255, 0)');
      dctx.fillStyle = radial;
      dctx.beginPath(); dctx.arc(px, py, 130, 0, Math.PI * 2); dctx.fill();
      
      ctx.drawImage(darkCanvas, 0, 0);
    }

    if (gs.monster.active && (phase === GamePhase.SEEKING || phase === GamePhase.MONSTER_KILLED)) {
      ctx.save();
      ctx.translate(-camX, -camY);
      ctx.globalAlpha = gs.monster.opacity;
      
      const pulse = Math.sin(performance.now() / 200) * 8;
      ctx.shadowBlur = 15 + pulse;
      ctx.shadowColor = '#9d00ff';
      
      ctx.fillStyle = gs.monster.color;
      ctx.beginPath();
      ctx.arc(gs.monster.pos.x, gs.monster.pos.y, gs.monster.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'red';
      ctx.fillStyle = '#ff0000';
      ctx.beginPath(); ctx.arc(gs.monster.pos.x - 8, gs.monster.pos.y - 6, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gs.monster.pos.x + 8, gs.monster.pos.y - 6, 7, 0, Math.PI * 2); ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#440000'; 
      ctx.beginPath(); ctx.arc(gs.monster.pos.x - 8, gs.monster.pos.y - 6, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(gs.monster.pos.x + 8, gs.monster.pos.y - 6, 2, 0, Math.PI * 2); ctx.fill();
      
      ctx.restore();
    }

    if (gs.joystick.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(gs.joystick.start.x, gs.joystick.start.y, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();
      ctx.beginPath(); ctx.arc(gs.joystick.current.x, gs.joystick.current.y, 35, 0, Math.PI * 2); ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let anim: number;
    const loop = (t: number) => {
      const dt = (t - gameState.current.lastTime) / 1000;
      gameState.current.lastTime = t;
      update(Math.min(dt, 0.1));
      draw(ctx);
      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [phase, processedCount]);

  useEffect(() => {
    if (phase === GamePhase.COUNTDOWN) {
      const t = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(t); setPhase(GamePhase.SEEKING); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(t);
    }
  }, [phase]);

  const startInput = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (clientX - r.left) * (VIEW_WIDTH / r.width);
    const y = (clientY - r.top) * (VIEW_HEIGHT / r.height);
    gameState.current.joystick = { active: true, start: { x, y }, current: { x, y } };
  };

  const moveInput = (clientX: number, clientY: number) => {
    if (!gameState.current.joystick.active) return;
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = (clientX - r.left) * (VIEW_WIDTH / r.width);
    const y = (clientY - r.top) * (VIEW_HEIGHT / r.height);
    gameState.current.joystick.current = { x, y };
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-white select-none touch-none overflow-hidden p-2 font-['Creepster']">
      <div className="relative w-full max-w-[520px] aspect-[480/800] bg-black border-[12px] border-[#1a1a1a] rounded-[3.5rem] overflow-hidden shadow-[0_0_250px_rgba(0,0,0,1)]">
        
        {/* HUD de Jogo */}
        <div className="absolute top-0 left-0 w-full p-12 flex justify-between items-start pointer-events-none z-30">
          <div className="bg-black/90 backdrop-blur-3xl p-8 rounded-[2.5rem] border-4 border-purple-900/40 shadow-2xl min-w-[180px]">
            <p className="text-purple-400 text-[26px] mb-2 tracking-widest font-black uppercase horror-text">PONTOS</p>
            <p className="text-white text-4xl font-bold">{score}</p>
          </div>
          
          {/* Cronômetro Centralizado */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/90 px-10 py-4 rounded-3xl border-4 border-yellow-600/50 shadow-2xl">
            <p className="text-yellow-500 text-3xl font-bold tabular-nums">
              {Math.ceil(timer)}s
            </p>
          </div>

          <div className="bg-black/90 backdrop-blur-3xl p-8 rounded-[2.5rem] border-4 border-purple-900/40 text-right shadow-2xl min-w-[140px]">
            <p className="text-[14px] text-white/40 uppercase font-black mb-1 tracking-widest">AMIGOS</p>
            <p className="text-purple-400 text-[38px] font-black horror-text">{TOTAL_CHILDREN - processedCount}</p>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={VIEW_WIDTH} height={VIEW_HEIGHT}
          className="w-full h-full"
          onMouseDown={(e) => startInput(e.clientX, e.clientY)}
          onMouseMove={(e) => moveInput(e.clientX, e.clientY)}
          onMouseUp={() => gameState.current.joystick.active = false}
          onMouseLeave={() => gameState.current.joystick.active = false}
          onTouchStart={(e) => startInput(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => moveInput(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={() => gameState.current.joystick.active = false}
        />

        {/* Menu de Início */}
        {phase === GamePhase.START && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-14 z-40 text-center">
            <div className="w-36 h-36 bg-purple-900 rounded-[3rem] rotate-12 mb-12 flex items-center justify-center shadow-[0_0_100px_rgba(157,0,255,0.3)] border-4 border-purple-500/20 relative">
               <div className="absolute inset-0 animate-pulse bg-purple-500/10 rounded-full blur-2xl"></div>
               <div className="w-20 h-20 bg-black rounded-full border-4 border-purple-800" />
            </div>
            <h1 className="text-5xl font-black text-white mb-10 tracking-widest leading-tight uppercase horror-text">NOITE DE<br/>ESCONDE<br/>ESCONDE</h1>
            <p className="text-[16px] text-purple-400/60 mb-16 leading-relaxed uppercase tracking-[0.3em] font-bold">
              ENCONTRE 20 AMIGOS EM 60 SEGUNDOS.
              <br/><br/>
              <span className="text-yellow-500 font-black border-b-4 border-purple-900 pb-2">PEQUE OS RELÓGIOS PARA GANHAR TEMPO!</span>
            </p>
            <button onClick={() => { initLevel(); audio.playWin(); }} className="bg-purple-900 text-white px-24 py-10 text-[22px] hover:bg-purple-700 transition-all active:scale-90 shadow-[0_15px_0_#2a004a] border-b-[4px] border-purple-500/30 font-black uppercase rounded-3xl tracking-widest horror-text">
              BRINCAR NA NOITE
            </button>
          </div>
        )}

        {phase === GamePhase.COUNTDOWN && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-black/70">
            <span className="text-[18rem] font-black text-purple-800 horror-text animate-pulse">{countdown}</span>
            <p className="text-[20px] text-purple-400 mt-16 tracking-[0.8em] font-black uppercase horror-text">SE ESCONDAM!</p>
          </div>
        )}

        {/* Menu de Captura - Perde 50% dos Pontos */}
        {phase === GamePhase.MONSTER_KILLED && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-14 z-50 text-center">
            <div className="text-[12rem] mb-14 drop-shadow-[0_0_60px_purple]">👁️</div>
            <h2 className="text-6xl font-black text-purple-500 mb-10 tracking-tighter uppercase leading-tight horror-text">VOCÊ FOI<br/>ACHADO!</h2>
            <div className="bg-purple-900/20 p-8 rounded-3xl mb-12 border border-purple-500/30">
              <p className="text-white/60 uppercase tracking-widest mb-2">PONTOS RESTANTES</p>
              <p className="text-4xl font-bold">{score}</p>
            </div>
            <button onClick={() => initLevel()} className="bg-purple-950 text-white px-24 py-12 text-[20px] border-b-[12px] border-black active:translate-y-4 font-black transition-all uppercase shadow-2xl rounded-3xl horror-text tracking-widest">
              TENTAR DE NOVO
            </button>
          </div>
        )}

        {/* Menu de Fim de Jogo (Vitória ou Tempo) */}
        {phase === GamePhase.GAME_OVER && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-14 z-40 text-center">
            <h2 className="text-6xl font-black text-yellow-500 mb-14 uppercase tracking-widest horror-text">
              {processedCount >= TOTAL_CHILDREN ? "TODOS SALVOS!" : "TEMPO ESGOTADO"}
            </h2>
            <div className="bg-white/5 p-16 rounded-[4.5rem] border-4 border-yellow-900/30 mb-20 w-full shadow-2xl backdrop-blur-xl">
              <p className="text-yellow-600 text-[18px] mb-8 uppercase tracking-[0.4em] font-black">MÉRITO FINAL</p>
              <p className="text-[130px] font-black text-white tabular-nums tracking-tighter leading-none drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">{score}</p>
              <p className="text-white/20 text-[14px] mt-12 uppercase tracking-widest">AMIGOS SALVOS: {processedCount}</p>
            </div>
            <button onClick={() => initLevel()} className="bg-white text-black px-24 py-12 text-[20px] border-b-[12px] border-neutral-400 font-black hover:bg-yellow-500 hover:text-white transition-all uppercase shadow-2xl rounded-3xl tracking-widest">
              JOGAR NOVAMENTE
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
