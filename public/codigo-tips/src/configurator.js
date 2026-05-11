/* ============================================================
   ⚙️ CONFIGURATOR — Painel de configuração interativo
   ============================================================
   Permite ajustar limiares dos indicadores e ver o backtest
   recalcular em tempo real. Salva no localStorage para
   persistir entre sessões.
============================================================ */

const ConfigStore = {
  defaults: {
    rsiPeriod: 14,
    rsiOversold: 35,
    rsiOverbought: 68,
    bollingerWindow: 20,
    bollingerStd: 1.8,
    maFast: 9,
    maSlow: 21,
    backtestHorizon: 3,
    minConfidence: 50,        // (era 60) — agora o filtro principal é accuracy
    minPatternAccuracy: 60,   // novo: padrão precisa ter ≥60% acerto histórico (≤40% erro)
    disabledDetectors: [],    // padrões desligados pelo usuário no Mapa de Sinais
    autoSelectMode: false,    // se true, usa só os top N detectores por accuracy
    autoSelectTopN: 5,
    signalSpacing: 4,
    maxMarkers: 20,
    macroSwingBars: 12,
    microSwingBars: 4,
    srTolerance: 2.5,
    srMinTouches: 3,
    showTrendlines: true,
    showZones: true,
  },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('caramelo_config') || '{}');
      return { ...this.defaults, ...saved };
    } catch {
      return { ...this.defaults };
    }
  },

  save(cfg) {
    localStorage.setItem('caramelo_config', JSON.stringify(cfg));
  },

  reset() {
    localStorage.removeItem('caramelo_config');
    return { ...this.defaults };
  },
};

// Lê os sliders atuais e devolve config
function readSliders() {
  const current = ConfigStore.load();
  return {
    ...current, // preserva campos que não têm slider visual (showTrendlines, etc)
    rsiPeriod: parseInt(document.getElementById('cfgRsiPeriod').value),
    rsiOversold: parseInt(document.getElementById('cfgRsiOver').value),
    rsiOverbought: parseInt(document.getElementById('cfgRsiBought').value),
    bollingerWindow: parseInt(document.getElementById('cfgBollWin').value),
    bollingerStd: parseInt(document.getElementById('cfgBollStd').value) / 10,
    maFast: parseInt(document.getElementById('cfgMaFast').value),
    maSlow: parseInt(document.getElementById('cfgMaSlow').value),
    backtestHorizon: parseInt(document.getElementById('cfgBtHorizon').value),
    minConfidence: parseInt(document.getElementById('cfgMinConf').value),
    signalSpacing: parseInt(document.getElementById('cfgSignalSpacing')?.value || current.signalSpacing),
    maxMarkers: parseInt(document.getElementById('cfgMaxMarkers')?.value || current.maxMarkers),
    macroSwingBars: parseInt(document.getElementById('cfgMacroSwing')?.value || current.macroSwingBars),
    microSwingBars: parseInt(document.getElementById('cfgMicroSwing')?.value || current.microSwingBars),
  };
}

// Aplica config nos sliders (usado ao carregar/restaurar)
function writeSliders(cfg) {
  document.getElementById('cfgRsiPeriod').value = cfg.rsiPeriod;
  document.getElementById('cfgRsiOver').value = cfg.rsiOversold;
  document.getElementById('cfgRsiBought').value = cfg.rsiOverbought;
  document.getElementById('cfgBollWin').value = cfg.bollingerWindow;
  document.getElementById('cfgBollStd').value = Math.round(cfg.bollingerStd * 10);
  document.getElementById('cfgMaFast').value = cfg.maFast;
  document.getElementById('cfgMaSlow').value = cfg.maSlow;
  document.getElementById('cfgBtHorizon').value = cfg.backtestHorizon;
  document.getElementById('cfgMinConf').value = cfg.minConfidence;
  if (document.getElementById('cfgSignalSpacing')) document.getElementById('cfgSignalSpacing').value = cfg.signalSpacing;
  if (document.getElementById('cfgMaxMarkers')) document.getElementById('cfgMaxMarkers').value = cfg.maxMarkers;
  if (document.getElementById('cfgMacroSwing')) document.getElementById('cfgMacroSwing').value = cfg.macroSwingBars;
  if (document.getElementById('cfgMicroSwing')) document.getElementById('cfgMicroSwing').value = cfg.microSwingBars;
  updateSliderLabels();
}

// Atualiza os números ao lado dos sliders quando o usuário mexe
function updateSliderLabels() {
  document.getElementById('cfgRsiPeriodVal').textContent = document.getElementById('cfgRsiPeriod').value;
  document.getElementById('cfgRsiOverVal').textContent = document.getElementById('cfgRsiOver').value;
  document.getElementById('cfgRsiBoughtVal').textContent = document.getElementById('cfgRsiBought').value;
  document.getElementById('cfgBollWinVal').textContent = document.getElementById('cfgBollWin').value;
  document.getElementById('cfgBollStdVal').textContent = (parseInt(document.getElementById('cfgBollStd').value) / 10).toFixed(1);
  document.getElementById('cfgMaFastVal').textContent = document.getElementById('cfgMaFast').value;
  document.getElementById('cfgMaSlowVal').textContent = document.getElementById('cfgMaSlow').value;
  document.getElementById('cfgBtHorizonVal').textContent = document.getElementById('cfgBtHorizon').value;
  document.getElementById('cfgMinConfVal').textContent = document.getElementById('cfgMinConf').value;
  if (document.getElementById('cfgSignalSpacing')) {
    document.getElementById('cfgSignalSpacingVal').textContent = document.getElementById('cfgSignalSpacing').value;
  }
  if (document.getElementById('cfgMaxMarkers')) {
    document.getElementById('cfgMaxMarkersVal').textContent = document.getElementById('cfgMaxMarkers').value;
  }
  if (document.getElementById('cfgMacroSwing')) {
    document.getElementById('cfgMacroSwingVal').textContent = document.getElementById('cfgMacroSwing').value;
  }
  if (document.getElementById('cfgMicroSwing')) {
    document.getElementById('cfgMicroSwingVal').textContent = document.getElementById('cfgMicroSwing').value;
  }
}

// Mostra preview ao vivo de quantos sinais a config atual produziria
function updateConfigPreview(values) {
  const cfg = readSliders();
  const state = calculateAllIndicators(values, cfg);
  const data = values.map((v, i) => ({ time: i, value: v, index: i }));
  const sigs = scanAllPatterns(state, data, cfg.minConfidence);
  const bt = backtestSignals(sigs, values, cfg.backtestHorizon);

  const preview = document.getElementById('configLiveStats');
  if (preview) {
    preview.innerHTML = `
      <div style="color: var(--text-muted); margin-bottom: 6px;">📊 Preview com a config atual:</div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <span style="color: var(--text-primary)"><strong>${sigs.length}</strong> sinais detectados</span>
        <span style="color: var(--green)">✓ ${bt.wins} acertos</span>
        <span style="color: var(--red)">✗ ${bt.losses} erros</span>
        <span style="color: ${bt.accuracy >= 60 ? 'var(--green)' : 'var(--yellow)'}; font-weight: 700">
          ${bt.accuracy.toFixed(1)}% de acerto
        </span>
      </div>
    `;
  }
}


// ====== CORREÇÃO AUTOMÁTICA DE LABELS (Bingo) ======
function autoFixConfigLabels() {
  document.querySelectorAll('#configModal label').forEach(label => {
    if (!label.getAttribute('for')) {
      const input = label.parentElement.querySelector('input, select');
      if (input) {
        if (!input.id) input.id = 'auto_' + Math.random().toString(36).substr(2, 6);
        label.setAttribute('for', input.id);
      }
    }
  });
}
