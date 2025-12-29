
import React from 'react';
import { Grid } from '../types';
import Tile from './Tile';

interface GameContainerProps {
  grid: Grid;
  gameOver: boolean;
  won: boolean;
  onRetry: () => void;
  onContinue: () => void;
}

const GameContainer: React.FC<GameContainerProps> = ({ grid, gameOver, won, onRetry, onContinue }) => {
  const allTiles = grid.flatMap(row => row.filter(tile => tile !== null));

  return (
    <div className="relative bg-[#1a1c14] p-3 rounded-md shadow-2xl overflow-hidden aspect-square border-[10px] border-[#3d4234] ring-2 ring-black/40">
      {/* Grade de Fundo Estilizada como Radar/Mapa Militar */}
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-3 p-3 opacity-20">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="bg-black/40 rounded border border-[#8b9d77]/20 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_90%,rgba(139,157,119,0.1)_95%)]" />
            <div className="w-1 h-1 bg-[#8b9d77]/30 rounded-full"></div>
          </div>
        ))}
      </div>

      {/* Camada de Tiles */}
      <div className="relative w-full h-full z-10">
        {allTiles.map((tile) => (
          tile && <Tile key={tile.id} data={tile} />
        ))}
      </div>

      {/* OVERLAY: DERROTA */}
      {gameOver && (
        <div className="absolute inset-0 z-50 bg-[#1a0505]/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="border-4 border-red-600 p-4 mb-4 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
            <h2 className="text-5xl font-black text-red-600 stencil-text tracking-tighter stencil-stamp">FRACASSO</h2>
          </div>
          <p className="text-red-200/70 mb-8 uppercase tracking-[0.2em] text-xs font-bold leading-relaxed max-w-[250px]">
            O front colapsou. Reorganize suas divisões para uma nova tentativa.
          </p>
          <button 
            onClick={onRetry}
            className="bg-red-700 text-white px-10 py-4 rounded-sm font-black uppercase text-sm shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:bg-red-600 active:scale-95 transition-all border-b-4 border-red-900"
          >
            Nova Campanha
          </button>
        </div>
      )}

      {/* OVERLAY: VITÓRIA */}
      {won && (
        <div className="absolute inset-0 z-50 bg-[#2a2e21]/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-300">
          <div className="border-4 border-[#d4af37] p-4 mb-4 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            <h2 className="text-5xl font-black text-[#d4af37] stencil-text tracking-tighter stencil-stamp">DIA DA VITÓRIA</h2>
          </div>
          <p className="text-[#d9e3c8] mb-8 uppercase tracking-[0.2em] text-xs font-bold leading-relaxed max-w-[250px]">
            1945: Vitória absoluta. O mundo celebra o fim do conflito.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[200px]">
            <button 
              onClick={onContinue}
              className="bg-[#3d4234] text-[#d9e3c8] px-4 py-3 rounded-sm font-bold uppercase text-[10px] shadow-lg hover:bg-[#4b533a] transition-colors border-b-2 border-black"
            >
              Manter Ocupação
            </button>
            <button 
              onClick={onRetry}
              className="bg-[#d4af37] text-black px-4 py-3 rounded-sm font-bold uppercase text-[10px] shadow-lg hover:bg-[#e5c158] transition-colors border-b-2 border-[#b8860b]"
            >
              Próximo Teatro de Guerra
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameContainer;
