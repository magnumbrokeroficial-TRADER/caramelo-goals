/* ============================================================
   🔔 NOTIFICATIONS — Browser Push, Telegram, Discord
   ============================================================
   Envia alertas quando um sinal de alta confiança dispara.
   Configurações ficam no localStorage do navegador.

   Para Telegram: precisa do token do bot + chat_id.
     Como obter:
     1. Crie um bot no @BotFather no Telegram
     2. Pegue o token (tipo: 123456:ABC-DEF...)
     3. Para chat_id pessoal: mande /start no bot, depois
        acesse https://api.telegram.org/bot<TOKEN>/getUpdates
        e copie o "chat":{"id":...}

   Para Discord: precisa do webhook URL de um canal.
     Como obter:
     1. No canal do Discord: Configurações → Integrações
     2. Webhooks → Novo Webhook → copiar URL
============================================================ */

const NotifConfig = {
  load() {
    try {
      return JSON.parse(localStorage.getItem('caramelo_notif') || '{}');
    } catch { return {}; }
  },
  save(cfg) {
    localStorage.setItem('caramelo_notif', JSON.stringify(cfg));
  },
  get() {
    const def = {
      pushEnabled: false,
      telegram: { token: '', chatId: '' },
      discord: { webhook: '' },
      filters: { minConfidence: 60, over: true, under: true },
    };
    return { ...def, ...this.load() };
  },
};

// ====== BROWSER PUSH ======
async function enableBrowserPush() {
  if (!('Notification' in window)) {
    return { ok: false, msg: 'Navegador não suporta notificações' };
  }
  if (Notification.permission === 'denied') {
    return { ok: false, msg: 'Notificações bloqueadas pelo navegador' };
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    const cfg = NotifConfig.get();
    cfg.pushEnabled = true;
    NotifConfig.save(cfg);
    return { ok: true, msg: 'Notificações ativadas' };
  }
  return { ok: false, msg: `Permissão negada: ${perm}` };
}

function sendBrowserPush(signal) {
  const cfg = NotifConfig.get();
  if (!cfg.pushEnabled || Notification.permission !== 'granted') return;

  const arrow = signal.direction === 'over' ? '⬆️' : '⬇️';
  const title = `${arrow} ${signal.pattern} (${signal.confidence.toFixed(0)}%)`;
  const body = `${signal.message}\n\nMercados: ${signal.market.join(', ')}`;

  new Notification(title, {
    body,
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">⚽</text></svg>',
    tag: `signal-${signal.dataIndex}`,
  });
}

// ====== TELEGRAM ======
async function sendTelegram(token, chatId, text) {
  if (!token || !chatId) return { ok: false, msg: 'Token ou Chat ID vazio' };
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    if (data.ok) return { ok: true, msg: 'Mensagem enviada!' };
    return { ok: false, msg: data.description || 'Erro desconhecido' };
  } catch (err) {
    return { ok: false, msg: 'Erro de rede: ' + err.message };
  }
}

function formatSignalForTelegram(signal) {
  const arrow = signal.direction === 'over' ? '⬆️' : '⬇️';
  const checks = signal.checks
    .map(c => `${c.passed ? '✅' : (c.partial ? '🟡' : '❌')} ${c.name}`)
    .join('\n');
  return `${arrow} *${signal.pattern}* — *${signal.confidence.toFixed(0)}%*

${signal.message}

*Checagens:*
${checks}

*Mercados sugeridos:* ${signal.market.join(', ')}
*Valor atual:* ${signal.value} gols`;
}

// ====== DISCORD ======
async function sendDiscord(webhookUrl, signal) {
  if (!webhookUrl) return { ok: false, msg: 'Webhook URL vazio' };

  const color = signal.direction === 'over' ? 0x26c281 : 0xef4444;
  const arrow = signal.direction === 'over' ? '⬆️' : '⬇️';

  const embed = {
    title: `${arrow} ${signal.pattern}`,
    description: signal.message,
    color,
    fields: [
      { name: 'Confiança', value: `${signal.confidence.toFixed(0)}%`, inline: true },
      { name: 'Direção', value: signal.direction.toUpperCase(), inline: true },
      { name: 'Valor', value: String(signal.value), inline: true },
      { name: 'Mercados', value: signal.market.join(', '), inline: false },
      {
        name: 'Checagens',
        value: signal.checks.map(c => `${c.passed ? '✅' : (c.partial ? '🟡' : '❌')} ${c.name}`).join('\n'),
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'Caramelo Goals — Detector Automático' },
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (res.ok || res.status === 204) return { ok: true, msg: 'Enviado!' };
    return { ok: false, msg: `Erro ${res.status}` };
  } catch (err) {
    return { ok: false, msg: 'Erro de rede: ' + err.message };
  }
}

// ====== ROTEADOR PRINCIPAL ======
async function notifyAll(signal) {
  const cfg = NotifConfig.get();

  // Log pra debug — útil pra detectar problemas no Telegram
  console.log('[notifyAll] Tentando notificar sinal:', {
    pattern: signal.pattern,
    confidence: signal.confidence.toFixed(0) + '%',
    direction: signal.direction,
    minConfidenceFilter: cfg.filters.minConfidence,
    telegramConfigured: !!(cfg.telegram.token && cfg.telegram.chatId),
    discordConfigured: !!cfg.discord.webhook,
  });

  // Filtros
  if (signal.confidence < cfg.filters.minConfidence) {
    console.log('[notifyAll] Bloqueado por filtro de confiança mínima');
    return;
  }
  if (signal.direction === 'over' && !cfg.filters.over) return;
  if (signal.direction === 'under' && !cfg.filters.under) return;

  // Browser push
  if (cfg.pushEnabled) sendBrowserPush(signal);

  // Telegram
  if (cfg.telegram.token && cfg.telegram.chatId) {
    const result = await sendTelegram(cfg.telegram.token, cfg.telegram.chatId, formatSignalForTelegram(signal));
    console.log('[notifyAll] Telegram:', result);
  }

  // Discord
  if (cfg.discord.webhook) {
    const result = await sendDiscord(cfg.discord.webhook, signal);
    console.log('[notifyAll] Discord:', result);
  }
}

// ====== TOAST IN-APP ======
function showToast(signal) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const arrow = signal.direction === 'over' ? '⬆️' : '⬇️';
  const toast = document.createElement('div');
  toast.className = `toast ${signal.direction}`;
  toast.innerHTML = `
    <div class="toast-title">${arrow} ${signal.pattern} <span style="margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:11px">${signal.confidence.toFixed(0)}%</span></div>
    <div class="toast-msg">${signal.message}</div>
    <div class="toast-meta"><span>${signal.market[0]}</span><span>Valor: ${signal.value}</span></div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}
