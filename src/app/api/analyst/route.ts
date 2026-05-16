import { NextRequest, NextResponse } from 'next/server';

const DARKODDS_URL = process.env.DARKODDS_URL || 'https://rambling-crafty-riveting.ngrok-free.dev';
const DEEPSEEK_KEY = 'sk-4fdab751eacb4287965d7fe139b2fa96';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

// ─── Indicadores Técnicos ────────────────────────────────────────────────

function calcRSI(series: number[], period = 14): (number | null)[] {
  const rsi: (number | null)[] = Array(series.length).fill(null);
  if (series.length < period + 1) return rsi;
  const deltas: number[] = [];
  for (let i = 1; i < series.length; i++) deltas.push(series[i] - series[i - 1]);
  let avgGain = deltas.slice(0, period).filter(d => d > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = deltas.slice(0, period).filter(d => d < 0).reduce((a, b) => a + Math.abs(b), 0) / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < series.length; i++) {
    const gain = deltas[i - 1] > 0 ? deltas[i - 1] : 0;
    const loss = deltas[i - 1] < 0 ? Math.abs(deltas[i - 1]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi.map(v => v !== null ? Math.round(v * 100) / 100 : null);
}

function calcBollinger(series: number[], period = 20, stdDev = 2) {
  const upper: (number | null)[] = Array(series.length).fill(null);
  const middle: (number | null)[] = Array(series.length).fill(null);
  const lower: (number | null)[] = Array(series.length).fill(null);
  for (let i = period - 1; i < series.length; i++) {
    const window = series.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / (period - 1);
    const std = Math.sqrt(variance);
    upper[i] = Math.round((mean + stdDev * std) * 10000) / 10000;
    middle[i] = Math.round(mean * 10000) / 10000;
    lower[i] = Math.round((mean - stdDev * std) * 10000) / 10000;
  }
  return { upper, middle, lower };
}

function calcVWAP(series: number[], period = 50): (number | null)[] {
  const vwap: (number | null)[] = Array(series.length).fill(null);
  if (series.length < period) return vwap;
  for (let i = period - 1; i < series.length; i++) {
    const window = series.slice(i - period + 1, i + 1);
    vwap[i] = Math.round(window.reduce((a, b) => a + b, 0) / period * 10000) / 10000;
  }
  return vwap;
}

function calcEMA(data: number[], span: number): (number | null)[] {
  const out: (number | null)[] = Array(data.length).fill(null);
  if (data.length < span) return out;
  const alpha = 2 / (span + 1);
  out[span - 1] = data.slice(0, span).reduce((a, b) => a + b, 0) / span;
  for (let i = span; i < data.length; i++) {
    out[i] = (data[i] - out[i - 1]!) * alpha + out[i - 1]!;
  }
  return out;
}

function calcMACD(series: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaF = calcEMA(series, fast);
  const emaS = calcEMA(series, slow);
  const macdLine: (number | null)[] = Array(series.length).fill(null);
  for (let i = 0; i < series.length; i++) {
    if (emaF[i] !== null && emaS[i] !== null) {
      macdLine[i] = Math.round((emaF[i]! - emaS[i]!) * 10000) / 10000;
    }
  }
  const macdClean = macdLine.map(v => v ?? 0);
  const signal: (number | null)[] = Array(series.length).fill(null);
  if (series.length >= signalPeriod) {
    const alphaS = 2 / (signalPeriod + 1);
    const firstIdx = macdLine.findIndex(v => v !== null);
    if (firstIdx !== -1) {
      const start = firstIdx + signalPeriod - 1;
      signal[start] = Math.round(macdClean.slice(firstIdx, start + 1).reduce((a, b) => a + b, 0) / signalPeriod * 10000) / 10000;
      for (let i = start + 1; i < series.length; i++) {
        signal[i] = Math.round((macdClean[i] - signal[i - 1]!) * alphaS + signal[i - 1]! * 10000) / 10000;
      }
    }
  }
  const histogram: (number | null)[] = Array(series.length).fill(null);
  for (let i = 0; i < series.length; i++) {
    if (macdLine[i] !== null && signal[i] !== null) {
      histogram[i] = Math.round((macdLine[i]! - signal[i]!) * 10000) / 10000;
    }
  }
  return { macd: macdLine, signal, histogram };
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface MatchData {
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
  confianca_base: number;
}

// ─── Detecção ────────────────────────────────────────────────────────────

function detectSignals(series: Record<string, number[]>, liga: string) {
  const signals: MatchData[] = [];

  const markets: Record<string, { label: string; bigOdd: number }> = {
    over25: { label: 'Over 2.5', bigOdd: 2.50 },
    over15: { label: 'Over 1.5', bigOdd: 1.80 },
    over35: { label: 'Over 3.5', bigOdd: 3.50 },
    btts_yes: { label: 'BTTS Sim', bigOdd: 2.00 },
    home_odd: { label: 'Casa', bigOdd: 2.50 },
    draw_odd: { label: 'Empate', bigOdd: 3.00 },
    away_odd: { label: 'Fora', bigOdd: 2.50 },
  };

  for (const [key, cfg] of Object.entries(markets)) {
    const vals = series[key];
    if (!vals || vals.length < 30) continue;

    const rsi14 = calcRSI(vals, 14);
    const rsi7 = calcRSI(vals, 7);
    const bands = calcBollinger(vals, 20, 2);
    const vwap = calcVWAP(vals, 50);
    const macd = calcMACD(vals, 12, 26, 9);

    const last = vals[vals.length - 1];
    const lastRSI14 = rsi14[rsi14.length - 1];
    const lastRSI7 = rsi7[rsi7.length - 1];
    const lastVWAP = vwap[vwap.length - 1];
    const lastBands = {
      upper: bands.upper[bands.upper.length - 1],
      middle: bands.middle[bands.middle.length - 1],
      lower: bands.lower[bands.lower.length - 1],
    };
    const lastMACD = {
      macd: macd.macd[macd.macd.length - 1],
      signal: macd.signal[macd.signal.length - 1],
      histogram: macd.histogram[macd.histogram.length - 1],
    };

    const odd = last > 0 ? Math.round(5 / last * 100) / 100 : 0;
    const precoVsVWAP = lastVWAP !== null ? (last > lastVWAP ? 'acima' : 'abaixo') : 'neutro';
    const banda = lastBands.lower !== null && Math.abs(last - lastBands.lower) < 0.05
      ? 'inferior' : lastBands.upper !== null && Math.abs(last - lastBands.upper) < 0.05
      ? 'superior' : 'neutra';
    const macdHist = lastMACD.histogram;

    const pushSignal = (tipo: string, direcao: string, confiancaBase: number, rsiVal: number | null) => {
      signals.push({
        liga, mercado: cfg.label, odd, direcao, rsi: rsiVal,
        rsi14: lastRSI14, rsi7: lastRSI7,
        preco_vs_vwap: precoVsVWAP, banda, macd_hist: macdHist,
        tipo, confianca_base: confiancaBase,
      });
    };

    // Big odds: Over 2.5 > 2.50 + RSI < 30
    if (key === 'over25' && odd > 2.50 && lastRSI14 !== null && lastRSI14 < 30) {
      pushSignal('big_odds_over', 'OVER', 75, lastRSI14);
    }
    // Big odds: Under 2.5 > 2.50 + RSI > 70
    if (key === 'over25' && last < 5) {
      const underOdd = Math.round(5 / (5 - last) * 100) / 100;
      if (underOdd > 2.50 && lastRSI14 !== null && lastRSI14 > 70) {
        pushSignal('big_odds_under', 'UNDER', 70, lastRSI14);
      }
    }
    // BTTS: odd > 2.00 + acima VWAP
    if (key === 'btts_yes' && odd > 2.00 && lastVWAP !== null && last > lastVWAP) {
      pushSignal('btts_momentum', 'BTTS', 70, lastRSI14);
    }
    // BTTS: odd > 2.00 + abaixo VWAP + banda inferior
    if (key === 'btts_yes' && odd > 2.00 && lastVWAP !== null && last < lastVWAP && lastBands.lower !== null && Math.abs(last - lastBands.lower) < 0.05) {
      pushSignal('btts_reversal', 'BTTS', 75, lastRSI14);
    }
    // RSI7 < 25 + MACD positivo = reversão rápida
    if (['over25', 'btts_yes', 'over15', 'over35'].includes(key) && lastRSI7 !== null && lastRSI7 < 25) {
      if (lastMACD.macd !== null && lastMACD.signal !== null && lastMACD.histogram !== null && lastMACD.macd > lastMACD.signal && lastMACD.histogram > 0) {
        pushSignal('rsi7_oversold_macd', 'OVER', 68, lastRSI7);
      }
    }
    // RSI7 > 75 + MACD negativo = sobrecompra
    if (['over25', 'btts_yes', 'over15', 'over35'].includes(key) && lastRSI7 !== null && lastRSI7 > 75) {
      if (lastMACD.macd !== null && lastMACD.signal !== null && lastMACD.histogram !== null && lastMACD.macd < lastMACD.signal && lastMACD.histogram < 0) {
        const dir = key.startsWith('over') ? 'UNDER' : 'PASS';
        pushSignal('rsi7_overbought_macd', dir, 65, lastRSI7);
      }
    }
    // Over 1.5: RSI < 25 + odd > 1.80
    if (key === 'over15' && odd > 1.80 && lastRSI14 !== null && lastRSI14 < 25) {
      pushSignal('oversold_extreme', 'OVER', 65, lastRSI14);
    }
  }

  return signals;
}

// ─── DeepSeek ────────────────────────────────────────────────────────────

async function consultarDeepSeek(sinal: MatchData): Promise<any> {
  const prompt = `Você é um analista especializado em futebol virtual Bet365.

### Dados do Sinal
- Liga: ${sinal.liga}
- Mercado: ${sinal.mercado}
- Odd atual: ${sinal.odd}
- Direção sugerida: ${sinal.direcao}
- RSI (14): ${sinal.rsi14}
- RSI (7): ${sinal.rsi7}
- Preço vs VWAP: ${sinal.preco_vs_vwap}
- Banda de Bollinger: ${sinal.banda}
- Histograma MACD: ${sinal.macd_hist}
- Confiança base: ${sinal.confianca_base}%

### Padrão Detectado: ${sinal.tipo}

### Instruções
Analise se este é um bom momento para apostar R$ 9,90 neste mercado.
Considere: (1) o RSI indica extremo? (2) o preço está do lado correto da VWAP? (3) as bandas de Bollinger confirmam?

Responda APENAS com um JSON neste formato exato:
{"deve_apostar": true, "confianca": 85, "justificativa": "texto", "odd_estimada": ${sinal.odd}, "valor_sugerido": 9.90, "direcao": "${sinal.direcao}"}`;

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`DeepSeek HTTP ${resp.status}`);
    const body = await resp.json();
    const content = body.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { deve_apostar: false, confianca: 0, justificativa: 'Falha ao parsear resposta', erro: content.slice(0, 200) };
  } catch (e: any) {
    return { deve_apostar: false, confianca: 0, justificativa: `Erro: ${e.message}`, erro: e.message };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const liga = req.nextUrl.searchParams.get('liga') || 'copa';
  const noAi = req.nextUrl.searchParams.get('no-ai') === 'true';

  try {
    // 1. Buscar dados da DarkOdds via ngrok
    const darkResp = await fetch(`${DARKODDS_URL}/api/live?liga=${liga}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(10000),
    });
    if (!darkResp.ok) throw new Error(`DarkOdds HTTP ${darkResp.status}`);
    const darkData = await darkResp.json();

    const series: Record<string, number[]> = darkData.series || {};
    const totalJogos = darkData.total_jogos || 0;
    const power = darkData.power || {};

    // Tamanho real das séries (para diagnóstico)
    const series_length: Record<string, number> = {};
    for (const [key, vals] of Object.entries(series)) {
      series_length[key] = vals.length;
    }

    // 2. Detectar sinais
    const sinais = detectSignals(series, liga);

    if (sinais.length === 0) {
      return NextResponse.json({
        liga,
        status: 'sem_sinais',
        mensagem: 'Nenhum padrão de big odds detectado no momento',
        total_jogos: totalJogos,
        series_length,
        atualizado_em: new Date().toISOString(),
        power: {
          league_lambda: power.league_lambda,
          btts_baseline: power.btts_baseline,
          avg_total_goals: power.avg_total_goals,
        },
        sinais: [],
      });
    }

    // 3. Consultar DeepSeek para cada sinal
    const resultados = [];
    for (const sinal of sinais) {
      const decisao = noAi
        ? { deve_apostar: sinal.confianca_base >= 70, confianca: sinal.confianca_base, justificativa: `Sinal ${sinal.tipo} detectado por regras técnicas`, odd_estimada: sinal.odd, valor_sugerido: 9.90, direcao: sinal.direcao }
        : await consultarDeepSeek(sinal);
      resultados.push({ ...sinal, decisao });
    }

    return NextResponse.json({
      liga,
      status: 'sinais_encontrados',
      total_jogos: totalJogos,
      total_sinais: resultados.length,
      series_length,
      atualizado_em: new Date().toISOString(),
      power: {
        league_lambda: power.league_lambda,
        btts_baseline: power.btts_baseline,
        avg_total_goals: power.avg_total_goals,
      },
      sinais: resultados,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Falha na análise', detail: e.message },
      { status: 500 },
    );
  }
}
