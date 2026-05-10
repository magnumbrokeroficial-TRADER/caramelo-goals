import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { padrao, direcao, confianca, mercado } = body;
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
    const msg = `🔔 SINAL DETECTADO\n📊 ${padrao}\n🎯 ${direcao}\n💪 ${confianca}%\n📈 ${mercado?.join(', ')}`;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }) });
  }
  return NextResponse.json({ ok: true });
}
