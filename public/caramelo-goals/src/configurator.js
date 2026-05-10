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
    minConfidence: 35,
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
  return {
    rsiPeriod: parseInt(document.getElementById('cfgRsiPeriod').value),
    rsiOversold: parseInt(document.getElementById('cfgRsiOver').value),
    rsiOverbought: parseInt(document.getElementById('cfgRsiBought').value),
    bollingerWindow: parseInt(document.getElementById('cfgBollWin').value),
    bollingerStd: parseInt(document.getElementById('cfgBollStd').value) / 10,
    maFast: parseInt(document.getElementById('cfgMaFast').value),
    maSlow: parseInt(document.getElementById('cfgMaSlow').value),
    backtestHorizon: parseInt(document.getElementById('cfgBtHorizon').value),
    minConfidence: parseInt(document.getElementById('cfgMinConf').value),
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
