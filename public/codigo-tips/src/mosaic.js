/* ============================================================
   🧩 MOSAIC RENDERER — Partidas reais da DarkOdds
   ============================================================
   Renderiza o mosaico no rodapé usando dados REAIS de
   recent_matches do /api/virtual. NUNCA gera placares
   sintéticos. Multi-row grid com até 80 partidas.
============================================================ */

const MOSAIC_RULES = {
  'over25':   { test: s => parseFloat(s.over25_odd) >= 2.0, label: 'Over 2.5' },
  'over15':   { test: s => true, label: 'Over 1.5' },
  'over35':   { test: s => parseFloat(s.over25_odd) >= 3.0, label: 'Over 3.5' },
  'over45':   { test: s => false, label: 'Over 4.5' },
  'under25':  { test: s => parseFloat(s.over25_odd) < 2.0, label: 'Under 2.5' },
  'btts':     { test: s => true, label: 'Ambas Marcam' },
  'zerozero': { test: s => false, label: 'Placar 0x0' },
};

/* ============================================================
   RENDERIZADOR PRINCIPAL
   Recebe: array de matches [{ timeA, timeB, score, over25_odd, minuto }]
   Renderiza grid multi-coluna com até 80 tiles.
============================================================ */

function renderMosaicLive(matches, rule = 'over25', options = {}) {
  const container = document.getElementById('mosaicGridLive');
  const statsEl = document.getElementById('mosaicStatsLive');
  if (!container) return;

  if (!matches || matches.length === 0) {
    container.innerHTML = '<div class="mosaic-empty">Nenhuma partida disponível</div>';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  const ruleObj = MOSAIC_RULES[rule] || MOSAIC_RULES.over25;
  const showOdds = options.showOdds !== undefined ? options.showOdds :
    (document.getElementById('tgShowOdds')?.checked || false);

  container.innerHTML = '';
  container.className = `mosaic-grid ${showOdds ? 'with-odds' : ''}`;

  // Mostra até 80 partidas em grid auto-fill
  const maxTiles = Math.min(matches.length, 80);
  let totalCells = 0, wins = 0;

  for (let i = 0; i < maxTiles; i++) {
    const match = matches[i];

    const hasScore = match.score && match.score !== '—' && match.score !== '0-0';
    const won = hasScore ? ruleObj.test(match) : false;
    if (hasScore) {
      totalCells++;
      if (won) wins++;
    }

    const cell = document.createElement('div');
    cell.className = `mosaic-cell`;
    if (hasScore) {
      cell.classList.add(won ? 'win' : 'loss');
    } else {
      cell.classList.add('proximo');
    }

    const score = hasScore ? match.score : '⏳ próximo';
    const oddStr = match.over25_odd ? `O2.5: ${match.over25_odd.toFixed(2)}` : '';

    let content = `<div class="cell-score">${score}</div>`;
    content += `<div class="cell-teams">${(match.timeA || '—').slice(0, 8)}<br>${(match.timeB || '—').slice(0, 8)}</div>`;
    if (showOdds && oddStr) {
      content += `<div class="cell-odds">${oddStr}</div>`;
    }

    cell.innerHTML = content;
    cell.title = hasScore
      ? `${match.timeA || '?'} vs ${match.timeB || '?'} · Placar: ${score} · Odd O2.5: ${match.over25_odd || '—'} · ${ruleObj.label}: ${won ? '✓' : '✗'}`
      : `${match.timeA || '?'} vs ${match.timeB || '?'} · Jogo na rotação, sem placar ainda`;
    container.appendChild(cell);
  }

  // Stats
  const winPct = totalCells > 0 ? (wins / totalCells * 100).toFixed(1) : 0;
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">✓</span><span class="stat-chip-value" style="color:var(--green)">${winPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">✗</span><span class="stat-chip-value" style="color:var(--red)">${(100 - parseFloat(winPct)).toFixed(1)}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Jogos:</span><span class="stat-chip-value">${totalCells}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Fonte:</span><span class="stat-chip-value">DarkOdds</span></div>
    `;
  }
}

// Compatibilidade
function renderMosaic(grid, rule = 'over25') {
  return renderMosaicLive(grid, rule);
}

function renderMosaic24h() {}

function emptyCell(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}
