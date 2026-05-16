import { NextRequest, NextResponse } from 'next/server';

const CARAMELO_BASE = 'https://www.caramelotips.com.br/final/bet365';
const LIGAS = ['copa', 'euro', 'super', 'premier'];

interface ParsedGame {
  timeA: string;
  timeB: string;
  score?: { home: number; away: number; total: number };
  odds: Record<string, string>;
}

function parseCell(text: string): ParsedGame | null {
  if (!text || text.length < 10) return null;

  const odds: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    over25: /o25@(\d+\.\d+)/,
    under25: /u25@(\d+\.\d+)/,
    over15: /o15@(\d+\.\d+)/,
    under15: /u15@(\d+\.\d+)/,
    over35: /o35@(\d+\.\d+)/,
    under35: /u35@(\d+\.\d+)/,
    btts_sim: /ambs@(\d+\.\d+)/,
    btts_nao: /ambn@(\d+\.\d+)/,
    fte: /fte@(\d+\.\d+)/,
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const m = text.match(regex);
    if (m) odds[key] = m[1];
  }

  // Precisa ter pelo menos over25 ou fte para ser jogo válido
  if (!odds.over25 && !odds.fte) return null;

  const lines = text.trim().split('\n');
  const matchName = lines[0]?.trim();
  if (!matchName || !matchName.includes(' x ')) return null;

  const [timeA, timeB] = matchName.split(' x ').map((s: string) => s.trim());

  let score: { home: number; away: number; total: number } | undefined;
  if (lines[1]) {
    const sm = lines[1].match(/^(\d+)\s*[-–]\s*(\d+)/);
    if (sm) {
      const h = parseInt(sm[1]);
      const a = parseInt(sm[2]);
      score = { home: h, away: a, total: h + a };
    }
  }

  return { timeA, timeB, score, odds };
}

function extractOdds(jogo: any): Record<string, string | null> {
  const odds: Record<string, string | null> = {
    over25: null, under25: null,
    over15: null, under15: null,
    over35: null, under35: null,
    btts_sim: null, btts_nao: null,
  };

  if (!jogo?.bookmakers?.[0]?.markets) return odds;

  for (const market of jogo.bookmakers[0].markets) {
    const outcomes = market.outcomes || [];
    if (market.key === 'totals') {
      for (const o of outcomes) {
        const name = o.name || '';
        const price = o.price?.toString() || null;
        if (name === 'Over 2.5') odds.over25 = price;
        else if (name === 'Under 2.5') odds.under25 = price;
        else if (name === 'Over 1.5') odds.over15 = price;
        else if (name === 'Under 1.5') odds.under15 = price;
        else if (name === 'Over 3.5') odds.over35 = price;
        else if (name === 'Under 3.5') odds.under35 = price;
        else if (name === 'Over' && !odds.over15) odds.over15 = price;
        else if (name === 'Under' && !odds.under15) odds.under15 = price;
      }
    } else if (market.key === 'btts') {
      for (const o of outcomes) {
        const name = o.name || '';
        const price = o.price?.toString() || null;
        if (name === 'Yes') odds.btts_sim = price;
        else if (name === 'No') odds.btts_nao = price;
      }
    }
  }

  return odds;
}

function extractProb(odds: Record<string, string | null>): Record<string, number | null> {
  const prob: Record<string, number | null> = {};
  for (const [key, val] of Object.entries(odds)) {
    prob[key] = val ? Math.round((1 / parseFloat(val)) * 100) : null;
  }
  return prob;
}

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam || '360'), 10), 500);
  const windowParam = request.nextUrl.searchParams.get('window');
  const windowSize = parseInt(windowParam || '20');

  const tasks = LIGAS.map(async (liga) => {
    try {
      const url = `${CARAMELO_BASE}/${liga}.json`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data: any = await resp.json();
      const rows: any[] = data?.table?.rows || [];
      if (rows.length === 0) throw new Error('JSON vazio ou sem tabela');

      const allGames: ParsedGame[] = [];

      for (const row of rows) {
        const cells: any[] = row.c || [];
        if (cells.length < 2) continue;
        // cell[0] = número da linha, cells[1..n-3] = jogos, últimas 3 = agregados
        for (let i = 1; i < cells.length - 3; i++) {
          const cell = cells[i];
          const text = typeof cell === 'object' && cell !== null
            ? String(cell.v || '')
            : String(cell || '');
          const parsed = parseCell(text);
          if (parsed) allGames.push(parsed);
        }
      }

      if (allGames.length === 0) throw new Error('Nenhum jogo válido encontrado');

      const primeiro = allGames[0];
      const odds = {
        over25: primeiro.odds.over25 || null,
        under25: primeiro.odds.under25 || null,
        btts_sim: primeiro.odds.btts_sim || null,
        btts_nao: primeiro.odds.btts_nao || null,
      };

      const recent_matches = allGames.slice(0, limit).map((g) => ({
        timeA: g.timeA,
        timeB: g.timeB,
        score: g.score ? `${g.score.home}-${g.score.away}` : '—',
        over25_odd: g.odds.over25 ? parseFloat(g.odds.over25) : null,
        minuto: '—',
      }));

      // total_goals: rolling sum com janela configurável
      const scoredGames = allGames.filter((g) => g.score);
      const totalGoals: number[] = [];
      for (let i = 0; i < scoredGames.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const sum = scoredGames.slice(start, i + 1).reduce((a, b) => a + (b.score?.total || 0), 0);
        totalGoals.push(sum);
      }
      // Pula pontos com janela incompleta
      const rollingStart = Math.min(windowSize - 1, totalGoals.length - 1);
      const total_goals = totalGoals.slice(rollingStart, rollingStart + limit).reverse();

      return {
        liga,
        data: {
          match: {
            timeA: primeiro.timeA,
            timeB: primeiro.timeB,
            resultado: primeiro.score ? `${primeiro.score.home}-${primeiro.score.away}` : '—',
            resultadoHt: '—',
            resultadoFt: '—',
            minuto: '—',
            horario: new Date().toLocaleTimeString('pt-BR'),
          },
          odds,
          prob: extractProb(odds),
          series: {
            total_goals,
          },
          total_jogos: allGames.length,
          power: null,
          recent_matches,
        },
      };
    } catch (err: any) {
      return {
        liga,
        data: { error: `Caramelotips indisponível: ${err.message}` },
      };
    }
  });

  const settled = await Promise.allSettled(tasks);
  const leagues: Record<string, any> = {};

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      leagues[result.value.liga] = result.value.data;
    }
  }

  return NextResponse.json({
    status: true,
    ligas_disponiveis: LIGAS,
    leagues,
    atualizado_em: new Date().toISOString(),
  });
}
