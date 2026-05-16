'use client';

import { useState, useCallback, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

// ==============================
// TYPES
// ==============================
type Regime = 'expansao' | 'contracao' | 'aceleracao' | 'exaustao' | 'neutro';
type Interval = 2 | 3 | 4;

interface HourData {
  hora: string;
  gols: number[];
}

// ==============================
// SEEDED RNG
// ==============================
function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function generateHourData(seed: number, base: number, vol: number, jogos: number): number[] {
  const rand = seededRand(seed);
  return Array.from({ length: jogos }, () =>
    Math.max(0, Math.round(base + (rand() - 0.5) * vol * 2))
  );
}

function generateAllHours(baseSeed: number, jogos: number): HourData[] {
  const horas = ['13h', '14h', '15h', '16h'];
  const rng = seededRand(baseSeed);
  return horas.map((hora, hi) => ({
    hora,
    gols: generateHourData(baseSeed + hi * 777, 1.2 + rng() * 1.6 + hi * 0.3, 0.5 + rng() * 0.8, jogos),
  }));
}

// ==============================
// REGIME DETECTION
// ==============================
function detectRegime(deltas: number[]): Regime {
  const pos = deltas.filter(d => d > 0).length;
  const neg = deltas.filter(d => d < 0).length;
  const momentum = deltas.reduce((a, b) => a + b, 0);

  const acc: number[] = [];
  let cum = 0;
  deltas.forEach(d => { cum += d; acc.push(cum); });

  const slope = acc.length > 4 ? acc[acc.length - 1] - acc[acc.length - 5] : 0;

  if (pos >= 12 && momentum > 3) return 'expansao';
  if (neg >= 12 && momentum < -3) return 'contracao';
  if (slope > 2) return 'aceleracao';
  if (slope < -2) return 'exaustao';
  return 'neutro';
}

const OPERACOES: Record<Regime, { over: string[]; under: string[] }> = {
  expansao:   { over: ['Over 1.5 FT', 'Over 2.5 FT', 'BTTS', 'Lay Under'], under: ['Aguardar'] },
  aceleracao: { over: ['Over 1.5 FT', 'Over 1.5 HT', 'BTTS', 'Lay Under'], under: ['Aguardar'] },
  contracao:  { over: ['Aguardar'], under: ['Under 2.5 FT', 'Under HT', 'Scalp anti-over', 'Lay Over'] },
  exaustao:   { over: ['Aguardar'], under: ['Under 2.5 FT', 'Under HT', 'Scalp anti-over', 'Lay Over'] },
  neutro:     { over: ['Aguardar 3+ deltas consecutivos'], under: ['Aguardar 3+ deltas consecutivos'] },
};

const REGIME_COLORS: Record<Regime, { bg: string; text: string }> = {
  expansao:   { bg: '#0a2e0a', text: '#4cff4c' },
  aceleracao: { bg: '#0a2e0a', text: '#4cff4c' },
  contracao:  { bg: '#2e0a0a', text: '#ff6666' },
  exaustao:   { bg: '#2e0a0a', text: '#ff6666' },
  neutro:     { bg: '#1a1a0a', text: '#ffb547' },
};

const REGIME_BANNER: Record<Regime, { icon: string; title: string; subtitle: string }> = {
  expansao:   { icon: '📈', title: 'Expansão detectada — pressão de over', subtitle: 'deltas positivos · momentum crescente · breakout de ciclo' },
  aceleracao: { icon: '⚡', title: 'Aceleração detectada — momentum forte', subtitle: 'deltas acelerando · entrada oportunista' },
  contracao:  { icon: '📉', title: 'Contração detectada — esgotamento ofensivo', subtitle: 'deltas negativos · correção de ciclo' },
  exaustao:   { icon: '🛑', title: 'Exaustão detectada — reversão iminente', subtitle: 'deltas em queda livre · cautela' },
  neutro:     { icon: '⚖️', title: 'Zona de equilíbrio — aguardar definição', subtitle: 'sinais mistos · sem tendência clara' },
};

const REGIME_DESCRIPTION: Record<Regime, string> = {
  expansao:   'Delta Flow em expansão: mais de 60% dos deltas são positivos e o momentum acumulado ultrapassou +3. Cenário favorável para overs com entrada estruturada.',
  aceleracao: 'Delta Flow em aceleração: a inclinação dos últimos 5 deltas está acima de +2, indicando que a pressão compradora está aumentando rapidamente. Ideal para overs de entrada rápida.',
  contracao:  'Delta Flow em contração: mais de 60% dos deltas são negativos com momentum abaixo de -3. Cenário de under predominante, evitar overs.',
  exaustao:   'Delta Flow em exaustão: a inclinação dos últimos 5 deltas está abaixo de -2, sugerindo que o movimento está perdendo força. Possível reversão no horizonte.',
  neutro:     'Delta Flow neutro: deltas equilibrados sem direção clara. Aguardar 3 ou mais deltas consecutivos na mesma direção antes de qualquer entrada.',
};

// ==============================
// UTILITIES
// ==============================
function getMinuteLabel(jogoIdx: number, horaStr: string, interval: number): string {
  const hNum = parseInt(horaStr);
  const totalMins = 1 + jogoIdx * interval;
  const h = hNum + Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${(h % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ==============================
// STYLES (shared)
// ==============================
const S = {
  container: {
    padding: '16px',
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    color: '#e0e0e0',
    background: '#0a0a0a',
    minHeight: '100vh',
  },
  card: (bg = '#141414', border = '#2a2a2a') => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '6px',
    padding: '12px',
  }),
  label: { color: '#8b95b1', fontSize: '10px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  value: { fontSize: '18px', fontWeight: 700 as const, fontFamily: "'JetBrains Mono', monospace" },
};

const JOGOS = 20;

// ==============================
// COMPONENT
// ==============================
export default function DeltaFlowPanel() {
  const [interval, setInterval] = useState<Interval>(3);
  const [seed, setSeed] = useState(() => Date.now() % 100000);

  const data = useMemo(() => generateAllHours(seed, JOGOS), [seed]);

  const deltas = useMemo(() => {
    if (data.length < 2) return [];
    const last = data[data.length - 1].gols;
    const prev = data[data.length - 2].gols;
    return last.map((g, i) => g - (prev[i] ?? 0));
  }, [data]);

  const regime = useMemo(() => detectRegime(deltas), [deltas]);

  const momentum = useMemo(() => deltas.reduce((a, b) => a + b, 0), [deltas]);
  const posCount = useMemo(() => deltas.filter(d => d > 0).length, [deltas]);
  const negCount = useMemo(() => deltas.filter(d => d < 0).length, [deltas]);

  const newCycle = useCallback(() => {
    setSeed(Date.now() % 100000);
  }, []);

  // Chart data
  const accDeltas = useMemo(() => {
    const acc: number[] = [];
    let cum = 0;
    deltas.forEach(d => { cum += d; acc.push(cum); });
    return acc;
  }, [deltas]);

  const chartData = useMemo(() => ({
    labels: Array.from({ length: JOGOS }, (_, i) => `J${i + 1}`),
    datasets: [
      {
        label: 'Delta acumulado',
        data: accDeltas,
        borderColor: momentum >= 0 ? '#4cff4c' : '#ff6666',
        backgroundColor: (ctx: any) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180);
          const c = momentum >= 0 ? 'rgba(76,255,76,0.15)' : 'rgba(255,102,102,0.15)';
          g.addColorStop(0, c);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          return g;
        },
        fill: true,
        tension: 0.2,
        pointRadius: 2,
        borderWidth: 2,
      },
      {
        label: 'Delta por slot',
        data: deltas,
        borderColor: '#555',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        tension: 0,
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  }), [accDeltas, deltas, momentum]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: true, ticks: { color: '#666', font: { size: 8, family: "'JetBrains Mono'" } }, grid: { color: '#1a1a1a' } },
      y: { display: true, ticks: { color: '#666', font: { size: 8, family: "'JetBrains Mono'" } }, grid: { color: '#1a1a1a' } },
    },
  }), []);

  const rc = REGIME_COLORS[regime];
  const banner = REGIME_BANNER[regime];
  const ops = OPERACOES[regime];

  // Totals per hour
  const totals = useMemo(() => data.map(h => h.gols.reduce((a, b) => a + b, 0)), [data]);

  return (
    <div style={S.container}>
      {/* ===== TOP BAR ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#ffb547', margin: 0 }}>
          Delta Flow <span style={{ color: '#666', fontWeight: 400, fontSize: '11px' }}>· sistema de sinais</span>
        </h1>
        <span style={{ background: '#cc0000', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', letterSpacing: '1px' }}>AO VIVO</span>
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          {([2, 3, 4] as Interval[]).map(i => (
            <button key={i} onClick={() => setInterval(i)}
              style={{
                background: interval === i ? '#333' : '#1a1a1a',
                color: interval === i ? '#fff' : '#888',
                border: `1px solid ${interval === i ? '#555' : '#2a2a2a'}`,
                borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
                fontSize: '10px', fontFamily: 'inherit',
              }}>
              {i} min
            </button>
          ))}
        </div>
        <button onClick={newCycle}
          style={{
            background: '#1a1a2e', color: '#888', border: '1px solid #2a2a4a',
            borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
            fontSize: '10px', fontFamily: 'inherit',
          }}>
          🔄 Novo ciclo
        </button>
      </div>

      {/* ===== METRIC CARDS ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <div style={S.card()}>
          <div style={S.label}>Momentum</div>
          <div style={{ ...S.value, color: momentum >= 0 ? '#4cff4c' : '#ff6666' }}>{momentum >= 0 ? '+' : ''}{momentum}</div>
        </div>
        <div style={S.card()}>
          <div style={S.label}>Deltas positivos</div>
          <div style={{ ...S.value, color: '#4cff4c' }}>{posCount}/20</div>
        </div>
        <div style={S.card()}>
          <div style={S.label}>Deltas negativos</div>
          <div style={{ ...S.value, color: '#ff6666' }}>{negCount}/20</div>
        </div>
        <div style={{ ...S.card(rc.bg, rc.text) }}>
          <div style={S.label}>Regime</div>
          <div style={{ ...S.value, color: rc.text, fontSize: '14px' }}>{regime.charAt(0).toUpperCase() + regime.slice(1)}</div>
        </div>
      </div>

      {/* ===== SIGNAL BANNER ===== */}
      <div style={{
        ...S.card(rc.bg, rc.text),
        marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '10px',
        borderLeft: `4px solid ${rc.text}`,
      }}>
        <span style={{ fontSize: '24px' }}>{banner.icon}</span>
        <div>
          <div style={{ color: rc.text, fontWeight: 700, fontSize: '12px' }}>{banner.title}</div>
          <div style={{ color: '#aaa', fontSize: '10px' }}>{posCount} deltas positivos · momentum {momentum >= 0 ? '+' : ''}{momentum} · {banner.subtitle}</div>
        </div>
      </div>

      {/* ===== MOSAIC TABLE ===== */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ color: '#8b95b1', fontSize: '10px', marginBottom: '6px' }}>
          Mosaico sincronizado (intervalo: {interval} min entre jogos)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <thead>
              <tr>
                <th style={{ padding: '4px 6px', color: '#666', borderBottom: '1px solid #2a2a2a', textAlign: 'left' }}>Hora</th>
                {Array.from({ length: JOGOS }, (_, i) => (
                  <th key={i} style={{ padding: '4px 2px', color: '#555', borderBottom: '1px solid #2a2a2a', textAlign: 'center', fontWeight: 400, fontSize: '8px', minWidth: '28px' }}>
                    J{i + 1}
                  </th>
                ))}
                <th style={{ padding: '4px 6px', color: '#666', borderBottom: '1px solid #2a2a2a', textAlign: 'center' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h, hi) => (
                <tr key={h.hora}>
                  <td style={{ padding: '4px 6px', color: '#888', borderBottom: '1px solid #1a1a1a', fontWeight: 700 }}>{h.hora}</td>
                  {h.gols.map((g, ji) => {
                    const bg = g === 0 ? '#0a0a0a' : g === 1 ? '#2e0a0a' : g === 2 ? '#2e2e0a' : '#0a2e0a';
                    const title = getMinuteLabel(ji, h.hora, interval);
                    return (
                      <td key={ji} title={title}
                        style={{
                          padding: '4px 2px', textAlign: 'center', borderBottom: '1px solid #1a1a1a',
                          background: bg, color: g >= 3 ? '#4cff4c' : g === 2 ? '#ffb547' : g === 1 ? '#ff6666' : '#555',
                          fontWeight: g >= 2 ? 700 : 400, cursor: 'default',
                        }}>
                        {g}
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #1a1a1a', fontWeight: 700, color: '#aaa' }}>
                    {totals[hi]}
                  </td>
                </tr>
              ))}
              {/* DELTA ROW */}
              <tr>
                <td style={{ padding: '4px 6px', borderBottom: 'none', fontWeight: 700, fontSize: '9px', color: '#eee' }}>
                  {'Δ'}{data.length > 1 ? `${data[data.length - 1].hora}-${data[data.length - 2].hora}` : ''}
                </td>
                {deltas.map((d, i) => {
                  const isPos = d > 0;
                  const isNeg = d < 0;
                  const bg = isPos ? '#0a2e0a' : isNeg ? '#2e0a0a' : '#0a0a0a';
                  const color = isPos ? '#4cff4c' : isNeg ? '#ff6666' : '#555';
                  return (
                    <td key={i}
                      style={{
                        padding: '4px 2px', textAlign: 'center', background: bg,
                        color, fontWeight: 700, fontSize: '9px',
                      }}>
                      {d > 0 ? '+' : ''}{d}
                    </td>
                  );
                })}
                <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, fontSize: '9px', color: momentum >= 0 ? '#4cff4c' : '#ff6666' }}>
                  {momentum >= 0 ? '+' : ''}{momentum}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== CHART ===== */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '10px', color: '#888', marginBottom: '4px' }}>
          <span><span style={{ color: momentum >= 0 ? '#4cff4c' : '#ff6666' }}>━</span> Delta acumulado</span>
          <span><span style={{ color: '#555' }}>- -</span> Delta por slot</span>
        </div>
        <div style={{ ...S.card(), height: '180px', padding: '8px' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* ===== OPERATIONS PANEL ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ ...S.card('#0d1a0d', '#1a5a1a') }}>
          <div style={{ color: '#4cff4c', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Operações de over</div>
          {ops.over.map((op, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', borderBottom: i < ops.over.length - 1 ? '1px solid #1a3a1a' : 'none',
            }}>
              <span style={{ fontSize: '10px', color: '#ccc' }}>{op}</span>
              <span style={{
                fontSize: '8px', padding: '1px 6px', borderRadius: '3px', fontWeight: 700,
                background: regimenFavoravel(regime, 'over') ? '#1a5a1a' : '#333',
                color: regimenFavoravel(regime, 'over') ? '#4cff4c' : '#888',
              }}>
                {regimenFavoravel(regime, 'over') ? 'favorável' : 'aguardar'}
              </span>
            </div>
          ))}
        </div>
        <div style={{ ...S.card('#1a0d0d', '#5a1a1a') }}>
          <div style={{ color: '#ff6666', fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Operações de under</div>
          {ops.under.map((op, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 0', borderBottom: i < ops.under.length - 1 ? '1px solid #3a1a1a' : 'none',
            }}>
              <span style={{ fontSize: '10px', color: '#ccc' }}>{op}</span>
              <span style={{
                fontSize: '8px', padding: '1px 6px', borderRadius: '3px', fontWeight: 700,
                background: regimenFavoravel(regime, 'under') ? '#5a1a1a' : '#333',
                color: regimenFavoravel(regime, 'under') ? '#ff6666' : '#888',
              }}>
                {regimenFavoravel(regime, 'under') ? 'favorável' : 'aguardar'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FOOTER NOTE ===== */}
      <div style={{ ...S.card('#0d0d0d', '#1a1a1a'), fontSize: '10px', color: '#777', lineHeight: 1.6 }}>
        {REGIME_DESCRIPTION[regime]}
      </div>
    </div>
  );
}

function regimenFavoravel(regime: Regime, lado: 'over' | 'under'): boolean {
  if (regime === 'neutro') return false;
  if (lado === 'over') return regime === 'expansao' || regime === 'aceleracao';
  return regime === 'contracao' || regime === 'exaustao';
}
