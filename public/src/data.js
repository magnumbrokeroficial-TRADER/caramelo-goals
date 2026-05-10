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
  return { key: marketKey, name: marketKey === 'copa' ? 'Copa' : marketKey, data: formatChartData(MOCK_VALUES) };
}

function generateScoresForMosaic(rule, count = 24) {
  const scores = [];
  for (let i = 0; i < count; i++) {
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
    scores.push({ home: hg, away: ag, total, passes, time: `${String(i).padStart(2,'0')}:00` });
  }
  return scores;
}
