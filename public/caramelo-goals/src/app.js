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
  App.signals = scanAllPatterns(App.state, App.data, cfg.minConfidence);
  App.btResults = backtestSignals(App.signals, values, cfg.backtestHorizon);

  document.getElementById('hdrMarket').textContent = market.name;
  document.getElementById('hdrWindow').textContent = cfg.bollingerWindow;
  document.getElementById('footerWindow').textContent = cfg.bollingerWindow;
  document.getElementById('footerSignals').textContent = `${App.signals.length} sinais`;
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
  const values = App.state.values;
  App.mosaicGrid = generateScoresForMosaic(values, 20, 4);
  renderMosaic(App.mosaicGrid, App.currentRule || 'over25');
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
  timeScale: { borderColor: '#1f1f1f', timeVisible: true, secondsVisible: false },
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

  // Marcadores dos sinais no gráfico principal
  App.markers = App.signals.map(sig => ({
    time: sig.time,
    position: sig.direction === 'over' ? 'belowBar' : 'aboveBar',
    color: sig.direction === 'over' ? '#26c281' : '#ef4444',
    shape: sig.direction === 'over' ? 'arrowUp' : 'arrowDown',
    text: sig.pattern.split(' ')[0],
    size: 1,
  })).reverse();
  App.series.goals.setMarkers(App.markers);

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

  // Ajusta zoom inicial
  setTimeout(() => {
    App.charts.main.timeScale().fitContent();
    App.charts.rsi.timeScale().fitContent();
    App.charts.macd.timeScale().fitContent();
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

  // Toggles de exibição (Médias, Bandas, RSI, Marcadores)
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
    if (App.series.goals) {
      App.series.goals.setMarkers(e.target.checked ? (App.markers || []) : []);
    }
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
  ['cfgRsiPeriod','cfgRsiOver','cfgRsiBought','cfgBollWin','cfgBollStd','cfgMaFast','cfgMaSlow','cfgBtHorizon','cfgMinConf'].forEach(id => {
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

    // Recalcula tudo
    const values = App.data.map(d => d.value);
    const cfg = ConfigStore.load();
    App.state = calculateAllIndicators(values, cfg);
    App.signals = scanAllPatterns(App.state, App.data, cfg.minConfidence);
    App.btResults = backtestSignals(App.signals, values, cfg.backtestHorizon);

    // Atualiza gráfico
    App.series.goals.update(newPoint);
    const lastIdx = App.state.values.length - 1;
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

// ====== START ======
document.addEventListener('DOMContentLoaded', init);
