import { NextRequest, NextResponse } from 'next/server';

const PULSE_API = 'https://api.pulsescore.net/api/v2/bet365';
const SECRET = '1e1d3860-2788-4599-9c3a-280fc3c53d6f';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = searchParams.get('league');

  if (!league) {
    return NextResponse.json({ error: 'league query param required' }, { status: 400 });
  }

  try {
    const url = `${PULSE_API}/events?league=${encodeURIComponent(league)}`;
    const res = await fetch(url, {
      headers: { 'x-secret': SECRET },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'PulseScore API error', status: res.status }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
