/* ============================================================
   📦 DATA LAYER — Camada de dados
   ============================================================
   Carrega dados EXCLUSIVAMENTE da DarkOdds via Next.js API.
   ZERO dados sintéticos. ZERO extendBackTo24h. ZERO geradores.
   Se DarkOdds não tiver, mostramos "—". Ponto.
============================================================ */

// ⚠️ URL do backend DarkOdds. Em produção, o ngrok pode mudar.
// Atualize o env var DARKODDS_URL no Vercel quando o túnel mudar.
const API_BASE_URL = 'https://rambling-crafty-riveting.ngrok-free.dev';

// Cache em memória pra evitar refetch desnecessário (TTL 2 min)
const apiCache = {
  live: {},
  history: {},
  odds: {},
};
const CACHE_TTL_MS = 2 * 60 * 1000;

function isCacheValid(entry) {
  return entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS;
}

// ============================================================
// 🛑 FUNÇÕES REMOVIDAS — dados sintéticos não são permitidos
// ============================================================

function extendBackTo24h() {
  throw new Error('REMOVIDO: dados sintéticos não permitidos');
}
function generateMockSeries() {
  throw new Error('REMOVIDO: dados sintéticos não permitidos');
}
function generateScoresForMosaic() {
  throw new Error('REMOVIDO: dados sintéticos não permitidos');
}
function generate24hHistory() {
  throw new Error('REMOVIDO: dados sintéticos não permitidos');
}

// ============================================================
// 🔌 INTEGRAÇÃO DarkOdds (via Next.js proxy)
// ============================================================

async function fetchLive(liga = 'copa') {
  if (isCacheValid(apiCache.live[liga])) {
    return apiCache.live[liga].data;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/live?liga=${encodeURIComponent(liga)}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache.live[liga] = { data, timestamp: Date.now() };
    console.log(`[DarkOdds] /api/live?liga=${liga}:`, {
      pontos: data.series?.over25?.length,
      power: data.power,
      atualizado: data.atualizado,
    });
    return data;
  } catch (err) {
    console.warn(`[DarkOdds] Falha em /api/live?liga=${liga}:`, err.message);
    return null;
  }
}

async function fetchHistory(liga = 'copa') {
  if (isCacheValid(apiCache.history[liga])) {
    return apiCache.history[liga].data;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/history?liga=${encodeURIComponent(liga)}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache.history[liga] = { data, timestamp: Date.now() };
    console.log(`[DarkOdds] /api/history?liga=${liga}:`, { registros: data.dados?.length });
    return data;
  } catch (err) {
    console.warn(`[DarkOdds] Falha em /api/history?liga=${liga}:`, err.message);
    return null;
  }
}

async function fetchOdds(liga = 'super') {
  if (isCacheValid(apiCache.odds[liga])) {
    return apiCache.odds[liga].data;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/odds?liga=${encodeURIComponent(liga)}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache.odds[liga] = { data, timestamp: Date.now() };
    console.log(`[DarkOdds] /api/odds?liga=${liga}:`, { jogos: data.jogos?.length });
    return data;
  } catch (err) {
    console.warn(`[DarkOdds] Falha em /api/odds?liga=${liga}:`, err.message);
    return null;
  }
}

// ============================================================
// 🏷️ NOMES DOS MERCADOS
// ============================================================

const MARKETS = {
  copa:  { name: 'Copa',  icon: '🏆' },
  euro:  { name: 'Euro',  icon: '🌍' },
  super: { name: 'Super', icon: '💥' },
  premier: { name: 'Premier', icon: '🏴' },
};

function buildSeries(values, startTime) {
  return values.map((v, i) => ({
    time: Math.floor(startTime.getTime() / 1000) + i * 240,
    value: v,
    index: i,
  }));
}

// ============================================================
// 📥 loadMarket — ÚNICA função pública de carregamento
// ============================================================
// Tenta /api/virtual (que chama DarkOdds). Se falhar, mostra erro.
// NUNCA inventa dados. NUNCA chama extendBackTo24h.

async function loadMarket(marketKey = 'copa') {
  const fallback = MARKETS[marketKey] || MARKETS.copa;
  const now = new Date();

  // Tenta Virtual API (DarkOdds via Next.js proxy)
  try {
    const res = await fetch('/api/virtual');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const virtual = await res.json();
    if (!virtual?.leagues) throw new Error('Resposta inválida');

    // Salva match data global para o painel
    window.__LAST_MATCH = virtual.leagues;

    // Indicador de idade dos dados no UI
    try {
      const ageEl = document.getElementById('dataAge');
      if (ageEl && virtual?.atualizado_em) {
        const ageMs = Date.now() - new Date(virtual.atualizado_em).getTime();
        const ageMin = Math.round(ageMs / 60000);
        if (ageMin <= 1) {
          ageEl.textContent = '\u{1F7E2} Agora';
          ageEl.style.color = '#26c281';
        } else if (ageMin <= 10) {
          ageEl.textContent = `\u{1F7E1} ${ageMin} min atrás`;
          ageEl.style.color = '#ffb547';
        } else {
          ageEl.textContent = `\u{1F534} ${ageMin} min atrás`;
          ageEl.style.color = '#ef4444';
        }
      }
    } catch (e) { /* silencioso */ }

    const leagueData = virtual.leagues[marketKey];
    if (!leagueData || leagueData.error) {
      throw new Error(leagueData?.error || 'Liga não disponível');
    }

    // Pega a série de GOLS REAIS INTEIROS (prioridade total_goals)
    const series = leagueData.series || {};
    const rawValues = series.total_goals && series.total_goals.length >= 3
      ? series.total_goals
      : series.over25;

    if (!rawValues || rawValues.length < 5) {
      throw new Error(`DarkOdds sem dados para ${marketKey}`);
    }

    // Timestamps: total_goals não tem timestamps próprios — usa step fixo
    const startTime = new Date(now.getTime() - (rawValues.length - 1) * 240 * 1000);

    const match = leagueData.match || {};
    const seriesLabel = series.total_goals?.length >= 3 ? 'total_goals' : 'over25';
    console.log(`[VirtualAPI] ${marketKey}: ${match.timeA||'?'} vs ${match.timeB||'?'} [${match.resultado||'?'}] ${seriesLabel} length=${rawValues.length} (real)`);

    return {
      name: fallback.name,
      icon: fallback.icon,
      data: buildSeries(rawValues, startTime),
      power: leagueData.power || null,
      atualizado: virtual.atualizado_em || new Date().toISOString(),
      fonte: 'virtual',
      realCount: rawValues.length,
      match,
      odds: leagueData.odds || null,
      recent_matches: leagueData.recent_matches || [],
      leagueStatus: Object.fromEntries(
        Object.entries(virtual.leagues).map(([k, v]) => [
          k, v.error ? { error: v.error } : {
            placar: v.match?.resultado,
            over25: v.prob?.over25,
            btts: v.prob?.btts_sim,
          }
        ])
      ),
    };
  } catch (err) {
    console.error('[VirtualAPI] DarkOdds indisponível:', err.message);
    throw new Error(`DarkOdds offline: ${err.message}`);
  }
}
