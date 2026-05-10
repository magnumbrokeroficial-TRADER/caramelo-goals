/* ============================================================
   📦 DATA LAYER — Camada de dados
   ============================================================
   Aqui ficam:
   - Os 76 valores reais do gráfico original (mercado "Copa")
   - Geradores de dados mock pros outros mercados
   - Estrutura padrão de cada ponto: { time, value, index }

   Quando plugar dados reais via API/WebSocket, é só substituir
   a função `loadMarket(market)` pra retornar os pontos vindos
   do servidor, mantendo a mesma estrutura.
============================================================ */

// Sequência REAL de "Total Gols (FT) janela 20" — extraída do print do usuário
// Cada valor = total de gols nas últimas 20 rodadas naquele instante
const REAL_DATA = {
  copa: [
    43,44,44,46,46,42,40,41,45,46,42,43,45,47,51,54,50,49,52,51,
    48,47,46,48,47,44,43,43,43,44,41,37,35,36,33,37,39,42,42,39,
    42,40,42,43,44,44,47,51,50,52,56,55,55,49,48,45,44,46,48,49,
    49,47,46,49,49,49,50,51,49,49,49,47,49,49,52,52
  ],
};

// Gerador para mercados sem dados reais carregados
function generateMockSeries(seed = 1, count = 76, base = 45, volatility = 5) {
  // PRNG simples baseado em seed pra dar reprodutibilidade
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const values = [];
  let v = base;
  for (let i = 0; i < count; i++) {
    // Componente de tendência cíclica + ruído
    const trend = Math.sin(i / 8) * 4;
    const noise = (rand() - 0.5) * volatility;
    const drift = (rand() - 0.5) * 1.5;
    v = v + drift + (base + trend - v) * 0.15 + noise * 0.4;
    v = Math.max(20, Math.min(70, v));
    values.push(Math.round(v));
  }
  return values;
}

// Mercados disponíveis (carrega real se existir, senão gera)
const MARKETS = {
  copa:    { name: 'Copa',    icon: '🏆', values: REAL_DATA.copa },
  euro:    { name: 'Euro',    icon: '🌍', values: generateMockSeries(2, 76, 42, 6) },
  super:   { name: 'Super',   icon: '💥', values: generateMockSeries(3, 76, 48, 7) },
  premier: { name: 'Premier', icon: '🏴', values: generateMockSeries(4, 76, 44, 5) },
};

// Constrói série de pontos com timestamps (1 ponto = 4 minutos)
function buildSeries(values, startTime) {
  return values.map((v, i) => ({
    time: Math.floor(startTime.getTime() / 1000) + i * 240,
    value: v,
    index: i,
  }));
}

// Carrega mercado e retorna pontos prontos para o gráfico
function loadMarket(marketKey) {
  const market = MARKETS[marketKey] || MARKETS.copa;
  const startTime = new Date();
  startTime.setHours(20, 40, 0, 0);
  startTime.setDate(startTime.getDate() - 1);
  return {
    name: market.name,
    icon: market.icon,
    data: buildSeries(market.values, startTime),
  };
}

// ============================================================
// 🎲 SIMULADOR DE PLACARES PARA O MOSAICO
// ============================================================
// O mosaico mostra placares reais de jogos individuais. Como
// os 76 pontos da nossa série representam JANELAS de gols, e
// não jogos individuais, simulamos placares plausíveis que,
// no agregado, somam ~ ao "total gols na janela" registrado.

function generateScoresForMosaic(values, columns = 20, rows = 4) {
  // Cada coluna do mosaico cobre ~3-4 rodadas; cada linha é
  // um "slot" de jogo simultâneo. Geramos placares que respeitam:
  //   1. Soma do bloco ≈ variação média de gols na janela
  //   2. Maior chance de placares altos quando série está em alta
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < columns; c++) {
      const dataIdx = Math.min(values.length - 1, Math.floor((c / columns) * values.length));
      const trend = values[dataIdx] || 45;
      // Maior trend → mais gols esperados (correlação positiva)
      const expectedGoals = Math.max(0, (trend - 30) / 8);
      const homeGoals = Math.floor(Math.random() * (expectedGoals * 0.7 + 1.5));
      const awayGoals = Math.floor(Math.random() * (expectedGoals * 0.7 + 1.5));
      row.push({ home: homeGoals, away: awayGoals, totalGoals: homeGoals + awayGoals });
    }
    grid.push(row);
  }
  return grid;
}
