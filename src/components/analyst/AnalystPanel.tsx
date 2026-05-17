'use client';

import { useState, useEffect } from 'react';

interface AnalysisItem {
  column: number;
  game: string;
  time: string;
  goalsThisHour: number;
  history: number[];
  components: { vertical: number; heat: number; lateral: number; z: number };
  contributions: { vertical: number; heat: number; lateral: number; z: number };
  score: number;
  pOver: number;
  pUnder: number;
  band: string;
  action: string;
}

interface AnalystData {
  ok: boolean;
  hour: number;
  generatedAt: string;
  meta: {
    historicalHours: number;
    globalMean: number;
    globalStd: number;
    weights: { vertical: number; heat: number; lateral: number; z: number };
  };
  summary: {
    strongSignals: number;
    bestOver: AnalysisItem;
    bestUnder: AnalysisItem;
  };
  analysis: AnalysisItem[];
}

const CONFIDENCE_COLORS: Record<string, string> = {
  'muito alta': 'text-green-400',
  'alta': 'text-green-300',
  'média': 'text-yellow-400',
  'baixa': 'text-red-400',
};

function SignalCard({ item }: { item: AnalysisItem }) {
  const isOver = item.pOver >= 50;
  const confidence = isOver ? item.pOver : item.pUnder;
  const bandLower = item.band.toLowerCase();
  const confidenceColor = confidence >= 75 ? 'text-green-400' : confidence >= 65 ? 'text-green-300' : confidence >= 55 ? 'text-yellow-400' : 'text-red-400';
  const barColor = bandLower.includes('forte') ? (isOver ? 'bg-green-500' : 'bg-red-500') : 'bg-yellow-500';
  const bgBorder = bandLower.includes('forte') ? 'border-amber-500/40' : 'border-[#2a2a2a]';

  return (
    <div className={`bg-[#141414] border ${bgBorder} rounded-xl p-4 hover:border-amber-500/40 transition`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">{item.game}</span>
          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-[#1f1f1f] text-gray-400">{item.time}</span>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
            bandLower.includes('forte') ? 'bg-amber-900/40 text-amber-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {item.action}
          </span>
        </div>
        <span className={`text-2xl font-bold ${isOver ? 'text-green-400' : 'text-red-400'}`}>
          {isOver ? 'OVER' : 'UNDER'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">pOver</div>
          <div className={`text-lg font-bold ${item.pOver >= 65 ? 'text-green-400' : item.pOver <= 35 ? 'text-red-400' : 'text-white'}`}>
            {item.pOver.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">pUnder</div>
          <div className={`text-lg font-bold ${item.pUnder >= 65 ? 'text-red-400' : item.pUnder <= 35 ? 'text-green-400' : 'text-white'}`}>
            {item.pUnder.toFixed(1)}%
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Score</div>
          <div className={`text-lg font-bold ${item.score > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {item.score.toFixed(3)}
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Gols/Hora</div>
          <div className="text-lg font-bold text-white">{item.goalsThisHour}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">Confiança:</span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${confidenceColor}`}>{confidence.toFixed(0)}%</span>
      </div>

      {item.history && item.history.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Histórico:</span>
          <div className="flex gap-1">
            {item.history.map((g, i) => (
              <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${g > 0 ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-gray-500">{item.band}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-gray-500">{item.action}</span>
        {item.components && Object.entries(item.components).map(([k, v]) => (
          <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] ${Number(v) > 0 ? 'text-green-500' : Number(v) < 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {k}: {Number(v).toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalystPanel() {
  const [data, setData] = useState<AnalystData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch('/api/analyst', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (err: any) {
      setErro(err.name === 'AbortError'
        ? '⏱️ Tempo limite excedido.'
        : `❌ API não respondeu. (${err.message})`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const res = await fetch('/api/analyst?t=' + Date.now(), {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        setLastUpdate(new Date());
      } catch (err: any) {
        if (cancelled) return;
        setErro(err.name === 'AbortError'
          ? '⏱️ Tempo limite excedido.'
          : `❌ API não respondeu. (${err.message})`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      {/* Header */}
      <header className="bg-[#141414] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-amber-400">⚽ Caramelo Goals</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Analista de Colunas
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data?.meta && (
            <span className="text-xs text-gray-500">
              Média={data.meta.globalMean.toFixed(2)} | σ={data.meta.globalStd.toFixed(2)}
            </span>
          )}
          {lastUpdate && (
            <span className="text-xs text-gray-600">
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </header>

      {/* Status bar */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#1f1f1f]">
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs text-gray-500">{loading ? 'Analisando...' : 'Online'}</span>
          <button
            onClick={load}
            className="ml-2 px-3 py-1.5 rounded-lg bg-[#1f1f1f] text-xs text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-5xl mx-auto">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">📊</div>
              <p className="text-gray-500">Analisando colunas do Bet365 Virtual...</p>
            </div>
          </div>
        )}

        {erro && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">🚫</div>
              <h2 className="text-xl text-red-400 mb-2">Erro de conexão</h2>
              <p className="text-gray-500 mb-4">{erro}</p>
              <button
                onClick={load}
                className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 transition"
              >
                🔄 Tentar novamente
              </button>
            </div>
          </div>
        )}

        {data && data.analysis && data.analysis.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                🎯 {data.summary.strongSignals} sinais fortes
              </h2>
              <span className="text-xs text-gray-500">
                Hora {String(data.hour).padStart(2, '0')}h · {data.analysis.length} colunas analisadas
              </span>
            </div>

            {/* Destaques */}
            {data.summary && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#141414] border border-green-500/30 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-1">Melhor OVER</div>
                  <div className="text-lg font-bold text-green-400">
                    {data.summary.bestOver.game} — {data.summary.bestOver.pOver.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">{data.summary.bestOver.band} · {data.summary.bestOver.action}</div>
                </div>
                <div className="bg-[#141414] border border-red-500/30 rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-1">Melhor UNDER</div>
                  <div className="text-lg font-bold text-red-400">
                    {data.summary.bestUnder.game} — {data.summary.bestUnder.pUnder.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">{data.summary.bestUnder.band} · {data.summary.bestUnder.action}</div>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {data.analysis
                .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
                .map((item, i) => (
                  <SignalCard key={i} item={item} />
                ))}
            </div>
          </>
        )}

        {data && (!data.analysis || data.analysis.length === 0) && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl text-gray-400 mb-2">Nenhum dado disponível</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              O analista não encontrou colunas com sinal significativo no momento.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1f1f1f] px-4 py-3 flex items-center gap-4 text-xs text-gray-600">
        <span>⚙️ Vertical · Heat · Lateral · Z-Score · Ponderado</span>
        <span className="ml-auto">DarkOdds v2.0 · Bet365 Virtual</span>
      </footer>
    </div>
  );
}
