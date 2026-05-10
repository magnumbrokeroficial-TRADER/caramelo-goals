const API_BASE = 'http://localhost:3003';

async function fetchLiveData() {
  try {
    const resp = await fetch(`${API_BASE}/api/live`);
    return await resp.json();
  } catch {
    console.warn('Backend offline, usando fallback...');
    return null;
  }
}

const MOCK_VALUES = [43,44,44,46,46,42,40,41,45,46,42,43,45,47,51,54,50,49,52,51,48,47,46,48,47,44,43,43,43,44,41,37,35,36,33,37,39,42,42,39,42,40,42,43,44,44,47,51,50,52,56,55,55,49,48,45,44,46,48,49,49,47,46,49,49,49,50,51,49,49,49,47,49,49,52,52];

function formatChartData(valores) {
  const now = Math.floor(Date.now() / 1000);
  return valores.map((v, i) => ({
    time: now - (valores.length - i) * 240,
    value: typeof v === 'number' ? v : parseFloat(v) || 0
  }));
}
