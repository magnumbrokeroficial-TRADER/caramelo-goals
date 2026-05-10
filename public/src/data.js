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

// ============================================================
// 🕐 EXTENSÃO PARA 24 HORAS
// ============================================================
// Pega uma série existente (ex: 76 valores reais) e prepende
// pontos sintéticos plausíveis cobrindo as horas anteriores
// até completar 24h (360 rodadas de 4 minutos).
//
// Estratégia:
// 1. Os valores reais ficam preservados no FIM da série
// 2. A geração começa do primeiro valor real e caminha pra trás,
//    fazendo um random walk reverso que respeita média e variância
//    da série real
// 3. Aplicamos um leve viés por hora do dia: madrugada (00-05h)
//    tende a ter valores ~3 menores; pico noturno (20-23h) ~2 maiores
// 4. Garantimos transição suave: o último ponto sintético é próximo
//    do primeiro ponto real (sem salto visível)
// ============================================================

function extendBackTo24h(realValues, totalRounds = 360, anchorHour = null) {
  if (realValues.length >= totalRounds) return realValues.slice(-totalRounds);

  const needed = totalRounds - realValues.length;

  // Estatísticas da série real
  const mean = realValues.reduce((s, v) => s + v, 0) / realValues.length;
  const variance = realValues.reduce((s, v) => s + (v - mean) ** 2, 0) / realValues.length;
  const std = Math.sqrt(variance);

  // PRNG determinístico (seed = hash dos primeiros valores reais)
  let s = realValues.slice(0, 5).reduce((a, b) => a + b * 7919, 0);
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // Hora do dia em Brasília "agora" como referência
  const now = new Date();
  const nowHourBR = anchorHour !== null
    ? anchorHour
    : parseInt(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));

  // Caminhamos do primeiro valor real PRA TRÁS gerando pontos
  // que terminem perto desse valor (suavidade na junção)
  const generated = new Array(needed);
  let v = realValues[0]; // ponto-âncora: o primeiro valor real

  for (let i = needed - 1; i >= 0; i--) {
    // Posição absoluta (0 = início, totalRounds = fim)
    const absoluteIdx = i;
    // Quantos pontos antes do "agora" estamos
    const minutesBefore = (totalRounds - absoluteIdx) * 4;
    const hoursBefore = minutesBefore / 60;
    // Hora do dia naquele momento (Brasília)
    const hourAtPoint = (nowHourBR - hoursBefore + 48) % 24;

    // Viés por horário
    let hourBias = 0;
    if (hourAtPoint >= 0 && hourAtPoint < 5) hourBias = -3;       // madrugada
    else if (hourAtPoint >= 5 && hourAtPoint < 9) hourBias = -1;  // manhã cedo
    else if (hourAtPoint >= 20 && hourAtPoint < 24) hourBias = 2; // pico noturno
    else hourBias = 0;

    // Random walk reverso: tende a oscilar em torno de (mean + hourBias)
    const target = mean + hourBias;
    const noise = (rand() - 0.5) * std * 1.4;
    const drift = (rand() - 0.5) * 2;
    v = v + drift + (target - v) * 0.18 + noise * 0.5;
    v = Math.max(20, Math.min(70, v));
    generated[i] = Math.round(v);
  }

  // Suavização da junção: força o último ponto sintético a ser
  // exatamente o primeiro real - 1 (transição limpa)
  const transitionTarget = realValues[0] + Math.round((rand() - 0.5) * 2);
  generated[needed - 1] = transitionTarget;

  return [...generated, ...realValues];
}

// Mercados disponíveis (carrega real estendido, senão gera 360 pontos)
const TOTAL_ROUNDS_24H = 360; // 24h × 60min / 4min por rodada

const MARKETS = {
  copa:    { name: 'Copa',    icon: '🏆', values: extendBackTo24h(REAL_DATA.copa, TOTAL_ROUNDS_24H) },
  euro:    { name: 'Euro',    icon: '🌍', values: generateMockSeries(2, TOTAL_ROUNDS_24H, 42, 6) },
  super:   { name: 'Super',   icon: '💥', values: generateMockSeries(3, TOTAL_ROUNDS_24H, 48, 7) },
  premier: { name: 'Premier', icon: '🏴', values: generateMockSeries(4, TOTAL_ROUNDS_24H, 44, 5) },
};

// Constrói série de pontos com timestamps (1 ponto = 4 minutos)
function buildSeries(values, startTime) {
  return values.map((v, i) => ({
    time: Math.floor(startTime.getTime() / 1000) + i * 240,
    value: v,
    index: i,
  }));
}

// Carrega mercado e retorna pontos prontos para o gráfico.
// O ÚLTIMO ponto da série é "agora" (Brasília); os anteriores
// caminham para trás 4min cada.
function loadMarket(marketKey) {
  const market = MARKETS[marketKey] || MARKETS.copa;
  const now = new Date();
  // startTime = agora menos (count - 1) × 4 minutos
  const startTime = new Date(now.getTime() - (market.values.length - 1) * 240 * 1000);
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

// ============================================================
// Histórico de 24h agrupado por hora (mosaico expandido)
// ============================================================
// Para cada hora retorna estatísticas agregadas:
//   { hour, totalGames, winGames, totalGoals, avgGoals }
// Padrão = avalia regra "over25" (≥3 gols), mas o consumidor
// pode passar uma função custom.
function generate24hHistory(rule = (s => (s.home + s.away) >= 3), gamesPerHour = 60) {
  // Pega a hora atual de Brasília como referência
  const now = new Date();
  const nowBrHour = parseInt(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));

  const hours = [];
  for (let h = 0; h < 24; h++) {
    // hour = hora de Brasília "anteriorizada" pela posição
    const hour = (nowBrHour - 23 + h + 24) % 24;

    let totalGames = 0, winGames = 0, totalGoals = 0;

    // Cada hora tem aproximadamente gamesPerHour jogos virtuais
    // Variação por horário do dia: pico noturno tem mais ação
    const activityMultiplier = (hour >= 18 || hour <= 2) ? 1.0 : (hour >= 9 ? 0.85 : 0.6);
    const games = Math.floor(gamesPerHour * activityMultiplier);

    // Bias por horário: madrugada tende a ter menos gols
    const goalBias = (hour >= 22 || hour <= 4) ? -0.3 : (hour >= 18 ? 0.2 : 0);

    for (let g = 0; g < games; g++) {
      // Distribuição realista: maioria dos jogos com 1-3 gols totais
      const lambda = 2.5 + goalBias + (Math.random() - 0.5) * 1.5;
      const home = Math.max(0, Math.round((Math.random() * 0.6 + 0.2) * lambda));
      const away = Math.max(0, Math.round((Math.random() * 0.6 + 0.2) * lambda));
      const totalG = home + away;
      const score = { home, away, totalGoals: totalG };

      totalGames++;
      totalGoals += totalG;
      if (rule(score)) winGames++;
    }

    hours.push({
      hour,
      totalGames,
      winGames,
      totalGoals,
      avgGoals: totalGames > 0 ? totalGoals / totalGames : 0,
    });
  }

  return hours;
}
