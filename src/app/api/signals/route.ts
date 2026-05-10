import { NextResponse } from 'next/server';
import fs from 'fs';

const VIRTUAL_FILE = '/home/magnumbrokeroficial/darkodds/mcp-sports-hub/scripts/virtual_games.json';
const POWER_FILE = '/home/magnumbrokeroficial/darkodds/scrapers/team_power.json';

export async function GET() {
  try {
    const virtual = JSON.parse(fs.readFileSync(VIRTUAL_FILE, 'utf-8'));
    const power = JSON.parse(fs.readFileSync(POWER_FILE, 'utf-8'));
    const league = power._league || { league_lambda: 2.14 };

    // Extrair valores de Over 2.5 para gerar série temporal
    const overValues: number[] = [];
    for (const game of virtual) {
      const totals = game.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'totals');
      if (totals) {
        const over = totals.outcomes.find((o: any) => o.name?.includes('Over 2.5'));
        if (over && over.price) {
          // Converter odd para "gols esperados" simplificado
          overValues.push(parseFloat((1 / over.price * 5).toFixed(1)));
        }
      }
    }

    return NextResponse.json({
      fonte: 'DarkOdds (Bet365 via Caramelotips)',
      total_jogos: virtual.length,
      serie_over25: overValues.slice(0, 76),
      league_lambda: league.league_lambda,
      sinais_pendentes: 'Integrar detectores com dados live',
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
