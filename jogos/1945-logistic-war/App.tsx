
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Direction, GameState } from './types';
import { createEmptyGrid, addRandomTile, moveTiles, canMove } from './gameLogic';
import GameContainer from './components/GameContainer';
import { SoundManager } from './audio';

const sound = new SoundManager();

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [musicActive, setMusicActive] = useState(true);
  const [gameState, setGameState] = useState<GameState>(() => {
    let initialGrid = createEmptyGrid();
    initialGrid = addRandomTile(initialGrid);
    initialGrid = addRandomTile(initialGrid);
    const savedBest = localStorage.getItem('wwii-best-score');
    return {
      grid: initialGrid,
      score: 0,
      bestScore: savedBest ? parseInt(savedBest) : 0,
      gameOver: false,
      won: false,
      keepPlaying: false,
    };
  });

  const triggerStart = useCallback(() => {
    if (!gameStarted) {
      setGameStarted(true);
      sound.startBGM();
      sound.playMorse('start');
    }
  }, [gameStarted]);

  useEffect(() => {
    if (gameState.gameOver) {
      window.parent.postMessage({ 
        type: 'GAME_OVER', 
        score: Math.floor(gameState.score) 
      }, '*');
    }
  }, [gameState.gameOver, gameState.score]);

  const toggleMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const active = sound.toggleMusic();
    setMusicActive(active);
  };

  const handleNewGame = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let initialGrid = createEmptyGrid();
    initialGrid = addRandomTile(initialGrid);
    initialGrid = addRandomTile(initialGrid);
    
    setGameState(prev => ({
      ...prev,
      grid: initialGrid,
      score: 0,
      gameOver: false,
      won: false,
      keepPlaying: false,
    }));
    sound.playMorse('start');
  }, []);

  const handleMove = useCallback((direction: Direction) => {
    if (!gameStarted) return;
    setGameState(prev => {
      if (prev.gameOver || (prev.won && !prev.keepPlaying)) return prev;
      const result = moveTiles(prev.grid, direction);
      if (!result.moved) return prev;

      if (result.score > 0) sound.playMorse('fusion');
      else sound.playMorse('move');

      let nextGrid = addRandomTile(result.grid);
      const nextScore = prev.score + result.score;
      const nextBest = Math.max(nextScore, prev.bestScore);
      
      if (nextBest > prev.bestScore) {
        localStorage.setItem('wwii-best-score', nextBest.toString());
      }

      let winFound = false;
      if (!prev.won) {
        for (const row of nextGrid) {
          for (const tile of row) {
            if (tile && tile.value === 2048) {
              winFound = true;
              break;
            }
          }
          if (winFound) break;
        }
      }
      const over = !canMove(nextGrid);
      return { ...prev, grid: nextGrid, score: nextScore, bestScore: nextBest, won: prev.won || winFound, gameOver: over };
    });
  }, [gameStarted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted) {
        if (e.key === 'Enter') triggerStart();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': handleMove(Direction.UP); break;
        case 'ArrowDown': handleMove(Direction.DOWN); break;
        case 'ArrowLeft': handleMove(Direction.LEFT); break;
        case 'ArrowRight': handleMove(Direction.RIGHT); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove, gameStarted, triggerStart]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { 
    if (!gameStarted) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? Direction.RIGHT : Direction.LEFT);
      else handleMove(dy > 0 ? Direction.DOWN : Direction.UP);
    }
    touchStart.current = null;
  };

  if (!gameStarted) {
    return (
      <div 
        className="min-h-screen w-full flex flex-col items-center justify-center bg-black p-4 cursor-pointer"
        onClick={triggerStart}
      >
        <div className="max-w-md w-full border-8 border-[#3d4234] p-10 bg-[#1a1c14] shadow-[0_0_60px_rgba(0,0,0,1)] relative overflow-hidden group">
          <div className="absolute top-2 right-2 p-2 text-[10px] text-[#3d4234] font-mono font-bold tracking-widest border border-[#3d4234]/30">ALTAMENTE CONFIDENCIAL // 1945</div>
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-[#8b9d77]/5 rotate-45 pointer-events-none"></div>
          
          <h1 className="text-5xl font-black text-[#8b9d77] stencil-text text-center leading-none mb-6 tracking-tighter uppercase flicker">
            1945<br/><span className="text-3xl text-[#5d664c]">Logistic War</span>
          </h1>
          
          <div className="w-full h-2 bg-[#3d4234] relative mb-8">
            <div className="absolute inset-0 bg-[#8b9d77]/20 animate-pulse"></div>
          </div>
          
          <div className="space-y-6 mb-10 text-center">
            <p className="text-[#a8b397] text-xs font-mono leading-relaxed border-l-2 border-[#4e661a] pl-4 text-left">
              "As guerras são vencidas pelo amador na tática e pelo profissional na logística."
            </p>
            <div className="flex justify-center gap-4 text-[#d9e3c8] text-sm font-bold uppercase tracking-[0.2em]">
              <span>MCMXXXV</span>
              <span className="text-[#5d664c]">●</span>
              <span>MCMXLV</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="bg-[#4e661a]/10 border border-[#4e661a]/30 px-6 py-3 rounded animate-pulse">
              <span className="text-[#8b9d77] font-bold text-sm uppercase tracking-[0.4em]">Toque para Mobilizar</span>
            </div>
            <div className="text-[10px] text-[#3d4234] uppercase font-mono tracking-widest">
              Comando Geral Aliado // Linha Segura Ativa
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-start py-8 px-4 text-[#d9e3c8] selection:bg-[#4e661a] overflow-x-hidden" 
      onTouchStart={onTouchStart} 
      onTouchEnd={onTouchEnd} 
    >
      <div className="max-w-lg w-full">
        <header className="flex justify-between items-center mb-6 bg-[#1a1c14]/90 p-5 border-2 border-[#3d4234] rounded shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#8b9d77]/20"></div>
          <div>
            <h1 className="text-4xl font-black text-[#8b9d77] stencil-text tracking-tighter leading-none border-b-2 border-[#8b9d77]/30 pb-1">1945 LW</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5d664c] font-bold mt-2">Divisão Logística</p>
          </div>
          <div className="flex flex-col gap-2">
            <ScoreBox label="Pontos" value={gameState.score} />
            <ScoreBox label="Recorde" value={gameState.bestScore} />
          </div>
        </header>

        <div className="bg-[#1a1c14]/60 p-3 rounded-t-lg border-x-2 border-t-2 border-[#3d4234] flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-[#8b9d77] uppercase tracking-widest mb-0.5">Estado:</span>
            <span className="text-xs text-[#d9e3c8] font-mono tracking-widest animate-pulse">OPERACIONAL // MCMXLV</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleMusic}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded border-2 transition-all shadow-md active:scale-95 ${musicActive ? 'bg-[#4e661a]/20 border-green-500 text-green-400' : 'bg-[#1a1c14] border-[#3d4234] text-[#5d664c]'}`}
            >
              <div className={`w-2 h-2 rounded-full mb-1 ${musicActive ? 'bg-green-500 animate-pulse shadow-[0_0_8px_green]' : 'bg-red-900'}`}></div>
              <span className="text-[8px] font-bold uppercase leading-tight text-center">Rádio<br/>{musicActive ? 'LIG' : 'DES'}</span>
            </button>

            <button 
              onClick={handleNewGame} 
              className="bg-[#4e3b31] hover:bg-[#5e4b41] text-[#f0f5e1] px-5 py-3 h-14 rounded-sm font-bold uppercase text-xs border-b-4 border-[#2a1f1a] active:translate-y-0.5 active:border-b-2 transition-all shadow-xl"
            >
              Nova<br/>Campanha
            </button>
          </div>
        </div>

        <GameContainer 
          grid={gameState.grid} 
          gameOver={gameState.gameOver}
          won={gameState.won && !gameState.keepPlaying}
          onRetry={() => handleNewGame()}
          onContinue={() => setGameState(p => ({ ...p, keepPlaying: true }))}
        />

        <section className="mt-8 space-y-4">
          <div className="bg-[#1a1c14]/90 p-5 border-l-4 border-[#4e661a] rounded-r shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-[#8b9d77] rotate-45"></div>
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b9d77]">Briefing Tático</h2>
            </div>
            <div className="text-[#a8b397] text-[11px] leading-relaxed font-mono space-y-4">
              <p>
                <strong className="text-[#d9e3c8] border-b border-[#d9e3c8]/20">GESTÃO LOGÍSTICA:</strong><br/>
                Navegue suas divisões usando as <span className="text-[#d9e3c8]">SETAS</span> ou <span className="text-[#d9e3c8]">DESLIZE</span>. Cada movimento aciona o destacamento de tropas (1935/1936) em setores vazios da grade.
              </p>
              <p>
                <strong className="text-[#d9e3c8] border-b border-[#d9e3c8]/20">SUPERIORIDADE TECNOLÓGICA:</strong><br/>
                Una anos idênticos para avançar sua tecnologia. O espectro de cores muda do <span className="text-[#7a8d6b] font-bold">Verde Oliva (1935)</span> ao <span className="text-[#640a05] font-bold">Vermelho de Batalha (1945)</span>.
              </p>
              <p>
                <strong className="text-[#d9e3c8] border-b border-[#d9e3c8]/20">VITÓRIA FINAL:</strong><br/>
                Alcance o ano de <span className="text-[#d4af37] font-bold underline">1945</span> para garantir a rendição incondicional e vencer a guerra. A saturação da grade significa falha logística total.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center border-t border-[#3d4234] pt-6 pb-20">
          <p className="text-[9px] text-[#5d664c] uppercase tracking-[0.5em] font-mono">
            COMANDO LOGÍSTICO ALIADO // LINHA SEGURA 0945 // FIM
          </p>
        </footer>
      </div>
    </div>
  );
};

const ScoreBox: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-[#2a2e21] p-2 min-w-[100px] rounded border border-[#3d4234] text-center flex flex-col items-center shadow-inner">
    <span className="text-[9px] uppercase font-bold text-[#5d664c] mb-1">{label}</span>
    <span className="text-xl font-black text-[#d9e3c8] font-mono tracking-tighter">{value}</span>
  </div>
);

export default App;
