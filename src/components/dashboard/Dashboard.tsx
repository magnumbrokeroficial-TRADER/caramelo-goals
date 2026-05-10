'use client';

import { useState, useEffect } from 'react';
import MainChart from '@/components/charts/MainChart';
import MosaicTiles from '@/components/mosaic/MosaicTiles';

export default function Dashboard() {
  const [dados, setDados] = useState<any[]>([]);
  const [sinais, setSinais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/signals')
      .then(r => r.json())
      .then(data => {
        // Constrói série temporal a partir dos dados de odds
        const startTime = Math.floor(Date.now() / 1000) - data.serie_over25.length * 240;
        const chartData = data.serie_over25.map((v: number, i: number) => ({
          time: startTime + i * 240,
          value: v,
        }));
        setDados(chartData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-200">
      <header className="bg-[#141414] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-amber-400">⚽ caramelo.goals</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">🏆 Copa</span>
          <span className="text-xs text-green-400">● SCANNER ATIVO</span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-48 bg-[#141414] border-r border-[#1f1f1f] p-3 hidden lg:block">
          <h3 className="text-xs text-gray-500 mb-2">MERCADOS</h3>
          {['Gols', 'Over 2.5', 'Under Gols', 'Ambas Marcam', 'Resultado FT', 'Resultado HT'].map(m => (
            <div key={m} className="text-sm px-2 py-1 rounded hover:bg-[#1f1f1f] cursor-pointer">{m}</div>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">⏳ Carregando dados reais do DarkOdds...</div>
          ) : (
            <>
              <div className="p-4">
                <MainChart
                  dados={dados}
                  bandas={{ upper: [], middle: [], lower: [] }}
                  mm9={[]}
                  rsi={[]}
                  mom={[]}
                  sinais={sinais}
                />
              </div>
              <MosaicTiles tiles={[]} />
            </>
          )}
        </main>
      </div>

      <footer className="bg-[#141414] border-t border-[#1f1f1f] px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>SCANNER · 10 padrões ativos</span>
        <span className="ml-auto">DarkOdds v2.0 · Dados reais Bet365</span>
      </footer>
    </div>
  );
}
