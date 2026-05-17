import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET → retorna status (resolve o 405 que estava aparecendo).
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'notify',
    status: 'online',
    accepts: 'POST',
    payloadSchema: {
      channel: 'telegram | discord | webhook',
      message: 'string',
      signal: '{ column, direction, pOver, time } (opcional)',
    },
    generatedAt: new Date().toISOString(),
  });
}

/**
 * POST → envia notificação para webhook configurado.
 * Variáveis de ambiente suportadas:
 *   - TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *   - DISCORD_WEBHOOK_URL
 *   - GENERIC_WEBHOOK_URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { channel = 'webhook', message, signal } = body;

    if (!message && !signal) {
      return NextResponse.json(
        { ok: false, error: 'Envie `message` ou `signal` no body.' },
        { status: 400 },
      );
    }

    const text = message || formatSignal(signal);
    const results: Record<string, any> = {};

    if (channel === 'telegram' || channel === 'all') {
      results.telegram = await sendTelegram(text);
    }
    if (channel === 'discord' || channel === 'all') {
      results.discord = await sendDiscord(text);
    }
    if (channel === 'webhook' || channel === 'all') {
      results.webhook = await sendGenericWebhook({ text, signal, ts: Date.now() });
    }

    return NextResponse.json({ ok: true, channel, text, results });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'Falha ao notificar', detail: String(err?.message || err) },
      { status: 500 },
    );
  }
}

function formatSignal(s: any): string {
  if (!s) return 'Sinal vazio';
  const dir = s.direction || (s.pOver >= 50 ? 'OVER' : 'UNDER');
  const p = s.pOver != null ? `${s.pOver}%` : '';
  return `🎯 ${dir} ${s.game || `J${s.column}`} ${s.time || ''} ${p} — ${s.band || ''}`;
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { skipped: 'env vars ausentes' };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return { status: res.status, ok: res.ok };
}

async function sendDiscord(text: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { skipped: 'DISCORD_WEBHOOK_URL ausente' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  });
  return { status: res.status, ok: res.ok };
}

async function sendGenericWebhook(payload: any) {
  const url = process.env.GENERIC_WEBHOOK_URL;
  if (!url) return { skipped: 'GENERIC_WEBHOOK_URL ausente' };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, ok: res.ok };
}
