import { NextResponse } from 'next/server';

const RAPID_HOST = 'futebol-virtual-bet3651.p.rapidapi.com';
const RAPID_KEY = '08a533a83emsh63450317f16cb3bp1f5d2djsncd64d5d6614d';

const LEAGUES = ['copa', 'euro', 'premier'] as const;

async function fetchLeague(league: string) {
  const url = `https://${RAPID_HOST}/matchs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPID_KEY,
      'x-rapidapi-host': RAPID_HOST,
    },
    body: new URLSearchParams({ league, home: 'bet365', sport_id: '1' }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.matchs?.length) throw new Error('Nenhum match');
  return data.matchs[0];
}

function calcProb(decimalOdd: string | undefined): number | null {
  if (!decimalOdd) return null;
  const odd = parseFloat(decimalOdd);
  if (isNaN(odd) || odd <= 0) return null;
  return Math.round((1 / odd) * 100);
}

export async function GET() {
  const results: Record<string, any> = {};
  const over25Values: number[] = [];

  for (const league of LEAGUES) {
    try {
      const match = await fetchLeague(league);
      const odds = match.odds || {};

      const over25Prob = calcProb(odds['odd_over_2.5']);
      const under25Prob = calcProb(odds['odd_under_2.5']);
      const bttsProb = calcProb(odds['odd_ambas_sim']);
      const bttsNaoProb = calcProb(odds['odd_ambas_nao']);

      if (over25Prob !== null) over25Values.push(over25Prob);

      results[league] = {
        match: {
          id: match.id,
          timeA: match.timeA,
          timeB: match.timeB,
          resultado: match.resultado,
          resultadoHt: match.resultadoHt,
          resultadoFt: match.resultadoFt,
          minuto: match.minuto,
          horario: match.horario,
          primeiroMarcar: match.primeiroMarcar,
          ultimoMarcar: match.ultimoMarcar,
          vencedorHtFt: match.vencedorHtFt,
          created_at: match.created_at,
        },
        odds: {
          over25: odds['odd_over_2.5'],
          under25: odds['odd_under_2.5'],
          ambas_sim: odds['odd_ambas_sim'],
          ambas_nao: odds['odd_ambas_nao'],
          over15: odds['odd_over_1.5'],
          under15: odds['odd_under_1.5'],
          over35: odds['odd_over_3.5'],
          under35: odds['odd_under_3.5'],
          resultado_final_casa: odds.odd_resultado_final_casa,
          resultado_final_empate: odds.odd_resultado_final_empate,
          resultado_final_fora: odds.odd_resultado_final_fora,
        },
        prob: {
          over25: over25Prob,
          under25: under25Prob,
          btts_sim: bttsProb,
          btts_nao: bttsNaoProb,
        },
      };
    } catch (err) {
      console.warn(`[VirtualAPI] Falha ao buscar ${league}:`, (err as Error).message);
      results[league] = { error: String(err) };
    }
  }

  return NextResponse.json({
    status: true,
    leagues: results,
    serie_over25: over25Values.length > 0 ? over25Values : null,
    atualizado_em: new Date().toISOString(),
  });
}
