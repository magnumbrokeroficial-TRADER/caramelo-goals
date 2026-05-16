'use client';

import { useState, useEffect } from 'react';

interface Signal {
  liga: string;
  mercado: string;
  odd: number;
  direcao: string;
  rsi: number | null;
  rsi14: number | null;
  rsi7: number | null;
  preco_vs_vwap: string;
  banda: string;
  macd_hist: number | null;
  tipo: string;
  decisao: {
    deve_apostar: boolean;
    confianca: number;
    justificativa: string;
    odd_estimada: number;
    valor_sugerido: number;
    direcao: string;
  };
}

interface AnalystData {
  liga: string;
  status: string;
  mensagem?: string;
  total_jogos: number;
  total_sinais?: number;
  atualizado_em: string;
  power?: {
    league_lambda?: number;
    btts_baseline?: number;
    avg_total_goals?: number;
  };
  sinais: Signal[];
}

function SignalCard({ s }: { s: Signal }) {
  const d = s.decisao;
  const confianca_pct = d.confianca || s.rsi || 50;
  const cor_confianca = confianca_pct >= 70 ? 'text-green-400' : confianca_pct >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 hover:border-amber-500/40 transition">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">{s.mercado}</span>
          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
            d.deve_apostar ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
          }`}>
            {d.deve_apostar ? '✅ APOSTAR' : '⚠️ AGUARDAR'}
          </span>
        </div>
        <span className="text-2xl font-bold text-amber-400">R$ {d.valor_sugerido?.toFixed(2) || '9,90'}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Odd</div>
          <div className="text-lg font-bold text-white">{s.odd?.toFixed(2) || '-'}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">RSI 14</div>
          <div className={`text-lg font-bold ${
            s.rsi14 && s.rsi14 < 30 ? 'text-green-400' : s.rsi14 && s.rsi14 > 70 ? 'text-red-400' : 'text-white'
          }`}>{s.rsi14?.toFixed(1) || '-'}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">RSI 7</div>
          <div className={`text-lg font-bold ${
            s.rsi7 && s.rsi7 < 25 ? 'text-green-400' : s.rsi7 && s.rsi7 > 75 ? 'text-red-400' : 'text-white'
          }`}>{s.rsi7?.toFixed(1) || '-'}</div>
        </div>
        <div className="bg-[#0a0a0a] rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500">Vs VWAP</div>
          <div className={`text-lg font-bold ${s.preco_vs_vwap === 'acima' ? 'text-green-400' : 'text-red-400'}`}>
            {s.preco_vs_vwap === 'acima' ? '▲' : '▼'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-400">Confiança:</span>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              confianca_pct >= 70 ? 'bg-green-500' : confianca_pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${confianca_pct}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${cor_confianca}`}>{confianca_pct}%</span>
      </div>

      {d.justificativa && (
        <p className="text-sm text-gray-400 italic">💡 {d.justificativa}</p>
      )}

      <div className="mt-2 flex gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-gray-500">{s.tipo}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] text-gray-500">{s.banda}</span>
        {s.macd_hist !== null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded bg-[#1f1f1f] ${
            s.macd_hist > 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            MACD {s.macd_hist > 0 ? '+' : ''}{s.macd_hist?.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AnalystPanel() {
  const [data, setData] = useState<AnalystData | null>(null);
  const [liga, setLiga] = useState('copa');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErro(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(`/api/analyst?liga=${liga}&no-ai=true`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (err: any) {
      setErro(err.name === 'AbortError'
        ? '⏱️ Tempo limite excedido. DarkOdds pode estar lenta com 681 jogos.'
        : `❌ Backend offline. DarkOdds API não respondeu. (${err.message})`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [liga]);

  const ligas = [
    { key: 'copa', label: '🏆 Copa' },
    { key: 'euro', label: '🌍 Euro' },
    { key: 'super', label: '💥 Super' },
    { key: 'premier', label: '🏴 Premier' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
      {/* Header */}
      <header className="bg-[#141414] border-b border-[#1f1f1f] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-amber-400">⚽ Caramelo Goals</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Analista Técnico IA
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data?.power && (
            <span className="text-xs text-gray-500">
              λ={data.power.league_lambda?.toFixed(2)} | BTTS={data.power.btts_baseline}%
            </span>
          )}
          {lastUpdate && (
            <span className="text-xs text-gray-600">
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </header>

      {/* League selector */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-[#1f1f1f]">
        {ligas.map(l => (
          <button
            key={l.key}
            onClick={() => setLiga(l.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              liga === l.key
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#1f1f1f] text-gray-400 hover:text-white'
            }`}
          >
            {l.label}
          </button>
        ))}
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
              <p className="text-gray-500">Analisando séries de odds com indicadores técnicos...</p>
            </div>
          </div>
        )}

        {erro && !loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">🚫</div>
              <h2 className="text-xl text-red-400 mb-2">Erro de conexao</h2>
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

        {data && data.status === 'sem_sinais' && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl text-gray-400 mb-2">Nenhum sinal no momento</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {data.mensagem || 'Os indicadores estão neutros. O analista monitora RSI, Bollinger, VWAP e MACD em busca de padrões de big odds.'}
            </p>
            <div className="mt-6 flex justify-center gap-6 text-sm text-gray-500">
              <div>
                <div className="text-amber-400 font-bold">{data.total_jogos}</div>
                <div>Jogos na base</div>
              </div>
              <div>
                <div className="text-amber-400 font-bold">{data.power?.avg_total_goals?.toFixed(2) || '-'}</div>
                <div>Média de gols</div>
              </div>
              <div>
                <div className="text-amber-400 font-bold">{data.power?.btts_baseline || '-'}%</div>
                <div>BTTS base</div>
              </div>
            </div>
          </div>
        )}

        {data && data.sinais && data.sinais.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                🎯 {data.total_sinais} sinais encontrados
              </h2>
              <span className="text-xs text-gray-500">
                Odd mínima: 2.00 | RSI extremo + confirmação VWAP
              </span>
            </div>
            <div className="grid gap-4">
              {data.sinais.map((s, i) => (
                <SignalCard key={i} s={s} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1f1f1f] px-4 py-3 flex items-center gap-4 text-xs text-gray-600">
        <span>⚙️ RSI(14) · Bollinger(20,2) · VWAP(50) · MACD(12,26,9)</span>
        <span className="ml-auto">DarkOdds v2.0 · Bet365 Virtual</span>
      </footer>
    </div>
  );
}
