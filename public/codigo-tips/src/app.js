console.log("%c CÓDIGO.TIPS v1.0.7 %c", "background:#ffb547;color:#000;padding:4px 8px;font-weight:bold;border-radius:4px;", "");
/* ============================================================
   🚀 APP ENTRY POINT
   ============================================================
   Wire de todos os módulos. Carrega dados, calcula indicadores,
   roda detectores, renderiza UI e configura event listeners.
============================================================ */

// Estado global da aplicação
const App = {
  currentMarket: 'copa',
  currentRule: 'over25',  // mercado de aposta selecionado para o mosaico
  mosaicHours: 24,       // período do mosaico (3, 6, 8, 12, 18, 24)
  qtdJogos: 360,         // jogos visíveis no zoom inicial
  data: null,           // pontos atuais do mercado selecionado
  state: null,          // indicadores calculados
  signals: [],          // todos os sinais detectados
  btResults: null,      // resultado do backtest
  mosaicGrid: null,     // grid de placares do mosaico
  markers: [],          // marcadores no gráfico (setas dos sinais)
  charts: { main: null, rsi: null, macd: null },
  series: { goals: null, vwap: null, upper: null, middle: null, lower: null, rsi: null, macd: null },
  notifiedSignals: new Set(), // evitar notificar o mesmo sinal duas vezes
};

// ====== INICIALIZAÇÃO ======
async function init() {
  // 1. Carrega config salva e aplica nos sliders
  const cfg = ConfigStore.load();
  writeSliders(cfg);

  // 2. Configura listeners JÁ (pra que o usuário possa interagir mesmo
  //    se a API estiver lenta)
  setupEventListeners();

  // 3. Carrega mercado inicial (copa) — aguarda fetch da API PulseScore
  await loadAndRender(App.currentMarket);

  // Pré-popula cache de sinais notificados com TODOS os sinais
  // históricos atuais (assim só notifica os que aparecerem ao vivo
  // depois deste ponto).
  if (App.signals) {
    App.signals.forEach(sig => {
      App.notifiedSignals.add(`${sig.dataIndex}-${sig.pattern}`);
    });
  }

  // 4. Inicia simulação de tempo real (dispara nova rodada a cada 30s)
  //    OBS: quando o backend tiver endpoint /api/live atualizado a cada 2h,
  //    podemos trocar essa simulação por polling real:
  //    setInterval(() => loadAndRender(App.currentMarket), 2*60*60*1000);
  startLiveSimulation();
}

// ====== CARREGA MERCADO E RENDERIZA TUDO ======
async function loadAndRender(marketKey) {
  const cfg = ConfigStore.load();

  // Mostra spinner enquanto carrega
  const hdrEl = document.getElementById('hdrMarket');
  if (hdrEl) hdrEl.textContent = '⏳ Carregando...';

  const market = await loadMarket(marketKey);
  App.data = market.data;
  App.currentMarket = marketKey;
  App.power = market.power;
  App.dataSource = market.fonte;
  App.dataUpdated = market.atualizado;
  App.realPointCount = market.realCount || 0;
  App.recent_matches = market.recent_matches || [];

  // Busca histórico em paralelo (não bloqueia)
  fetchHistory();

  const values = App.data.map(d => d.value);
  App.state = calculateAllIndicators(values, cfg);

  // 1. Calcula trendlines + zonas S/R PRIMEIRO (detectores S/R precisam disso)
  App.trendData = computeTrendlinesAndZones(values, {
    macroSwingBars: cfg.macroSwingBars || 12,
    microSwingBars: cfg.microSwingBars || 4,
    srTolerance: cfg.srTolerance || 2.5,
    srMinTouches: cfg.srMinTouches || 3,
  });

  // Injeta zones/trendlines no state pros detectores poderem consultar
  App.state.zones = App.trendData.zones;
  App.state.trendlines = [...App.trendData.macroLines, ...App.trendData.microLines];

  // MOSAICO REAL — usa recent_matches da DarkOdds (NUNCA sintético)
  App.mosaicGrid = App.recent_matches;
  App.state.recentScores = []; // scores reais indisponíveis via DarkOdds

  // 2. Fibonacci e Elliott
  App.fibData = computeFibonacci(values, cfg.fibWindow || 60);
  App.elliottData = detectElliottWaves(App.trendData.macroSwings, 8);

  // 3. Detecta TODOS os sinais brutos
  let rawSignals = scanAllPatterns(App.state, App.data, cfg.minConfidence);

  // 3a. Filtro por SELEÇÃO MANUAL (mapa de sinais): se o usuário desabilitou
  //     algum detector, remove esses sinais
  if (cfg.disabledDetectors && cfg.disabledDetectors.length > 0) {
    rawSignals = rawSignals.filter(s => !cfg.disabledDetectors.includes(s.pattern));
  }

  // 3b. Backtest completo (sempre roda, pra Mapa de Sinais ter stats)
  // E filtro por ACURÁCIA opcional
  let accuracyStats = {};
  if (rawSignals.length > 0) {
    const result = filterByAccuracy(rawSignals, values, cfg.backtestHorizon, cfg.minPatternAccuracy || 0);
    accuracyStats = result.stats;
    if (cfg.minPatternAccuracy > 0) {
      rawSignals = result.filtered;
    }
  }

  // 4. Dedupe pra reduzir poluição visual
  App.signals = dedupeSignals(rawSignals, cfg.signalSpacing || 4, cfg.maxMarkers || 25);
  App.rawSignalCount = rawSignals.length;
  App.accuracyStats = accuracyStats;

  App.btResults = backtestSignals(App.signals, values, cfg.backtestHorizon);

  // Atualiza header com fonte de dados
  const sourceTag = market.fonte === 'virtual'
    ? `🟢 Bet365 Virtual · ${market.match?.timeA||'?'} vs ${market.match?.timeB||'?'} [${market.match?.resultado||'?'}]`
    : market.fonte === 'pulse'
    ? `🔵 PulseScore · ${market.realCount}pts reais`
    : `🟡 Mock (API offline)`;
  const updatedTag = market.atualizado
    ? ` · atualizado ${BR.hm(new Date(market.atualizado))}`
    : '';
  document.getElementById('hdrMarket').innerHTML = `${market.name} <span class="hdr-source">${sourceTag}${updatedTag}</span>`;
  document.getElementById('hdrWindow').textContent = cfg.bollingerWindow;
  document.getElementById('footerWindow').textContent = cfg.bollingerWindow;
  document.getElementById('footerSignals').textContent = `${App.signals.length} sinais (${App.rawSignalCount} brutos)`;
  document.getElementById('scanLabel').textContent = `SCANNER · ${DETECTORS.length} padrões`;

  buildCharts();
  renderAllPanels();
  renderMosaicGrid();
}

function renderAllPanels() {
  const lastIdx = App.state.values.length - 1;
  renderCurrentAlert(App.signals[0]);
  renderIndicators(App.state, lastIdx);
  renderSignalHistory(App.signals, jumpToSignal);
  renderBacktest(App.signals, App.btResults);
  renderLegends(App.state, lastIdx);
}

function renderMosaicGrid() {
  // MOSAICO REAL — re-renderiza os recent_matches já carregados
  // Se não houver dados, mostra mensagem de vazio
  const matches = App.recent_matches || [];

  if (!matches.length) {
    const container = document.getElementById('mosaicGridLive');
    if (container) container.innerHTML = '<div class="mosaic-empty">DarkOdds sem partidas disponíveis</div>';
    const statsEl = document.getElementById('mosaicStatsLive');
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  renderMosaicLive(matches, App.currentRule || 'over25', {});
}

// ====== GRÁFICOS ======
const chartCommon = {
  layout: {
    background: { type: 'solid', color: '#000000' },
    textColor: '#facc15',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
  },
  grid: { vertLines: { color: 'rgba(31,31,31,0.5)' }, horzLines: { color: 'rgba(31,31,31,0.5)' } },
  crosshair: {
    mode: 1,
    vertLine: { color: '#ffb547', width: 1, style: 2 },
    horzLine: { color: '#ffb547', width: 1, style: 2 },
  },
  rightPriceScale: { borderColor: '#1f1f1f' },
  timeScale: {
    borderColor: '#1f1f1f',
    timeVisible: true,
    secondsVisible: false,
    // Formatador customizado pra exibir horário de Brasília no eixo X
    tickMarkFormatter: (time) => BR.hm(time),
  },
  localization: {
    timeFormatter: (time) => BR.hm(time),
    priceFormatter: price => Math.round(price).toString(),
  },
};

function buildCharts() {
  // Limpa charts antigos se existirem
  if (App.charts.main) App.charts.main.remove();
  if (App.charts.rsi) App.charts.rsi.remove();
  if (App.charts.macd) App.charts.macd.remove();

  const mainEl = document.getElementById('mainChart');
  const rsiEl = document.getElementById('rsiChart');
  const macdEl = document.getElementById('macdChart');

  App.charts.main = LightweightCharts.createChart(mainEl, {
    ...chartCommon, width: mainEl.clientWidth, height: mainEl.clientHeight,
  });
  App.charts.rsi = LightweightCharts.createChart(rsiEl, {
    ...chartCommon, width: rsiEl.clientWidth, height: rsiEl.clientHeight,
  });
  App.charts.macd = LightweightCharts.createChart(macdEl, {
    ...chartCommon, width: macdEl.clientWidth, height: macdEl.clientHeight,
  });

  // Bandas
  App.series.upper = App.charts.main.addLineSeries({ color: 'rgba(38,194,129,0.7)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  App.series.middle = App.charts.main.addLineSeries({ color: 'rgba(38,194,129,0.3)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
  App.series.lower = App.charts.main.addLineSeries({ color: 'rgba(239,68,68,0.7)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

  App.series.upper.setData(App.state.bands.upper.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
  App.series.middle.setData(App.state.bands.middle.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
  App.series.lower.setData(App.state.bands.lower.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));

  // MM9 removida

  // VWAP (média 50 períodos, roxa, sem números)
  App.series.vwap = App.charts.main.addLineSeries({
    color: '#a855f7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
  });
  App.series.vwap.applyOptions({
    priceFormat: { type: 'custom', minMove: 1, formatter: price => '' }
  });
  App.series.vwap.setData(App.state.vwap.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));

  // Linha principal de gols
  App.series.goals = App.charts.main.addLineSeries({
    color: '#f0f0f0', lineWidth: 2,
    priceLineColor: '#ffb547', priceLineStyle: 2,
    crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
  });
  App.series.goals.setData(App.data);
  App.series.goals.applyOptions({ priceFormat: { type: 'price', precision: 0, minMove: 1 } });;

  // ============================================================
  // 🎯 MARCADORES DE SINAL (versão limpa)
  // - Setas pequenas (size: 0)
  // - SEM texto sobreposto no gráfico (texto vai pro tooltip e
  //   sidebar de histórico)
  // - Apenas a primeira letra do padrão como referência mínima
  // ============================================================
  App.markers = App.signals.map(sig => ({
    time: sig.time,
    position: sig.direction === 'over' ? 'belowBar' : 'aboveBar',
    color: sig.direction === 'over' ? '#26c281' : '#ef4444',
    shape: sig.direction === 'over' ? 'arrowUp' : 'arrowDown',
    size: 0, // setas pequenas
    // Sem campo `text` — fica limpo
  }));

  // ============================================================
  // 🔢 NÚMEROS DE GOLS na linha branca
  // - Marcadores transparentes só com texto (o número de gols)
  // - Posicionados acima da barra
  // - Mostra apenas em valores significativos (picos/vales) pra
  //   não poluir muito; em produção pode ser configurável
  // ============================================================
  // Lógica anti-colisão: garante espaçamento mínimo entre números
  // E alterna position (above/below) para evitar valores grudados
  const goalNumberMarkers = [];
  const minIndexSpacing = Math.max(4, Math.floor(App.data.length / 45));
  let lastShownIdx = -100;
  let altPosition = false;

  App.data.forEach((d, i) => {
    const isLocalExtreme = isLocalPeakOrValley(App.data, i, 4);
    const isPeriodic = (i - lastShownIdx) >= minIndexSpacing;
    const shouldShow = isLocalExtreme || isPeriodic;
    if (!shouldShow) return;
    if (i - lastShownIdx < 2) return; // hard floor: nunca dois consecutivos

    altPosition = !altPosition;
    goalNumberMarkers.push({
      time: d.time,
      position: altPosition ? 'aboveBar' : 'belowBar',
      color: isLocalExtreme ? '#facc15' : 'rgba(240,240,240,0.5)',
      shape: 'circle',
      size: 0,
      text: String(d.value),
    });
    lastShownIdx = i;
  });

  // Une marcadores de sinais + números (a Lightweight Charts aceita um único array)
  // Ordena por tempo (requisito da API)
  const allMarkers = [...App.markers, ...goalNumberMarkers, ...(App.elliottMarkers || [])].sort((a, b) => a.time - b.time);
  App.series.goals.setMarkers(allMarkers);

  // ============================================================
  // 📐 TRENDLINES (macro + micro) e ZONAS S/R
  // Usa addLineSeries com 2 pontos extrapolados pra desenhar retas
  // ============================================================
  App.series.trendlines = [];
  App.series.zones = [];

  // ZONAS S/R (linhas horizontais bem visíveis no gráfico)
  if (App.state.config.showZones !== false) {
    App.trendData.zones.slice(0, 6).forEach((zone, idx) => {
      // ============================================================
      // EFEITO DE BANDA PREENCHIDA
      // Lightweight Charts não tem "rectangle fill" nativo, então
      // criamos N linhas horizontais empilhadas entre zone.low e
      // zone.high, com transparência ALTA cada uma. Sobrepostas,
      // dão impressão de banda colorida sólida.
      // ============================================================
      const bandColor = zone.strength >= 70
        ? '90, 100, 140'   // forte = azulado escuro
        : zone.strength >= 40
          ? '110, 130, 160'  // médio = azulado médio
          : '130, 145, 175'; // fraco = azulado claro

      const numBands = 7; // mais bandas = banda mais lisa
      for (let b = 0; b < numBands; b++) {
        const t = b / (numBands - 1); // 0 → 1
        const value = zone.low + (zone.high - zone.low) * t;
        const fillLine = App.charts.main.addLineSeries({
          color: `rgba(${bandColor}, ${0.16 + zone.strength / 800})`,
          lineWidth: 4,
          lineStyle: 0,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        fillLine.setData([
          { time: App.data[0].time, value },
          { time: App.data[App.data.length - 1].time, value },
        ]);
        App.series.zones.push(fillLine);
      }

      // Linha central destacada (mais sólida) com etiqueta no eixo
      const centerLine = App.charts.main.addLineSeries({
        color: `rgba(${bandColor}, 0.85)`,
        lineWidth: 1,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      centerLine.setData([
        { time: App.data[0].time, value: zone.center },
        { time: App.data[App.data.length - 1].time, value: zone.center },
      ]);
      // Etiqueta lateral identificando a zona (estilo DonForex)
      centerLine.createPriceLine({
        price: zone.center,
        color: `rgba(${bandColor}, 0)`, // transparente, só pra mostrar título
        lineWidth: 0,
        axisLabelVisible: true,
        title: `SRZ${zone.id} · R:${zone.range.toFixed(1)} · W:${zone.touches}`,
      });
      App.series.zones.push(centerLine);
    });
  }

  // TRENDLINES MACRO (laranja, mais grossa)
  if (App.state.config.showTrendlines !== false) {
    App.trendData.macroLines.forEach(line => {
      const series = App.charts.main.addLineSeries({
        color: line.type === 'resistance' ? 'rgba(239,68,68,0.85)' : 'rgba(38,194,129,0.85)',
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([
        { time: App.data[line.p1.index].time, value: line.p1.value },
        { time: App.data[line.extendTo].time, value: line.extrapolatedValue },
      ]);
      App.series.trendlines.push(series);
    });

    // TRENDLINES MICRO (mais finas, semi-transparentes)
    App.trendData.microLines.forEach(line => {
      const series = App.charts.main.addLineSeries({
        color: line.type === 'resistance' ? 'rgba(239,68,68,0.35)' : 'rgba(38,194,129,0.35)',
        lineWidth: 1,
        lineStyle: 2, // tracejada
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData([
        { time: App.data[line.p1.index].time, value: line.p1.value },
        { time: App.data[line.extendTo].time, value: line.extrapolatedValue },
      ]);
      App.series.trendlines.push(series);
    });
  }

  // ============================================================
  // 📏 FIBONACCI RETRACEMENT
  // - Linhas horizontais entre o swing high e o swing low recentes
  // - Apenas nos níveis 0/100% e nos "douradinhos" (38.2/50/61.8)
  //   pra evitar poluição visual
  // ============================================================
  App.series.fibLines = [];
  if (App.fibData && App.state.config.showFib !== false) {
    // Linha de marcação do leg (high → low ou low → high)
    const legSeries = App.charts.main.addLineSeries({
      color: 'rgba(255, 181, 71, 0.4)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    legSeries.setData([
      { time: App.data[App.fibData.legStart].time, value: App.fibData.direction === 'up' ? App.fibData.low : App.fibData.high },
      { time: App.data[App.fibData.legEnd].time, value: App.fibData.direction === 'up' ? App.fibData.high : App.fibData.low },
    ]);
    App.series.fibLines.push(legSeries);

    // Níveis "importantes" (filtrar pra não poluir)
    const importantLevels = App.fibData.levels.filter(
      l => l.importance === 'high' || l.importance === 'mid'
    );
    importantLevels.forEach(lvl => {
      legSeries.createPriceLine({
        price: lvl.value,
        color: lvl.color,
        lineWidth: lvl.importance === 'high' ? 2 : 1,
        lineStyle: lvl.importance === 'high' ? 1 : 2,
        axisLabelVisible: true,
        title: `Fib ${lvl.label}`,
      });
    });
  }

  // ============================================================
  // 🌊 ELLIOTT WAVES — labels nos pontos pivôs
  // Sempre renderiza se há dados; cor saturada quando estrutura
  // é válida (passou nas 3 regras), cor faded caso contrário
  // ============================================================
  App.elliottMarkers = [];
  if (App.elliottData && App.state.config.showElliott !== false) {
    App.elliottMarkers = App.elliottData.points.map(p => {
      const isValid = App.elliottData.isValid;
      let color;
      if (isValid) {
        color = p.isImpulsive ? '#ffb547' : '#a855f7';
      } else {
        // Estrutura indefinida: usa cinza translúcido
        color = p.type === 'H' ? 'rgba(255, 181, 71, 0.4)' : 'rgba(168, 85, 247, 0.4)';
      }
      return {
        time: App.data[p.index].time,
        position: p.type === 'H' ? 'aboveBar' : 'belowBar',
        color,
        shape: 'circle',
        size: 1,
        text: p.waveLabel,
      };
    });
  }

  // RSI
  App.series.rsi = App.charts.rsi.addLineSeries({ color: '#a855f7', lineWidth: 2 });
  App.series.rsi.setData(App.state.rsi.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
  App.series.rsi.createPriceLine({ price: App.state.config.rsiOverbought || 70, color: 'rgba(239,68,68,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
  App.series.rsi.createPriceLine({ price: App.state.config.rsiOversold || 30, color: 'rgba(38,194,129,0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true });
  App.series.rsi.createPriceLine({ price: 50, color: 'rgba(139,149,177,0.3)', lineWidth: 1, lineStyle: 1, axisLabelVisible: false });

  // MACD/Momentum (histograma) + signal line opcional
  App.series.macd = App.charts.macd.addHistogramSeries({ priceFormat: { type: 'price', precision: 2, minMove: 0.01 } });
  App.series.macd.setData(App.state.mom.map((v, i) =>
    v !== null ? {
      time: App.data[i].time,
      value: parseFloat(v.toFixed(2)),
      color: v >= 0 ? 'rgba(38,194,129,0.85)' : 'rgba(239,68,68,0.85)'
    } : null
  ).filter(Boolean));
  App.series.macd.createPriceLine({ price: 0, color: '#444', lineWidth: 1, lineStyle: 0, axisLabelVisible: false });

  // Signal line do MACD = EMA 9 do momentum (linha laranja sobreposta)
  // Cruzamento momento × signal é o sinal clássico de MACD
  const momValues = App.state.mom.map(v => v === null ? 0 : v);
  const signalLine = EMA(momValues, 9);
  const macdShown = document.getElementById('tgMACD')?.checked || false;
  App.series.macdSignal = App.charts.macd.addLineSeries({
    color: '#ffb547',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    visible: macdShown,
  });
  App.series.macdSignal.setData(signalLine.map((v, i) =>
    v !== null && App.state.mom[i] !== null ? { time: App.data[i].time, value: v } : null
  ).filter(Boolean));

  // Sincronização entre os 3 gráficos
  syncCharts([App.charts.main, App.charts.rsi, App.charts.macd]);

  // Subscribe na timeScale do gráfico principal pra atualizar
  // a barra UTC sempre que o usuário rola/zoom
  App.charts.main.timeScale().subscribeVisibleTimeRangeChange(updateUTCTimeBar);
  App.charts.main.timeScale().subscribeVisibleLogicalRangeChange(() => {
    // Chamada redundante mas garante atualização em todos os eventos
    requestAnimationFrame(updateUTCTimeBar);
  });

  // Ajusta zoom inicial: para séries longas (>120 pontos), mostra
  // apenas as últimas 6 horas (90 pontos). Para séries curtas, fitContent.
  setTimeout(() => {
    if (App.data.length > 120) {
      const lastTime = App.data[App.data.length - 1].time;
      const sixHoursAgo = lastTime - (6 * 60 * 60);
      App.charts.main.timeScale().setVisibleRange({
        from: sixHoursAgo,
        to: lastTime,
      });
    } else {
      App.charts.main.timeScale().fitContent();
    }
    // Primeira renderização da barra UTC
    updateUTCTimeBar();
  }, 100);
}

/* ============================================================
   📚 HISTÓRICO ACUMULADO (PulseScore / App.data)
   ============================================================ */

function fetchHistory() {
  const panel = document.getElementById('historyPanel');
  if (!panel) return;
  if (App.data && App.data.length) {
    const recent = App.data.slice(-20).map(d => d.value);
    panel.innerHTML = '<h3>Histórico Acumulado (DarkOdds)</h3><ul>' +
      recent.map(v => '<li>' + v + '</li>').join('') + '</ul>';
  } else {
    panel.innerHTML = '<p>Carregando histórico...</p>';
  }
}

function renderHistoryPanel() {
  const el = document.getElementById('historyPanel');
  if (!el) return;

  if (!App.history || !Array.isArray(App.history.dados) || App.history.dados.length === 0) {
    el.innerHTML = `<div class="history-empty">Sem dados de histórico para ${App.currentMarket}.<br><small>O backend retornou vazio ou está offline.</small></div>`;
    return;
  }

  const dados = App.history.dados;
  const total = dados.length;

  // Stats agregados
  let withSignal = 0, valueSum = 0, valueCount = 0, prob00Sum = 0, prob00Count = 0;
  const byMarket = {};
  const bySignal = {};

  dados.forEach(d => {
    const mercado = d.mercado || 'desconhecido';
    byMarket[mercado] = (byMarket[mercado] || 0) + 1;

    if (d.signal && d.signal !== '' && d.signal !== 'none') {
      withSignal++;
      bySignal[d.signal] = (bySignal[d.signal] || 0) + 1;
    }

    const vp = parseFloat(d.value_pct);
    if (!isNaN(vp)) { valueSum += vp; valueCount++; }

    const p00 = parseFloat(d.prob_00);
    if (!isNaN(p00)) { prob00Sum += p00; prob00Count++; }
  });

  const avgValuePct = valueCount > 0 ? (valueSum / valueCount) : 0;
  const avgProb00 = prob00Count > 0 ? (prob00Sum / prob00Count * 100) : 0;
  const signalPct = (withSignal / total * 100);

  // Últimos 5 jogos do histórico (mais recentes primeiro)
  const recent = dados.slice(-5).reverse();

  el.innerHTML = `
    <div class="history-stats">
      <div class="hist-stat"><span class="hist-label">Total jogos</span><span class="hist-value">${total}</span></div>
      <div class="hist-stat"><span class="hist-label">% com sinal</span><span class="hist-value">${signalPct.toFixed(1)}%</span></div>
      <div class="hist-stat"><span class="hist-label">Valor médio</span><span class="hist-value ${avgValuePct > 0 ? 'pos' : avgValuePct < 0 ? 'neg' : ''}">${avgValuePct.toFixed(1)}%</span></div>
      <div class="hist-stat"><span class="hist-label">Prob 0x0 média</span><span class="hist-value">${avgProb00.toFixed(1)}%</span></div>
    </div>

    ${Object.keys(bySignal).length > 0 ? `
    <div class="history-section-title">Sinais detectados</div>
    <div class="history-signals">
      ${Object.entries(bySignal).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([sig, n]) =>
        `<span class="hist-signal-chip">${sig}: <strong>${n}</strong></span>`
      ).join('')}
    </div>` : ''}

    <div class="history-section-title">Últimos jogos</div>
    <div class="history-list">
      ${recent.map(d => {
        const lambda = parseFloat(d.match_lambda) || 0;
        const real = parseFloat(d.real_prob) || 0;
        const fair = parseFloat(d.fair_prob) || 0;
        const value = parseFloat(d.value_pct) || 0;
        const valueClass = value > 5 ? 'pos' : value < -5 ? 'neg' : 'neutral';
        return `
          <div class="history-item">
            <div class="hi-match">${d.match || '—'}</div>
            <div class="hi-meta">
              <span title="match_lambda">λ ${lambda.toFixed(2)}</span>
              <span title="real_prob vs fair_prob">${(real * 100).toFixed(0)}% / ${(fair * 100).toFixed(0)}%</span>
              <span class="hi-value ${valueClass}" title="value_pct">${value.toFixed(1)}%</span>
              ${d.signal ? `<span class="hi-signal">${d.signal}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    ${App.power ? `
    <div class="history-section-title">Power da liga</div>
    <div class="history-power">
      <span>League λ: <strong>${(App.power.league_lambda || 0).toFixed(2)}</strong></span>
      <span>BTTS baseline: <strong>${((App.power.btts_baseline || 0) * 100).toFixed(1)}%</strong></span>
    </div>` : ''}
  `;
}

/* ============================================================
   🌍 BARRA UTC — sincronizada com o eixo X do gráfico principal
   ============================================================
   Usa timeToCoordinate() pra alinhar cada tick UTC exatamente
   com a posição em pixel correspondente no gráfico de gols.
   Atualiza em todo scroll/zoom via subscribeVisibleTimeRangeChange.
============================================================ */

function updateUTCTimeBar() {
  const container = document.getElementById('utcTicksContainer');
  if (!container || !App.charts.main) return;

  const ts = App.charts.main.timeScale();
  const visibleRange = ts.getVisibleRange();
  if (!visibleRange) return;

  const { from, to } = visibleRange;
  const rangeSec = to - from;
  if (rangeSec <= 0) return;

  // Decide intervalo de ticks baseado na janela visível
  // (mais zoom = ticks mais próximos no tempo)
  let stepSec;
  if (rangeSec < 60 * 60) stepSec = 5 * 60;          // <1h → cada 5min
  else if (rangeSec < 3 * 60 * 60) stepSec = 15 * 60; // <3h → cada 15min
  else if (rangeSec < 8 * 60 * 60) stepSec = 30 * 60; // <8h → cada 30min
  else if (rangeSec < 16 * 60 * 60) stepSec = 60 * 60; // <16h → 1h
  else stepSec = 2 * 60 * 60;                          // >16h → 2h

  // Alinha o primeiro tick ao múltiplo do step
  const firstTick = Math.ceil(from / stepSec) * stepSec;

  container.innerHTML = '';
  for (let t = firstTick; t <= to; t += stepSec) {
    const x = ts.timeToCoordinate(t);
    if (x === null || x < 0) continue;

    const span = document.createElement('span');
    // Marca como "major" se for hora cheia (00 minutos)
    const date = new Date(t * 1000);
    const isHourMark = date.getUTCMinutes() === 0;
    span.className = 'utc-tick' + (isHourMark ? ' major' : '');
    span.style.left = x + 'px';
    span.textContent = UTC.hm(t);
    container.appendChild(span);
  }
}

function syncCharts(charts) {
  charts.forEach((chart, i) => {
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      charts.forEach((other, j) => {
        if (i !== j && range) other.timeScale().setVisibleLogicalRange(range);
      });
    });
  });
}

function jumpToSignal(idx) {
  const time = App.data[idx]?.time;
  if (!time) return;
  // Lightweight Charts não tem "scrollToTime" direto, mas dá pra ajustar o range
  App.charts.main.timeScale().setVisibleRange({
    from: time - 240 * 15,
    to: time + 240 * 15,
  });
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
  // Mercados (Copa, Euro, Super, Premier)
  document.querySelectorAll('.market-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.market-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadAndRender(btn.dataset.market);
    });
  });

  // Mercados de aposta (Over 2.5, BTTS, etc) — controlam o mosaico
  document.querySelectorAll('.btn-market').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-market').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.currentRule = btn.dataset.rule;
      // Re-renderiza só o mosaico com a nova regra
      if (App.mosaicGrid) renderMosaic(App.mosaicGrid, App.currentRule);
    });
  });

  // Toggles de exibição (Médias, Bandas, RSI, Marcadores, Trendlines, Zonas, Números)
  document.getElementById('tgBands')?.addEventListener('change', e => {
    const v = e.target.checked;
    ['upper','middle','lower'].forEach(k => App.series[k]?.applyOptions({ visible: v }));
  });
  document.getElementById('tgRSI')?.addEventListener('change', e => {
    document.getElementById('rsiChart').parentElement.style.display = e.target.checked ? '' : 'none';
  });
  document.getElementById('tgMomentum')?.addEventListener('change', e => {
    document.getElementById('macdChart').parentElement.style.display = e.target.checked ? '' : 'none';
  });
  document.getElementById('tgMACD').checked = true;
  document.getElementById('tgMACD')?.addEventListener('change', e => {
    if (App.series.macdSignal) {
      App.series.macdSignal.applyOptions({ visible: e.target.checked });
    }
  });
  document.getElementById('tgMarkers')?.addEventListener('change', e => {
    refreshMarkers();
  });
  document.getElementById('tgNumbers')?.addEventListener('change', e => {
    refreshMarkers();
  });
  document.getElementById('tgTrendlines')?.addEventListener('change', e => {
    const v = e.target.checked;
    (App.series.trendlines || []).forEach(s => s.applyOptions({ visible: v }));
  });
  document.getElementById('tgZones')?.addEventListener('change', e => {
    const v = e.target.checked;
    (App.series.zones || []).forEach(s => s.applyOptions({ visible: v }));
  });
  document.getElementById('tgFib')?.addEventListener('change', e => {
    const v = e.target.checked;
    (App.series.fibLines || []).forEach(s => s.applyOptions({ visible: v }));
  });
  document.getElementById('tgElliott')?.addEventListener('change', e => {
    refreshMarkers();
  });

  // === MAPA DE SINAIS ===
  document.getElementById('btnSignalMap')?.addEventListener('click', () => {
    const cfg = ConfigStore.load();
    SignalMap.render(App.accuracyStats || {}, cfg.disabledDetectors || []);
    document.getElementById('signalMapModal').classList.add('active');
  });
  document.getElementById('closeSignalMap')?.addEventListener('click', () => {
    document.getElementById('signalMapModal').classList.remove('active');
  });
  document.getElementById('btnAutoSelect')?.addEventListener('click', () => {
    const auto = autoSelectBestDetectors(App.state, App.data, { topN: 5, minSamples: 3 });
    if (auto.top.length > 0) {
      SignalMap.applyAutoSelection(auto.top);
      showToast({
        pattern: '🤖 AUTO-SELEÇÃO',
        direction: 'over',
        confidence: 100,
        message: `Top 5 selecionados: ${auto.top.map(p => p.split(' ')[0]).join(', ')}`,
      });
    } else {
      alert('Histórico insuficiente pra auto-seleção. Tente com mais dados.');
    }
  });
  document.getElementById('btnSelectAll')?.addEventListener('click', () => SignalMap.selectAll(true));
  document.getElementById('btnSelectNone')?.addEventListener('click', () => SignalMap.selectAll(false));
  document.getElementById('btnApplySignalMap')?.addEventListener('click', () => {
    const cfg = ConfigStore.load();
    cfg.disabledDetectors = SignalMap.readSelection();
    ConfigStore.save(cfg);
    document.getElementById('signalMapModal').classList.remove('active');
    loadAndRender(App.currentMarket);
  });

  // Dropdown de horas do mosaico
  document.getElementById('mosaicHoursSelect')?.addEventListener('change', e => {
    App.mosaicHours = parseInt(e.target.value);
    e.target.value = App.mosaicHours;
    renderMosaicGrid();
  });

  // Toggles do mosaico (Times, Odds)
  document.getElementById('tgShowTeams')?.addEventListener('change', () => renderMosaicGrid());
  document.getElementById('tgShowOdds')?.addEventListener('change', () => renderMosaicGrid());

  // Dropdown Qtd. Jogos (zoom inicial / janela de dados)
  document.getElementById('qtdJogosSelect')?.addEventListener('change', e => {
    App.qtdJogos = parseInt(e.target.value);
    window.TOTAL_ROUNDS_24H = App.qtdJogos;
    loadAndRender(App.currentMarket);
  });

  // Botão "Limpar Tudo" (desliga todos os toggles do gráfico)
  document.getElementById('btnClearAll')?.addEventListener('click', () => {
    ['tgMA','tgBands','tgRSI','tgMomentum','tgMACD','tgMarkers','tgNumbers','tgTrendlines','tgZones','tgFib','tgElliott']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el && el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event('change'));
        }
      });
  });

  // Modal Configurador
  document.getElementById('btnConfig').addEventListener('click', () => {
    document.getElementById('configModal').classList.add('active');
    updateConfigPreview(App.state.values);
  });
  document.getElementById('closeConfig').addEventListener('click', () => {
    document.getElementById('configModal').classList.remove('active');
  });

  // Sliders — atualiza labels em tempo real e mostra preview
  ['cfgRsiPeriod','cfgRsiOver','cfgRsiBought','cfgBollWin','cfgBollStd','cfgMaFast','cfgMaSlow','cfgBtHorizon','cfgMinConf','cfgSignalSpacing','cfgMaxMarkers','cfgMacroSwing','cfgMicroSwing'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      updateSliderLabels();
      updateConfigPreview(App.state.values);
    });
  });

  document.getElementById('btnApplyCfg').addEventListener('click', () => {
    const newCfg = readSliders();
    ConfigStore.save(newCfg);
    document.getElementById('configModal').classList.remove('active');
    loadAndRender(App.currentMarket);
  });

  document.getElementById('btnResetCfg').addEventListener('click', () => {
    const def = ConfigStore.reset();
    writeSliders(def);
    updateConfigPreview(App.state.values);
  });

  // Modal Notificações
  document.getElementById('btnNotify').addEventListener('click', () => {
    document.getElementById('notifyModal').classList.add('active');
    loadNotifyForm();
  });
  document.getElementById('closeNotify').addEventListener('click', () => {
    saveNotifyForm();
    document.getElementById('notifyModal').classList.remove('active');
  });

  // Browser push
  document.getElementById('btnEnablePush').addEventListener('click', async () => {
    const result = await enableBrowserPush();
    const status = document.getElementById('pushStatus');
    status.textContent = `Status: ${result.msg}`;
    status.className = `notify-status ${result.ok ? 'ok' : 'err'}`;
  });

  // Telegram teste
  document.getElementById('btnTestTelegram').addEventListener('click', async () => {
    const token = document.getElementById('tgToken').value.trim();
    const chatId = document.getElementById('tgChatId').value.trim();
    saveNotifyForm();
    const result = await sendTelegram(token, chatId, '🎯 *Teste Caramelo Goals*\n\nSe você está vendo isso, as notificações Telegram estão funcionando!');
    const status = document.getElementById('tgStatus');
    status.textContent = result.msg;
    status.className = `notify-status ${result.ok ? 'ok' : 'err'}`;
  });

  // Dispara último sinal real (testa pipeline completo)
  document.getElementById('btnFireLastSignal')?.addEventListener('click', async () => {
    saveNotifyForm();
    if (!App.signals || App.signals.length === 0) {
      alert('Nenhum sinal disponível pra disparar. Aguarde o sistema detectar.');
      return;
    }
    const sig = App.signals[0];
    showToast(sig);
    await notifyAll(sig);
    const status = document.getElementById('tgStatus');
    status.textContent = `Disparado: ${sig.pattern} (${sig.confidence.toFixed(0)}%)`;
    status.className = 'notify-status ok';
  });

  // Discord teste
  document.getElementById('btnTestDiscord').addEventListener('click', async () => {
    const webhook = document.getElementById('dcWebhook').value.trim();
    saveNotifyForm();
    const fakeSignal = {
      pattern: 'TESTE', direction: 'over', confidence: 99,
      message: 'Esta é uma mensagem de teste do Caramelo Goals.',
      market: ['Over 2.5 FT'], value: 50,
      checks: [{ name: 'Conexão Discord', passed: true, detail: 'OK' }],
    };
    const result = await sendDiscord(webhook, fakeSignal);
    const status = document.getElementById('dcStatus');
    status.textContent = result.msg;
    status.className = `notify-status ${result.ok ? 'ok' : 'err'}`;
  });

  // Filtros de notificação
  document.getElementById('notifyMinConf').addEventListener('input', (e) => {
    document.getElementById('notifyMinConfVal').textContent = e.target.value;
  });

  // Resize
  window.addEventListener('resize', () => {
    if (!App.charts.main) return;
    const mainEl = document.getElementById('mainChart');
    const rsiEl = document.getElementById('rsiChart');
    const macdEl = document.getElementById('macdChart');
    App.charts.main.applyOptions({ width: mainEl.clientWidth, height: mainEl.clientHeight });
    App.charts.rsi.applyOptions({ width: rsiEl.clientWidth, height: rsiEl.clientHeight });
    App.charts.macd.applyOptions({ width: macdEl.clientWidth, height: macdEl.clientHeight });
    // Recalcula posições dos ticks UTC depois que o gráfico ajustou
    requestAnimationFrame(updateUTCTimeBar);
  });
}

function loadNotifyForm() {
  const cfg = NotifConfig.get();
  document.getElementById('tgToken').value = cfg.telegram.token || '';
  document.getElementById('tgChatId').value = cfg.telegram.chatId || '';
  document.getElementById('dcWebhook').value = cfg.discord.webhook || '';
  document.getElementById('notifyMinConf').value = cfg.filters.minConfidence;
  document.getElementById('notifyMinConfVal').textContent = cfg.filters.minConfidence;
  document.getElementById('notifyOver').checked = cfg.filters.over;
  document.getElementById('notifyUnder').checked = cfg.filters.under;
  document.getElementById('pushStatus').textContent = `Status: ${cfg.pushEnabled ? 'ativado' : 'desativado'}`;
  document.getElementById('pushStatus').className = `notify-status ${cfg.pushEnabled ? 'ok' : ''}`;
}

function saveNotifyForm() {
  const cfg = NotifConfig.get();
  cfg.telegram.token = document.getElementById('tgToken').value.trim();
  cfg.telegram.chatId = document.getElementById('tgChatId').value.trim();
  cfg.discord.webhook = document.getElementById('dcWebhook').value.trim();
  cfg.filters.minConfidence = parseInt(document.getElementById('notifyMinConf').value);
  cfg.filters.over = document.getElementById('notifyOver').checked;
  cfg.filters.under = document.getElementById('notifyUnder').checked;
  NotifConfig.save(cfg);
}

// ====== ATUALIZAÇÃO EM TEMPO REAL ======
// A cada 60 segundos, busca dados reais da API Bet365 Virtual.
// Removeu a simulação de random walk — agora usa dados ao vivo.

async function updateCurrentMatchPanel() {
  try {
    const res = await fetch('/api/virtual');
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.leagues) return;
    window.__LAST_MATCH = data.leagues;
    const header = document.getElementById('hdrMarket');
    const leagueData = data.leagues[App.currentMarket];
    if (header && leagueData?.match) {
      const m = leagueData.match;
      const marketName = MARKETS[App.currentMarket]?.name || 'Copa';
      header.innerHTML = `${marketName} <span class="hdr-source">🟢 Bet365 Virtual · ${m.timeA||'?'} vs ${m.timeB||'?'} [${m.resultado||'?'}] · ${m.minuto||'?'}'</span>`;
    }
  } catch (e) {
    console.warn('[updateCurrentMatchPanel]', e.message);
  }
}

function startLiveSimulation() {
  // Atualiza painel de partidas e recarrega dados reais a cada 60s
  setInterval(async () => {
    // 1. Atualiza painel de partidas (leve, só match info)
    await updateCurrentMatchPanel();

    // 2. Recarrega dados completos do mercado (gráfico + indicadores)
    if (App._loading) return;
    App._loading = true;
    try {
      await loadAndRender(App.currentMarket);
    } catch (e) {
      console.warn('[startLiveSimulation]', e.message);
    } finally {
      App._loading = false;
    }
  }, 600000);
}

// ============================================================
// 🔧 HELPERS DE MARCADORES
// ============================================================

// Detecta se um ponto é pico ou vale local (com janela window de cada lado)
function isLocalPeakOrValley(data, idx, window = 2) {
  if (idx < window || idx >= data.length - window) return false;
  const v = data[idx].value;
  let isPeak = true, isValley = true;
  for (let k = 1; k <= window; k++) {
    if (data[idx - k].value > v) isPeak = false;
    if (data[idx + k].value > v) isPeak = false;
    if (data[idx - k].value < v) isValley = false;
    if (data[idx + k].value < v) isValley = false;
  }
  return isPeak || isValley;
}

// Reaplica os marcadores no gráfico baseado nos toggles atuais
function refreshMarkers() {
  if (!App.series.goals) return;

  const showSignals = document.getElementById('tgMarkers')?.checked !== false;
  const showNumbers = document.getElementById('tgNumbers')?.checked !== false;
  const showElliott = document.getElementById('tgElliott')?.checked !== false;

  let toShow = [];

  if (showSignals && App.markers) {
    toShow = toShow.concat(App.markers);
  }

  if (showElliott && App.elliottMarkers) {
    toShow = toShow.concat(App.elliottMarkers);
  }

  if (showNumbers && App.data) {
    const minIndexSpacing = Math.max(4, Math.floor(App.data.length / 45));
    let lastShownIdx = -100;
    let altPosition = false;
    App.data.forEach((d, i) => {
      const isLocalExtreme = isLocalPeakOrValley(App.data, i, 4);
      const isPeriodic = (i - lastShownIdx) >= minIndexSpacing;
      const shouldShow = isLocalExtreme || isPeriodic;
      if (!shouldShow) return;
      if (i - lastShownIdx < 2) return;
      altPosition = !altPosition;
      toShow.push({
        time: d.time,
        position: altPosition ? 'aboveBar' : 'belowBar',
        color: isLocalExtreme ? '#facc15' : 'rgba(240,240,240,0.5)',
        shape: 'circle',
        size: 0,
        text: String(d.value),
      });
      lastShownIdx = i;
    });
  }

  toShow.sort((a, b) => a.time - b.time);
  App.series.goals.setMarkers(toShow);
}

// ============================================================
// 🕐 FOOTER CLOCK + INFO DE JOGOS
// ============================================================
// Atualiza a cada segundo:
// - Relógio em horário de Brasília
// - Info do jogo atual (último ponto da série)
// - Info do próximo jogo (4 minutos à frente)

function startFooterClock() {
  const update = () => {
    // Relógio Brasília
    document.getElementById('clockTime').textContent = BR.hms(Date.now());

    // Jogo atual: último ponto da série
    if (App.data && App.data.length > 0) {
      const last = App.data[App.data.length - 1];
      const lastTime = BR.hm(last.time);
      const marketName = MARKETS[App.currentMarket]?.name || 'Copa';
      document.getElementById('footerGameCurrent').textContent =
        `${lastTime} · ${marketName} · Exp. ${last.value} gols`;

      // Próximo jogo: +4 min
      const nextTime = last.time + 240;
      const nextDate = new Date(nextTime * 1000);
      const minutesAway = Math.max(0, Math.round((nextTime * 1000 - Date.now()) / 60000));
      const countdown = minutesAway > 0 ? ` (em ${minutesAway}min)` : ' (agora)';
      document.getElementById('footerGameNext').textContent =
        `${BR.hm(nextTime)}${countdown}`;
    }
  };

  update();
  setInterval(update, 1000);
}

// ====== START ======
document.addEventListener('DOMContentLoaded', () => {
  init();
  startFooterClock();
});
/* ============================================================
   ✅❌ USER FEEDBACK
   ============================================================
   Permite ao usuário marcar cada sinal como ACERTOU ou ERROU
   manualmente (caixinha ON-OFF nos cards). Feedback fica salvo
   no localStorage e pode ser usado para recalibrar accuracy
   no futuro.
============================================================ */

const UserFeedback = {
  STORAGE_KEY: 'codigotips_feedback',

  loadAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  },

  saveAll(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Falha ao salvar feedback:', e);
    }
  },

  // Pega feedback (win/loss/null) de um sinal
  // Aceita objeto sig ou string key
  get(sigOrKey) {
    const key = typeof sigOrKey === 'string' ? sigOrKey : `${sigOrKey.dataIndex}-${sigOrKey.pattern}`;
    return this.loadAll()[key] || null;
  },

  set(key, value) {
    const data = this.loadAll();
    data[key] = value;
    this.saveAll(data);
  },

  clear(key) {
    const data = this.loadAll();
    delete data[key];
    this.saveAll(data);
  },

  // Stats agregadas por padrão (para complementar o backtest automático)
  statsByPattern() {
    const all = this.loadAll();
    const byPattern = {};
    Object.entries(all).forEach(([key, fb]) => {
      const pattern = key.split('-').slice(1).join('-');
      if (!byPattern[pattern]) byPattern[pattern] = { wins: 0, losses: 0 };
      if (fb === 'win') byPattern[pattern].wins++;
      if (fb === 'loss') byPattern[pattern].losses++;
    });
    Object.values(byPattern).forEach(s => {
      s.total = s.wins + s.losses;
      s.accuracy = s.total > 0 ? (s.wins / s.total) * 100 : 0;
    });
    return byPattern;
  },
};
// deploy 1778562734
