/* ============================================================
   🧩 MOSAIC RENDERER (multi-período)
   ============================================================
   Constrói grade de placares no rodapé. Suporta dois períodos:
   - 'live'  → últimas N rodadas (default 20, mais detalhado)
   - '24h'   → últimas 24 horas agrupadas por hora (24 colunas)

   A regra (over25, btts, etc) é aplicada e cada célula vira
   verde (atendeu) ou vermelha (não).
============================================================ */

const MOSAIC_RULES = {
  'over25':  { test: s => (s.home + s.away) >= 3, label: 'Over 2.5' },
  'over15':  { test: s => (s.home + s.away) >= 2, label: 'Over 1.5' },
  'over35':  { test: s => (s.home + s.away) >= 4, label: 'Over 3.5' },
  'under25': { test: s => (s.home + s.away) <= 2, label: 'Under 2.5' },
  'btts':    { test: s => s.home >= 1 && s.away >= 1, label: 'Ambas Marcam' },
};

/* ===== VISÃO LIVE — últimas rodadas (mais granular) ===== */

function renderMosaicLive(grid, rule = 'over25') {
  const container = document.getElementById('mosaicGridLive');
  const statsEl = document.getElementById('mosaicStatsLive');
  if (!container) return;

  const ruleObj = MOSAIC_RULES[rule] || MOSAIC_RULES.over25;
  container.innerHTML = '';

  // Linha de cabeçalho com horários (slots de tempo) — Brasília
  container.appendChild(emptyCell('mosaic-row-label', ''));
  for (let c = 0; c < grid[0].length; c++) {
    const offsetMin = (grid[0].length - c) * 4;
    const t = new Date(Date.now() - offsetMin * 60 * 1000);
    const cell = document.createElement('div');
    cell.className = 'mosaic-header-row';
    cell.textContent = BR.hm(t);
    container.appendChild(cell);
  }

  // Linhas de dados
  let totalCells = 0, wins = 0;
  grid.forEach((row, rIdx) => {
    container.appendChild(emptyCell('mosaic-row-label', String(rIdx + 1).padStart(2, '0')));
    row.forEach(score => {
      const won = ruleObj.test(score);
      totalCells++;
      if (won) wins++;
      const cell = document.createElement('div');
      cell.className = `mosaic-cell ${won ? 'win' : 'loss'}`;
      cell.textContent = `${score.home}-${score.away}`;
      cell.title = `Placar ${score.home}-${score.away} · ${ruleObj.label}: ${won ? '✓ ACERTOU' : '✗ NÃO'}`;
      container.appendChild(cell);
    });
  });

  // Stats agregados
  const winPct = totalCells > 0 ? (wins / totalCells * 100).toFixed(1) : 0;
  const lossPct = totalCells > 0 ? ((totalCells - wins) / totalCells * 100).toFixed(1) : 0;
  const totalGoals = grid.flat().reduce((s, c) => s + c.totalGoals, 0);
  const avgGoals = totalCells > 0 ? (totalGoals / totalCells).toFixed(2) : 0;

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">✓</span><span class="stat-chip-value" style="color:var(--green)">${winPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">✗</span><span class="stat-chip-value" style="color:var(--red)">${lossPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">⚽ Gols:</span><span class="stat-chip-value">${totalGoals}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Média/jogo:</span><span class="stat-chip-value">${avgGoals}</span></div>
    `;
  }
}

/* ===== VISÃO 24H — últimas 24 horas agrupadas por hora ===== */

function renderMosaic24h(hourlyData, rule = 'over25') {
  const container = document.getElementById('mosaicGrid24h');
  const statsEl = document.getElementById('mosaicStats24h');
  if (!container) return;

  container.innerHTML = '';

  // Cabeçalho com hora
  container.appendChild(emptyCell('mosaic-row-label', 'Hora'));
  hourlyData.forEach(h => {
    const cell = document.createElement('div');
    cell.className = 'mosaic-header-row';
    cell.textContent = String(h.hour).padStart(2, '0') + 'h';
    container.appendChild(cell);
  });

  // Linha % acerto
  container.appendChild(emptyCell('mosaic-row-label', '% ✓'));
  hourlyData.forEach(h => {
    const pct = h.totalGames > 0 ? (h.winGames / h.totalGames) * 100 : 0;
    const cell = document.createElement('div');
    let cls = 'mosaic-cell-pct ';
    if (pct >= 60) cls += 'win-strong';
    else if (pct >= 50) cls += 'win';
    else if (pct >= 40) cls += 'neutral';
    else cls += 'loss';
    cell.className = cls;
    cell.textContent = h.totalGames > 0 ? `${pct.toFixed(0)}` : '—';
    cell.title = `${String(h.hour).padStart(2, '0')}h · ${h.winGames}/${h.totalGames} acertos`;
    container.appendChild(cell);
  });

  // Linha total de gols
  container.appendChild(emptyCell('mosaic-row-label', 'Gols'));
  hourlyData.forEach(h => {
    const cell = document.createElement('div');
    cell.className = 'mosaic-cell-stat';
    cell.textContent = h.totalGoals || '—';
    cell.title = `${h.totalGoals} gols em ${h.totalGames} jogos`;
    container.appendChild(cell);
  });

  // Linha média gols/jogo
  container.appendChild(emptyCell('mosaic-row-label', 'Méd'));
  hourlyData.forEach(h => {
    const avg = h.avgGoals || 0;
    const cell = document.createElement('div');
    cell.className = 'mosaic-cell-stat';
    cell.textContent = h.totalGames > 0 ? avg.toFixed(1) : '—';
    container.appendChild(cell);
  });

  // Stats agregados das 24h
  const totalGames = hourlyData.reduce((s, h) => s + h.totalGames, 0);
  const totalWins = hourlyData.reduce((s, h) => s + h.winGames, 0);
  const totalGoals = hourlyData.reduce((s, h) => s + h.totalGoals, 0);
  const avgPct = totalGames > 0 ? (totalWins / totalGames * 100).toFixed(1) : 0;
  const avgGoals = totalGames > 0 ? (totalGoals / totalGames).toFixed(2) : 0;

  // Encontra hora mais quente / mais fria
  let hot = { hour: null, pct: 0 }, cold = { hour: null, pct: 100 };
  hourlyData.forEach(h => {
    if (h.totalGames < 5) return;
    const pct = (h.winGames / h.totalGames) * 100;
    if (pct > hot.pct) hot = { hour: h.hour, pct };
    if (pct < cold.pct) cold = { hour: h.hour, pct };
  });

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">24h ✓</span><span class="stat-chip-value" style="color:var(--green)">${avgPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Jogos:</span><span class="stat-chip-value">${totalGames}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">⚽ Total:</span><span class="stat-chip-value">${totalGoals}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Média:</span><span class="stat-chip-value">${avgGoals}</span></div>
      ${hot.hour !== null ? `<div class="stat-chip"><span class="stat-chip-label">🔥 Quente:</span><span class="stat-chip-value" style="color:var(--green)">${String(hot.hour).padStart(2, '0')}h (${hot.pct.toFixed(0)}%)</span></div>` : ''}
      ${cold.hour !== null ? `<div class="stat-chip"><span class="stat-chip-label">❄️ Frio:</span><span class="stat-chip-value" style="color:var(--red)">${String(cold.hour).padStart(2, '0')}h (${cold.pct.toFixed(0)}%)</span></div>` : ''}
    `;
  }
}

// Compatibilidade
function renderMosaic(grid, rule = 'over25') {
  return renderMosaicLive(grid, rule);
}

function emptyCell(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}
