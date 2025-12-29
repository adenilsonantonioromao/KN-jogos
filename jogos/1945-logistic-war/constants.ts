
export const GRID_SIZE = 4;

export const YEAR_MAP: Record<number, string> = {
  2: "1935",
  4: "1936",
  8: "1937",
  16: "1938",
  32: "1939",
  64: "1940",
  128: "1941",
  256: "1942",
  512: "1943",
  1024: "1944",
  2048: "1945",
  4096: "VITÓRIA",
  8192: "GLÓRIA",
};

export const TILE_COLORS: Record<number, string> = {
  // Gradiente do Verde (1935) ao Vermelho (1945)
  2: "bg-[#7a8d6b] text-[#1a1c14] border-[#4e5a3c]",    // Verde Musgo Pálido
  4: "bg-[#5d6d4a] text-[#f0f5e1] border-[#3a452e]",    // Verde Militar Médio
  8: "bg-[#4a5a3c] text-[#f0f5e1] border-[#2d3822]",    // Verde Floresta Profundo
  16: "bg-[#8b8b5a] text-[#1a1c14] border-[#5d5d3c]",   // Ocre/Oliva (Transição)
  32: "bg-[#a68c54] text-[#1a1c14] border-[#7d693f]",   // Bronze/Deserto
  64: "bg-[#b87a4d] text-[#f0f5e1] border-[#8a5b3a]",   // Terra Queimada
  128: "bg-[#ca663a] text-[#f0f5e1] border-[#974d2b]",  // Laranja de Conflito
  256: "bg-[#d44d2e] text-[#f0f5e1] border-[#9e3922]",  // Laranja Avermelhado
  512: "bg-[#b83227] text-[#f0f5e1] border-[#8a251d]",  // Vermelho Sangue
  1024: "bg-[#911d15] text-[#f0f5e1] border-[#6d150f]", // Vermelho Carmim Profundo
  2048: "bg-[#640a05] text-[#f0f5e1] border-[#3a0603] shadow-[0_0_25px_rgba(100,10,5,0.6)]", // Vermelho Negro (1945)
};
