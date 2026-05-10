const API_BASE = 'https://rambling-crafty-riveting.ngrok-free.dev';

let cachedLiveData = null;
let lastFetch = 0;

async function fetchLiveData() {
  if (cachedLiveData && (Date.now() - lastFetch) < 60000) return cachedLiveData;
  try {
    const resp = await fetch(`${API_BASE}/api/live`);
    cachedLiveData = await resp.json();
    lastFetch = Date.now();
    return cachedLiveData;
  } catch { return null; }
}

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

function loadMarket(marketKey) {
  // Tenta usar dados reais se já foram carregados
  const valores = (window.__dadosReais && window.__dadosReais.length > 0) ? window.__dadosReais : MOCK_VALUES;
  return {
    key: marketKey,
    name: marketKey === 'copa' ? 'Copa' : marketKey,
    data: formatChartData(valores)
  };
}

// Retorna uma grade 2D (array de arrays) como o mosaico espera
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
        case 'over25': passes = total > 2.5; break;
        case 'over15': passes = total > 1.5; break;
        case 'over35': passes = total > 3.5; break;
        case 'under25': passes = total <= 2.5; break;
        case 'btts': passes = hg > 0 && ag > 0; break;
        default: passes = total > 2.5;
      }
      row.push({ home: hg, away: ag, total, passes, time: `${String(r*cols+c).padStart(2,'0')}:00` });
    }
    grid.push(row);
  }
  return grid;
}

// Busca dados reais ao carregar
fetchLiveData().then(data => {
  if (data && data.serie_over25 && data.serie_over25.length > 0) {
    window.__dadosReais = data.serie_over25;
    console.log('✅ Dados reais carregados:', data.serie_over25.length, 'pontos');
  }
});

function generate24hHistory(rule) {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const hg = Math.floor(Math.random() * 5);
    const ag = Math.floor(Math.random() * 4);
    const total = hg + ag;
    let passes = false;
    switch (rule) {
      case 'over25': passes = total > 2.5; break;
      case 'over15': passes = total > 1.5; break;
      case 'over35': passes = total > 3.5; break;
      case 'under25': passes = total <= 2.5; break;
      case 'btts': passes = hg > 0 && ag > 0; break;
      default: passes = total > 2.5;
    }
    hours.push({ hour: `${String(h).padStart(2,'0')}:00`, home: hg, away: ag, total, passes });
  }
  return hours;
}
