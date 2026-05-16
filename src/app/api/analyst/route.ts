import { NextRequest, NextResponse } from 'next/server';

const DARKODDS_URL = process.env.DARKODDS_URL || 'https://rambling-crafty-riveting.ngrok-free.dev';

export async function GET(request: NextRequest) {
  const liga = request.nextUrl.searchParams.get('liga') || 'copa';

  try {
    const resp = await fetch(`${DARKODDS_URL}/api/analyst?liga=${encodeURIComponent(liga)}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) throw new Error(`analyst HTTP ${resp.status}`);
    const data = await resp.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
