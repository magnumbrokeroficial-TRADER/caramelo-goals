// ==================================================
// CARAMELO GOALS (FINAL)
// Backend: DarkOdds via ngrok → dados reais Bet365
// ==================================================

const API_BASE = 'https://rambling-crafty-riveting.ngrok-free.dev';

// Cache interno
let liveCache = null;
let lastFetchTime = 0;

// Busca dados reais do backend (com cache de 60s)
async function fetchLiveData() {
  const now = Date.now();
  if (liveCache && (now - lastFetchTime) < 60000) return liveCache;
  try {
    const resp = await fetch(`${API_BASE}/api/live`, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      mode: 'cors'
    });
    liveCache = await resp.json();
    lastFetchTime = now;
    return liveCache;
  } catch (e) {
    console.warn('Backend offline, usando dados mockados');
    return null;
  }
}

// MARKETS (usado pela UI)
const MARKETS = {
  copa:     { name: 'Copa',     icon: '🏆' },
  euro:     { name: 'Euro',     icon: '🌍' },
  super:    { name: 'Super',    icon: '💥' },
  premier:  { name: 'Premier',  icon: '🏴' },
};

// Dados de fallback (mock)
const MOCK_VALUES = [
  43,44,44,46,46,42,40,41,45,46,42,43,45,47,51,54,50,49,52,51,
  48,47,46,48,47,44,43,43,43,44,41,37,35,36,33,37,39,42,42,39,
  42,40,42,43,44,44,47,51,50,52,56,55,55,49,48,45,44,46,48,49,
  49,47,46,49,49,49,50,51,49,49,49,47,49,49,52,52
];

let lastIdx = MOCK_VALUES.length - 1;
const TOTAL_ROUNDS_24H = 24;

// Formata dados para o gráfico Lightweight Charts
function formatChartData(valores) {
  const now = Math.floor(Date.now() / 1000);
  return valores.map((v, i) => ({
    time: now - (valores.length - i) * 240,
    value: typeof v === 'number' ? v : parseFloat(v) || 0
  }));
}

// Função que o app.js do Oliver chama para carregar um mercado
function loadMarket(marketKey) {
  let valores;
  if (window.__dadosReais && window.__dadosReais.length > 0) {
    valores = window.__dadosReais;
  } else {
    valores = MOCK_VALUES;
  }
  lastIdx = valores.length - 1;
  return {
    key: marketKey,
    name: MARKETS[marketKey]?.name || marketKey,
    data: formatChartData(valores)
  };
}

// Mosaico: gera uma grade 2D (6 linhas x 4 colunas)
function generateScoresForMosaic(rule, rows = 6, cols = 4) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const hg = Math.floor(Math.random() * 5);
      const ag = Math.floor(Math.random() * 4);
      const total = hg + ag;
      let passes = false;
      switch (rule) {
        case 'over25':  passes = total > 2.5; break;
        case 'over15':  passes = total > 1.5; break;
        case 'over35':  passes = total > 3.5; break;
        case 'under25': passes = total <= 2.5; break;
        case 'btts':    passes = hg > 0 && ag > 0; break;
        default:        passes = total > 2.5;
      }
      row.push({ home: hg, away: ag, total, passes, time: `${String(r*cols+c).padStart(2,'0')}:00` });
    }
    grid.push(row);
  }
  return grid;
}

// Histórico das últimas 24h (mock – será substituído quando o backend fornecer)
function generate24hHistory(rule) {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const hg = Math.floor(Math.random() * 5);
    const ag = Math.floor(Math.random() * 4);
    const total = hg + ag;
    let passes = false;
    switch (rule) {
      case 'over25':  passes = total > 2.5; break;
      case 'over15':  passes = total > 1.5; break;
      case 'over35':  passes = total > 3.5; break;
      case 'under25': passes = total <= 2.5; break;
      case 'btts':    passes = hg > 0 && ag > 0; break;
      default:        passes = total > 2.5;
    }
    hours.push({ hour: `${String(h).padStart(2,'0')}:00`, home: hg, away: ag, total, passes });
  }
  return hours;
}

// Ao carregar a página, busca dados reais e injeta no window
fetchLiveData().then(data => {
  if (data && data.serie_over25 && data.serie_over25.length > 0) {
    window.__dadosReais = data.serie_over25;
    lastIdx = data.serie_over25.length - 1;
    console.log('✅ Dados reais do DarkOdds carregados:', data.serie_over25.length, 'pontos');
  }
});
