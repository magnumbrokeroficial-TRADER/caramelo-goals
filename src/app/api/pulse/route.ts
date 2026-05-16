import { NextRequest, NextResponse } from 'next/server';

const DARKODDS_URL = process.env.DARKODDS_URL || 'https://rambling-crafty-riveting.ngrok-free.dev';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get('league') || 'copa';

  try {
    const resp = await fetch(`${DARKODDS_URL}/api/live?liga=${encodeURIComponent(league)}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`DarkOdds HTTP ${resp.status}`);
    const data = await resp.json();

    return NextResponse.json({
      fonte: 'DarkOdds (Bet365 Virtual)',
      liga: league,
      series: data.series || {},
      power: data.power || {},
      total_jogos: data.total_jogos || 0,
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
