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
  data: null,           // pontos atuais do mercado selecionado
  state: null,          // indicadores calculados
  signals: [],          // todos os sinais detectados
  btResults: null,      // resultado do backtest
  mosaicGrid: null,     // grid de placares do mosaico
  markers: [],          // marcadores no gráfico (setas dos sinais)
  charts: { main: null, rsi: null, macd: null },
  series: { goals: null, ma9: null, upper: null, middle: null, lower: null, rsi: null, macd: null },
  notifiedSignals: new Set(), // evitar notificar o mesmo sinal duas vezes
};

// ====== INICIALIZAÇÃO ======
function init() {
  // 1. Carrega config salva e aplica nos sliders
  const cfg = ConfigStore.load();
  writeSliders(cfg);

  // 2. Carrega mercado inicial (copa)
  loadAndRender(App.currentMarket);

  // 3. Configura listeners de UI
  setupEventListeners();

  // 4. Inicia simulação de tempo real (dispara nova rodada a cada 30s)
  startLiveSimulation();
}

// ====== CARREGA MERCADO E RENDERIZA TUDO ======
function loadAndRender(marketKey) {
  const cfg = ConfigStore.load();
  const market = loadMarket(marketKey);
  App.data = market.data;
  App.currentMarket = marketKey;

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

  // Gera mosaico ANTES do scan pra que score predictors possam usar
  // o histórico de placares simulados como referência empírica
  App.mosaicGrid = generateScoresForMosaic(values, 20, 4);
  App.state.recentScores = extractRecentScores(App.mosaicGrid, 30);

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

  // 3b. Filtro por ACURÁCIA: remove padrões com taxa de erro > 40%
  //     (ou seja, mantém só os com accuracy >= 60% no histórico).
  //     Pode ser desligado via cfg.skipAccuracyFilter (auto-modo usa o
  //     próprio rank, não precisa do filtro adicional).
  let accuracyStats = {};
  if (!cfg.skipAccuracyFilter && cfg.minPatternAccuracy > 0) {
    const result = filterByAccuracy(rawSignals, values, cfg.backtestHorizon, cfg.minPatternAccuracy);
    rawSignals = result.filtered;
    accuracyStats = result.stats;
  }

  // 4. Dedupe pra reduzir poluição visual
  App.signals = dedupeSignals(rawSignals, cfg.signalSpacing || 4, cfg.maxMarkers || 25);
  App.rawSignalCount = rawSignals.length;
  App.accuracyStats = accuracyStats;

  App.btResults = backtestSignals(App.signals, values, cfg.backtestHorizon);

  document.getElementById('hdrMarket').textContent = market.name;
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
  // Grid já foi gerado em loadAndRender; aqui só renderizamos
  if (!App.mosaicGrid) {
    App.mosaicGrid = generateScoresForMosaic(App.state.values, 20, 4);
  }
  renderMosaicLive(App.mosaicGrid, App.currentRule || 'over25');

  // Visão 24h — usa a mesma regra de Over/Under selecionada
  const ruleObj = MOSAIC_RULES[App.currentRule || 'over25'] || MOSAIC_RULES.over25;
  App.hourlyData = generate24hHistory(ruleObj.test);
  renderMosaic24h(App.hourlyData, App.currentRule || 'over25');
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

  // MM rápida
  App.series.ma9 = App.charts.main.addLineSeries({ color: '#facc15', lineWidth: 2, priceLineVisible: false });
  App.series.ma9.setData(App.state.mm9.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));

  // Linha principal de gols
  App.series.goals = App.charts.main.addLineSeries({
    color: '#f0f0f0', lineWidth: 2,
    priceLineColor: '#ffb547', priceLineStyle: 2,
    crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
  });
  App.series.goals.setData(App.data);

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

  // MACD/Momentum
  App.series.macd = App.charts.macd.addHistogramSeries({ priceFormat: { type: 'price', precision: 2, minMove: 0.01 } });
  App.series.macd.setData(App.state.mom.map((v, i) =>
    v !== null ? {
      time: App.data[i].time,
      value: parseFloat(v.toFixed(2)),
      color: v >= 0 ? 'rgba(38,194,129,0.85)' : 'rgba(239,68,68,0.85)'
    } : null
  ).filter(Boolean));
  App.series.macd.createPriceLine({ price: 0, color: '#444', lineWidth: 1, lineStyle: 0, axisLabelVisible: false });

  // Sincronização entre os 3 gráficos
  syncCharts([App.charts.main, App.charts.rsi, App.charts.macd]);

  // Ajusta zoom inicial: para séries longas (>120 pontos), mostra
  // apenas as últimas 6 horas (90 pontos). Para séries curtas, fitContent.
  setTimeout(() => {
    if (App.data.length > 120) {
      const lastTime = App.data[App.data.length - 1].time;
      const sixHoursAgo = lastTime - (6 * 60 * 60); // 6h em segundos
      App.charts.main.timeScale().setVisibleRange({
        from: sixHoursAgo,
        to: lastTime,
      });
    } else {
      App.charts.main.timeScale().fitContent();
    }
    // RSI e MACD vão sincronizar automaticamente via subscribeVisibleLogicalRangeChange
  }, 100);
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
  document.getElementById('tgMA')?.addEventListener('change', e => {
    if (App.series.ma9) App.series.ma9.applyOptions({ visible: e.target.checked });
  });
  document.getElementById('tgBands')?.addEventListener('change', e => {
    const v = e.target.checked;
    ['upper','middle','lower'].forEach(k => App.series[k]?.applyOptions({ visible: v }));
  });
  document.getElementById('tgRSI')?.addEventListener('change', e => {
    document.getElementById('rsiChart').parentElement.style.display = e.target.checked ? '' : 'none';
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

  // Tabs do mosaico (Live ↔ 24h)
  document.querySelectorAll('.mosaic-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mosaic-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabKey = tab.dataset.tab;
      document.querySelectorAll('.mosaic-pane').forEach(p => p.classList.remove('active'));
      document.getElementById(`mosaicPane${tabKey === 'live' ? 'Live' : '24h'}`).classList.add('active');
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

// ====== SIMULAÇÃO DE TEMPO REAL ======
// A cada 30 segundos, adiciona um novo ponto à série pra simular nova rodada chegando.
// Em produção, isso vira: WebSocket → recebe nova rodada → atualiza estado.
function startLiveSimulation() {
  setInterval(() => {
    const last = App.state.values[App.state.values.length - 1];
    const variation = (Math.random() - 0.5) * 6;
    const next = Math.max(20, Math.min(70, Math.round(last + variation)));

    // Adiciona novo ponto
    const lastTime = App.data[App.data.length - 1].time;
    const newPoint = { time: lastTime + 240, value: next, index: App.data.length };
    App.data.push(newPoint);

    // Janela rolante: descarta o ponto mais antigo se ultrapassou TOTAL_ROUNDS_24H
    if (App.data.length > TOTAL_ROUNDS_24H) {
      App.data.shift();
      // Reindexar pra manter coerência
      App.data.forEach((p, i) => { p.index = i; });
    }

    // Recalcula tudo
    const values = App.data.map(d => d.value);
    const cfg = ConfigStore.load();
    App.state = calculateAllIndicators(values, cfg);
    const rawSignals = scanAllPatterns(App.state, App.data, cfg.minConfidence);
    App.signals = dedupeSignals(rawSignals, cfg.signalSpacing || 4, cfg.maxMarkers || 25);
    App.btResults = backtestSignals(App.signals, values, cfg.backtestHorizon);

    // Em janela rolante, fazemos rebuild completo dos gráficos
    // pra garantir consistência visual (a série inteira muda de offset).
    // Caso contrário, só atualizamos o último ponto.
    if (App.data.length === TOTAL_ROUNDS_24H) {
      // Rebuild leve: atualiza dados de todas as séries de uma vez
      App.series.goals.setData(App.data);
      App.series.upper.setData(App.state.bands.upper.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
      App.series.middle.setData(App.state.bands.middle.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
      App.series.lower.setData(App.state.bands.lower.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
      App.series.ma9.setData(App.state.mm9.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
      App.series.rsi.setData(App.state.rsi.map((v, i) => v !== null ? { time: App.data[i].time, value: v } : null).filter(Boolean));
      App.series.macd.setData(App.state.mom.map((v, i) => v !== null ? {
        time: App.data[i].time,
        value: parseFloat(v.toFixed(2)),
        color: v >= 0 ? 'rgba(38,194,129,0.85)' : 'rgba(239,68,68,0.85)',
      } : null).filter(Boolean));
    } else {
      // Append incremental
      const lastIdx = App.state.values.length - 1;
      App.series.goals.update(newPoint);
      if (App.state.bands.upper[lastIdx] !== null) {
        App.series.upper.update({ time: newPoint.time, value: App.state.bands.upper[lastIdx] });
        App.series.middle.update({ time: newPoint.time, value: App.state.bands.middle[lastIdx] });
        App.series.lower.update({ time: newPoint.time, value: App.state.bands.lower[lastIdx] });
      }
      if (App.state.mm9[lastIdx] !== null) App.series.ma9.update({ time: newPoint.time, value: App.state.mm9[lastIdx] });
      if (App.state.rsi[lastIdx] !== null) App.series.rsi.update({ time: newPoint.time, value: App.state.rsi[lastIdx] });
      if (App.state.mom[lastIdx] !== null) App.series.macd.update({
        time: newPoint.time,
        value: parseFloat(App.state.mom[lastIdx].toFixed(2)),
        color: App.state.mom[lastIdx] >= 0 ? 'rgba(38,194,129,0.85)' : 'rgba(239,68,68,0.85)',
      });
    }

    // Recalcula markers (sinais + números) com dados atualizados
    App.markers = App.signals.map(sig => ({
      time: sig.time,
      position: sig.direction === 'over' ? 'belowBar' : 'aboveBar',
      color: sig.direction === 'over' ? '#26c281' : '#ef4444',
      shape: sig.direction === 'over' ? 'arrowUp' : 'arrowDown',
      size: 0,
    }));
    refreshMarkers();

    renderAllPanels();
    renderMosaicGrid();

    // Notifica novo sinal se for o caso
    if (App.signals.length > 0) {
      const newest = App.signals[0];
      const sigKey = `${newest.dataIndex}-${newest.pattern}`;
      if (!App.notifiedSignals.has(sigKey) && newest.dataIndex >= lastIdx - 1) {
        App.notifiedSignals.add(sigKey);
        showToast(newest);
        notifyAll(newest);
      }
    }
  }, 30000); // 30 segundos
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
        `${lastTime} · ${marketName} · ${last.value} gols`;

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
