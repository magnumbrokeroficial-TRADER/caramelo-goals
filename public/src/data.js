// ====== DADOS DO MERCADO (Oliver + Bingo) ======
const API_BASE = 'https://rambling-crafty-riveting.ngrok-free.dev';

// Cache dos dados reais do backend
let cachedLiveData = null;
let lastFetch = 0;

async function fetchLiveData() {
  // Só busca a cada 60 segundos
  if (cachedLiveData && (Date.now() - lastFetch) < 60000) return cachedLiveData;
  try {
    const resp = await fetch(`${API_BASE}/api/live`);
    cachedLiveData = await resp.json();
    lastFetch = Date.now();
    return cachedLiveData;
  } catch {
    console.warn('Backend offline, usando fallback...');
    return null;
  }
}

// Dados mockados (fallback se backend offline)
const MOCK_VALUES = [
  43,44,44,46,46,42,40,41,45,46,42,43,45,47,51,54,50,49,52,51,
  48,47,46,48,47,44,43,43,43,44,41,37,35,36,33,37,39,42,42,39,
  42,40,42,43,44,44,47,51,50,52,56,55,55,49,48,45,44,46,48,49,
  49,47,46,49,49,49,50,51,49,49,49,47,49,49,52,52
];

function formatChartData(valores) {
  const now = Math.floor(Date.now() / 1000);
  return valores.map((v, i) => ({
    time: now - (valores.length - i) * 240,
    value: typeof v === 'number' ? v : parseFloat(v) || 0
  }));
}

// ====== FUNÇÃO QUE O APP.JS DO OLIVER ESPERA ======
function loadMarket(marketKey) {
  // Por enquanto, retorna os dados mockados formatados
  // No futuro, pode buscar do backend por mercado específico
  const chartData = formatChartData(MOCK_VALUES);
  return {
    key: marketKey,
    name: marketKey === 'copa' ? 'Copa' : marketKey,
    data: chartData
  };
}

// Tenta atualizar os dados com o backend (assíncrono)
fetchLiveData().then(data => {
  if (data && data.serie_over25 && data.serie_over25.length > 0) {
    window.__dadosReais = data.serie_over25;
    console.log('✅ Dados reais carregados do DarkOdds:', data.serie_over25.length, 'pontos');
  }
});
