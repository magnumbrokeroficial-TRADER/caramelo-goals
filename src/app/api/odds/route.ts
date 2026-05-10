import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DARKODDS_VIRTUAL = '/home/magnumbrokeroficial/darkodds/mcp-sports-hub/scripts/virtual_games.json';
const DARKODDS_POWER = '/home/magnumbrokeroficial/darkodds/scrapers/team_power.json';

export async function GET() {
  try {
    const virtualRaw = fs.readFileSync(DARKODDS_VIRTUAL, 'utf-8');
    const virtual = JSON.parse(virtualRaw);

    const powerRaw = fs.readFileSync(DARKODDS_POWER, 'utf-8');
    const power = JSON.parse(powerRaw);

    const league = power._league || { league_lambda: 2.14, btts_baseline: 39 };

    return NextResponse.json({
      liga: 'Copa (Virtual)',
      total_jogos: virtual.length,
      jogos: virtual.slice(0, 100).map((j: any) => ({
        home: j.home,
        odds: j.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'totals')?.outcomes || [],
        btts: j.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'btts')?.outcomes || [],
      })),
      league_stats: {
        lambda: league.league_lambda,
        btts_pct: league.btts_baseline,
        total_matches: league.total_matches,
      },
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: 'Dados do DarkOdds indisponíveis', detail: String(e) }, { status: 500 });
  }
}
