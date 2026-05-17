import { NextResponse } from 'next/server';

const DARKODDS_URL = process.env.DARKODDS_URL || 'https://rambling-crafty-riveting.ngrok-free.dev';

export async function GET() {
  try {
    const resp = await fetch(`${DARKODDS_URL}/api/live?liga=copa`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`DarkOdds HTTP ${resp.status}`);
    const data = await resp.json();

    const over25 = data.series?.over25 || [];

    return NextResponse.json({
      fonte: 'DarkOdds (Bet365 via ngrok)',
      total_jogos: data.total_jogos || 0,
      serie_over25: over25.slice(0, 80),
      league_lambda: data.power?.league_lambda || 2.5,
      sinais_pendentes: 'Disponível via /api/analyst',
      atualizado_em: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
