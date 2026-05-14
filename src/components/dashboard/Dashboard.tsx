'use client';

import { useState, useEffect } from 'react';
import MainChart from '@/components/charts/MainChart';
import MosaicTiles from '@/components/mosaic/MosaicTiles';

export default function Dashboard() {
  const [dados, setDados] = useState<any[]>([]);
  const [sinais, setSinais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [virtualData, setVirtualData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        // Carrega dados do sinal e virtual API em paralelo
        const [signalsRes, virtualRes] = await Promise.all([
          fetch('/api/signals'),
          fetch('/api/virtual'),
        ]);

        const signalsData = await signalsRes.json();
        const virtualData = virtualRes.ok ? await virtualRes.json() : null;

        // Constrói série temporal
        const startTime = Math.floor(Date.now() / 1000) - (signalsData.serie_over25?.length || 76) * 240;
        const chartData = (signalsData.serie_over25 || []).map((v: number, i: number) => ({
          time: startTime + i * 240,
          value: v,
        }));

        setDados(chartData);
        setVirtualData(virtualData);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }
    load();

    // Polling a cada 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const leagues = virtualData?.leagues || {};

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-200">
      <header className="bg-[#141414] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-bold text-amber-400">⚽ caramelo.goals</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">🏆 Copa</span>
          {virtualData ? (
            <span className="text-xs text-green-400">● BET365 VIRTUAL</span>
          ) : (
            <span className="text-xs text-green-400">● SCANNER ATIVO</span>
          )}
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
            <div className="flex-1 flex items-center justify-center text-gray-500">⏳ Carregando dados...</div>
          ) : (
            <>
              {/* Match Info Panel */}
              {virtualData && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-[#141414] border-b border-[#1f1f1f] text-xs">
                  {Object.entries(leagues).map(([key, data]: [string, any]) => {
                    const m = data?.match;
                    const p = data?.prob;
                    if (!m) return null;
                    return (
                      <div key={key} className="bg-[#0a0a0a] rounded p-2 border border-[#1f1f1f]">
                        <div className="text-gray-500 mb-1">
                          {key === 'copa' ? '🏆' : key === 'euro' ? '🌍' : '🏴'} {key.toUpperCase()}
                        </div>
                        <div className="text-white font-medium">{m.timeA} vs {m.timeB}</div>
                        <div className="text-lg font-bold text-amber-400">{m.resultado}</div>
                        <div className="flex gap-2 mt-1">
                          <span className="text-gray-400">{m.minuto}'</span>
                          <span className="text-green-400">O2.5: {p?.over25 || '?'}%</span>
                          <span className="text-yellow-400">BTTS: {p?.btts_sim || '?'}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
              <MosaicTiles
                tiles={[]}
                virtualData={virtualData}
              />
            </>
          )}
        </main>
      </div>

      <footer className="bg-[#141414] border-t border-[#1f1f1f] px-4 py-2 flex items-center gap-4 text-xs text-gray-500">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>SCANNER · Bet365 Virtual</span>
        <span className="ml-auto">DarkOdds v2.0 · Dados ao vivo</span>
      </footer>
    </div>
  );
}
