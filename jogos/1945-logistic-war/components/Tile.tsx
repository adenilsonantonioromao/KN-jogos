
import React, { useEffect, useState } from 'react';
import { TileData } from '../types';
import { YEAR_MAP, TILE_COLORS } from '../constants';

interface TileProps {
  data: TileData;
}

const Tile: React.FC<TileProps> = ({ data }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (data.mergedFrom) {
      setScale(1.15);
      const timer = setTimeout(() => setScale(1), 150);
      return () => clearTimeout(timer);
    } else {
      setScale(0.1);
      const timer = setTimeout(() => setScale(1), 100);
      return () => clearTimeout(timer);
    }
  }, [data.mergedFrom, data.id]);

  const yearLabel = YEAR_MAP[data.value] || data.value.toString();
  const colorClass = TILE_COLORS[data.value] || "bg-slate-900 text-white";

  const x = data.col * 100;
  const y = data.row * 100;

  return (
    <div 
      className="absolute w-1/4 h-1/4 p-[6px] transition-all duration-150 ease-in-out z-20"
      style={{
        transform: `translate(${x}%, ${y}%)`,
      }}
    >
      <div 
        className={`w-full h-full rounded-sm flex flex-col items-center justify-center transition-transform duration-100 ${colorClass} relative group shadow-lg border-b-4 border-r-2 tile-inner`}
        style={{ transform: `scale(${scale})` }}
      >
        {/* Detalhes de Parafuso/Militar */}
        <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-black/40 rounded-full border border-white/5" />
        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-black/40 rounded-full border border-white/5" />
        <div className="absolute bottom-1 left-1 w-1.5 h-1.5 bg-black/40 rounded-full border border-white/5" />
        <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-black/40 rounded-full border border-white/5" />

        <span className={`text-xl md:text-2xl font-black font-mono tracking-tighter stencil-stamp ${data.value >= 128 ? 'scale-110' : ''}`}>
          {yearLabel}
        </span>
        
        {data.value >= 8 && (
          <div className="absolute top-2 w-full flex justify-center opacity-30">
            <div className="w-1/2 h-[1px] bg-current" />
          </div>
        )}
        
        {data.value >= 128 && (
          <div className="flex gap-1 mt-1">
            <div className="w-2 h-1 bg-current opacity-40 rounded-full" />
            <div className="w-2 h-1 bg-current opacity-40 rounded-full" />
            <div className="w-2 h-1 bg-current opacity-40 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Tile;
