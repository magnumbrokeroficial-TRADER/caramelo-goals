import { NextRequest, NextResponse } from 'next/server';

const DARKODDS_URL = process.env.DARKODDS_URL || 'https://rambling-crafty-riveting.ngrok-free.dev';

const LIGAS = ['copa', 'euro', 'super', 'premier'];

const LIGA_ICON: Record<string, string> = {
  copa: '🏆', euro: '🌍', super: '💥', premier: '🏴',
};

async function fetchLive(liga: string, limit: number) {
  const resp = await fetch(`${DARKODDS_URL}/api/live?liga=${encodeURIComponent(liga)}&limit=${limit}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`live HTTP ${resp.status}`);
  return resp.json();
}

async function fetchOdds(liga: string) {
  const resp = await fetch(`${DARKODDS_URL}/api/odds?liga=${encodeURIComponent(liga)}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`odds HTTP ${resp.status}`);
  return resp.json();
}

function extractOdds(jogo: any) {
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
  const tasks = LIGAS.map(async (liga) => {
    try {
      const [liveData, oddsData] = await Promise.all([fetchLive(liga, limit), fetchOdds(liga)]);

      const jogos = oddsData?.jogos || [];
      const primeiroJogo = jogos[0];
      const timeA = primeiroJogo?.home?.split(' x ')[0]?.trim() || '—';
      const timeB = primeiroJogo?.home?.split(' x ')[1]?.trim() || primeiroJogo?.away?.trim() || '—';
      const odds = extractOdds(primeiroJogo);

      const recent_matches = jogos.slice(0, limit).map((j: any) => {
        const home = j.home?.split(' x ')[0]?.trim() || '—';
        const away = j.home?.split(' x ')[1]?.trim() || j.away?.trim() || '—';
        const jOdds = extractOdds(j);
        // Placar real quando disponível (convert_virtual.py extrai do JSON do caramelotips)
        const score = j.score
          ? `${j.score.home}-${j.score.away}`
          : '—';
        return {
          timeA: home,
          timeB: away,
          score,
          over25_odd: jOdds.over25 ? parseFloat(jOdds.over25) : null,
          minuto: '—',
        };
      });

      const series = liveData?.series || {};

      return {
        liga,
        data: {
          match: {
            timeA,
            timeB,
            resultado: '—',
            resultadoHt: '—',
            resultadoFt: '—',
            minuto: '—',
            horario: new Date().toLocaleTimeString('pt-BR'),
          },
          odds,
          prob: extractProb(odds),
          series: {
            total_goals: series.total_goals?.slice(0, limit) || [],
            over25: series.over25?.slice(0, limit) || [],
            over15: series.over15?.slice(0, limit) || [],
            over35: series.over35?.slice(0, limit) || [],
            btts_yes: series.btts_yes?.slice(0, limit) || [],
            timestamps: series.timestamps?.slice(0, limit) || [],
          },
          total_jogos: liveData?.total_jogos || 0,
          power: liveData?.power || null,
          recent_matches,
        },
      };
    } catch (err: any) {
      return {
        liga,
        data: { error: `DarkOdds indisponível: ${err.message}` },
      };
    }
  });

  const settled = await Promise.allSettled(tasks);
  const leagues: Record<string, any> = {};

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      leagues[result.value.liga] = result.value.data;
    }
    // Promise.allSettled + try/catch interno garante que nunca reject
  }

  return NextResponse.json({
    status: true,
    ligas_disponiveis: LIGAS,
    leagues,
    atualizado_em: new Date().toISOString(),
  });
}
