/* ============================================================
   🎨 UI RENDERERS — funções de renderização dos painéis
============================================================ */

// ====== ALERTA ATUAL (painel direito superior) ======
function renderCurrentAlert(signal) {
  const el = document.getElementById('currentAlert');
  if (!el) return;

  if (!signal) {
    el.innerHTML = `<div style="padding:14px; background:var(--bg-elevated); border-radius:8px; color:var(--text-muted); font-size:12px; text-align:center">⏸ Sem padrão claro no momento. Aguardando próxima rodada.</div>`;
    return;
  }

  const dirColor = signal.direction === 'over' ? 'var(--green)' : 'var(--red)';
  const arrow = signal.direction === 'over' ? '⬆️' : '⬇️';

  el.innerHTML = `
    <div class="current-alert" style="background:linear-gradient(135deg, ${dirColor}22, ${dirColor}05); border-color:${dirColor}">
      <div class="alert-header">
        <div class="alert-pattern" style="color:${dirColor}">${arrow} ${signal.pattern}</div>
        <div class="alert-confidence" style="color:${dirColor}">${signal.confidence.toFixed(0)}%</div>
      </div>
      <div class="alert-desc">${signal.message}</div>
      <div class="alert-checklist">
        ${signal.checks.map(c => `
          <div class="checklist-item">
            <span class="check-icon ${c.passed ? 'passed' : (c.partial ? 'partial' : 'failed')}">
              ${c.passed ? '✓' : (c.partial ? '~' : '✗')}
            </span>
            <span>${c.name}</span>
            <span style="color:var(--text-muted); margin-left:auto">${c.detail || ''}</span>
          </div>
        `).join('')}
      </div>
      <div class="alert-recommendation">
        ${signal.market.map(m => `<span class="rec-tag">${m}</span>`).join('')}
      </div>
    </div>
  `;
}

// ====== INDICADORES (painel direito meio) ======
function renderIndicators(state, idx) {
  const el = document.getElementById('indicatorPanel');
  if (!el) return;

  const r = state.rsi[idx];
  const m = state.mom[idx];
  const pos = bandPosition(state.values[idx], state.bands.lower[idx], state.bands.upper[idx]);

  const rsiColor = r > 70 ? 'var(--red)' : (r < 30 ? 'var(--green)' : 'var(--yellow)');
  const momColor = m > 0 ? 'var(--green)' : 'var(--red)';
  const posColor = pos > 75 ? 'var(--red)' : (pos < 25 ? 'var(--green)' : 'var(--yellow)');

  el.innerHTML = `
    <div class="indicator-row"><span class="ind-label">📊 Exp. Gols</span><span class="ind-value" style="color:var(--white-line)">${state.values[idx]}</span></div>
    <div class="indicator-row"><span class="ind-label">📈 RSI</span><span class="ind-value" style="color:${rsiColor}">${r?.toFixed(1) || '--'}</span></div>
    <div class="indicator-row"><span class="ind-label">⚡ Momento</span><span class="ind-value" style="color:${momColor}">${(m > 0 ? '+' : '') + (m?.toFixed(2) || '--')}</span></div>
    <div class="indicator-row"><span class="ind-label">📍 Posição na banda</span><span class="ind-value" style="color:${posColor}">${pos.toFixed(0)}%</span></div>
    <!-- MM9 removida -->
  `;
}

// ====== HISTÓRICO DE SINAIS (sidebar esquerda) ======
function renderSignalHistory(signals, onClick) {
  const el = document.getElementById('signalHistory');
  if (!el) return;

  if (signals.length === 0) {
    el.innerHTML = `<div style="padding:20px; color:var(--text-muted); font-size:12px; text-align:center">Nenhum sinal detectado.</div>`;
    return;
  }

  el.innerHTML = signals.slice(0, 30).map(sig => {
    const timeStr = BR.hm(sig.time);
    const dirClass = sig.direction === 'over' ? 'over' : 'under';
    const resultIcon = sig.backtestResult === 'win' ? '✅' : (sig.backtestResult === 'loss' ? '❌' : '⏳');
    // Feedback do usuário: 'win' / 'loss' / null (não revisado)
    const userFb = (typeof UserFeedback !== 'undefined') ? UserFeedback.get(sig) : null;
    const sigKey = `${sig.dataIndex}-${sig.pattern}`;
    return `
      <div class="signal-card ${dirClass}" data-index="${sig.dataIndex}">
        <div class="signal-card-top">
          <span class="signal-pattern ${dirClass}">${sig.pattern}</span>
          <span class="signal-time">${timeStr} ${resultIcon}</span>
        </div>
        <div class="signal-msg">Valor: <strong>${sig.value}</strong> · ${sig.checks.filter(c => c.passed).length}/${sig.checks.length} condições</div>
        <div class="signal-meta">
          <div class="confidence-bar"><div class="confidence-fill" style="width:${sig.confidence}%"></div></div>
          <span class="confidence-text">${sig.confidence.toFixed(0)}%</span>
        </div>
        <span class="market-tag">${sig.market[0]}</span>
        <div class="signal-feedback" data-key="${sigKey}">
          <span class="fb-label">Resultado real:</span>
          <button class="fb-btn fb-win ${userFb === 'win' ? 'active' : ''}" data-fb="win" title="Acertou">✓</button>
          <button class="fb-btn fb-loss ${userFb === 'loss' ? 'active' : ''}" data-fb="loss" title="Errou">✗</button>
          <button class="fb-btn fb-clear ${!userFb ? 'active' : ''}" data-fb="clear" title="Limpar">⊘</button>
        </div>
      </div>
    `;
  }).join('');

  // Wire dos botões de feedback
  el.querySelectorAll('.fb-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wrapper = btn.closest('.signal-feedback');
      const key = wrapper.dataset.key;
      const fb = btn.dataset.fb;
      if (typeof UserFeedback !== 'undefined') {
        if (fb === 'clear') UserFeedback.clear(key);
        else UserFeedback.set(key, fb);
      }
      // Atualiza visual
      wrapper.querySelectorAll('.fb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  if (onClick) {
    el.querySelectorAll('.signal-card').forEach(card => {
      card.addEventListener('click', () => onClick(parseInt(card.dataset.index)));
    });
  }
}

// ====== BACKTEST (painel direito inferior) ======
function renderBacktest(signals, btResults) {
  const el = document.getElementById('backtestGrid');
  if (!el) return;

  const overSigs = signals.filter(s => s.direction === 'over');
  const underSigs = signals.filter(s => s.direction === 'under');
  const overWins = overSigs.filter(s => s.backtestResult === 'win').length;
  const underWins = underSigs.filter(s => s.backtestResult === 'win').length;
  const overAcc = overSigs.length > 0 ? (overWins / overSigs.length) * 100 : 0;
  const underAcc = underSigs.length > 0 ? (underWins / underSigs.length) * 100 : 0;

  const accClass = btResults.accuracy >= 60 ? 'green' : (btResults.accuracy >= 50 ? 'yellow' : 'red');

  el.innerHTML = `
    <div class="bt-card"><div class="bt-label">Sinais Total</div><div class="bt-value">${btResults.total}</div></div>
    <div class="bt-card"><div class="bt-label">Acerto Geral</div><div class="bt-value ${accClass}">${btResults.accuracy.toFixed(0)}%</div></div>
    <div class="bt-card"><div class="bt-label">Sinais Over</div><div class="bt-value green">${overSigs.length}</div></div>
    <div class="bt-card"><div class="bt-label">Acerto Over</div><div class="bt-value ${overAcc >= 60 ? 'green' : 'yellow'}">${overAcc.toFixed(0)}%</div></div>
    <div class="bt-card"><div class="bt-label">Sinais Under</div><div class="bt-value red">${underSigs.length}</div></div>
    <div class="bt-card"><div class="bt-label">Acerto Under</div><div class="bt-value ${underAcc >= 60 ? 'green' : 'yellow'}">${underAcc.toFixed(0)}%</div></div>
  `;
}

// ====== LEGENDAS NO TOPO DOS GRÁFICOS ======
function renderLegends(state, idx) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('legGols', state.values[idx]);
  // MM9 removida
  set('legUp', state.bands.upper[idx]?.toFixed(1) || '--');
  set('legLow', state.bands.lower[idx]?.toFixed(1) || '--');
  set('legRSI', state.rsi[idx]?.toFixed(1) || '--');
  set('legMom', (state.mom[idx] >= 0 ? '+' : '') + (state.mom[idx]?.toFixed(2) || '--'));
  set('hdrValue', state.values[idx]);
}
