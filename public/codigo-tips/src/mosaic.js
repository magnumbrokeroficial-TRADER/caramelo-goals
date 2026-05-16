/* ============================================================
   🧩 MOSAIC RENDERER — Grid 20×20
   ============================================================
   Renderiza EXATAMENTE 20 colunas × 20 jogos por coluna.
   Total: 400 cards. Condição irrevogável.
============================================================ */

const MOSAIC_COLS = 20;
const MOSAIC_ROWS = 20;

const MOSAIC_RULES = {
  'over25':   { test: s => parseFloat(s.over25_odd) >= 2.0, label: 'Over 2.5' },
  'over15':   { test: s => true, label: 'Over 1.5' },
  'over35':   { test: s => parseFloat(s.over25_odd) >= 3.0, label: 'Over 3.5' },
  'over45':   { test: s => false, label: 'Over 4.5' },
  'under25':  { test: s => parseFloat(s.over25_odd) < 2.0, label: 'Under 2.5' },
  'btts':     { test: s => true, label: 'Ambas Marcam' },
  'zerozero': { test: s => false, label: 'Placar 0x0' },
};

function parseScore(score) {
  if (!score || score === '—' || score === '0-0') return null;
  const parts = score.split('-');
  if (parts.length !== 2) return null;
  return { home: parseInt(parts[0]) || 0, away: parseInt(parts[1]) || 0 };
}

/* ============================================================
   RENDERIZADOR PRINCIPAL — Grid 20×20 fixo
   Recebe: array de matches [{ timeA, timeB, score, over25_odd, minuto }]
   Renderiza grid 20 colunas × 20 jogos. NUNCA mais nem menos.
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
  const total = MOSAIC_COLS * MOSAIC_ROWS; // 400
  const jogos = matches.slice(0, total);
  console.log(`[MOSAICO] Renderizando grid ${MOSAIC_COLS}×${MOSAIC_ROWS} = ${jogos.length} jogos (${matches.length} disponíveis)`);

  // Dividir em 20 colunas de 20 jogos cada
  const colunas = [];
  for (let c = 0; c < MOSAIC_COLS; c++) {
    const inicio = c * MOSAIC_ROWS;
    const fim = inicio + MOSAIC_ROWS;
    colunas.push(jogos.slice(inicio, fim));
  }

  // Estatísticas
  let totalCells = 0, wins = 0;

  container.innerHTML = '';
  container.className = 'mosaic-grid mosaic-grid-20x20';

  const grid = document.createElement('div');
  grid.className = 'mosaic-grid-inner';

  colunas.forEach((coluna, ci) => {
    const col = document.createElement('div');
    col.className = 'mosaic-column';

    coluna.forEach(jogo => {
      const scoreObj = parseScore(jogo.score);
      const gols = scoreObj ? scoreObj.home + scoreObj.away : 0;
      const hasScore = scoreObj !== null;
      const isOver = gols >= 3;
      const isNext = !hasScore;

      if (hasScore) {
        totalCells++;
        if (isOver) wins++;
      }

      const card = document.createElement('div');
      card.className = `mosaic-cell ${isNext ? 'proximo' : isOver ? 'win' : 'loss'}`;

      const placar = isNext
        ? `<span class="cell-label-next">⏳ próximo</span>`
        : `<span class="cell-score${isOver ? ' cell-score-over' : ''}">${jogo.score}</span>`;

      card.innerHTML = `
        ${placar}
        <span class="cell-teams">${(jogo.timeA || '—').slice(0, 6)} vs ${(jogo.timeB || '—').slice(0, 6)}</span>
      `;

      card.title = hasScore
        ? `${jogo.timeA || '?'} vs ${jogo.timeB || '?'} · ${jogo.score} · ${gols} gols · ${ruleObj.label}: ${isOver ? '✓' : '✗'}`
        : `${jogo.timeA || '?'} vs ${jogo.timeB || '?'} · Jogo na rotação, sem placar ainda`;

      col.appendChild(card);
    });

    // Preencher colunas incompletas com placeholders
    while (col.children.length < MOSAIC_ROWS) {
      const empty = document.createElement('div');
      empty.className = 'mosaic-cell mosaic-cell-empty';
      col.appendChild(empty);
    }

    grid.appendChild(col);
  });

  container.appendChild(grid);

  // Stats
  const winPct = totalCells > 0 ? (wins / totalCells * 100).toFixed(1) : 0;
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">✓ Over 3+</span><span class="stat-chip-value" style="color:var(--green)">${winPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">✗ Under</span><span class="stat-chip-value" style="color:var(--red)">${(100 - parseFloat(winPct)).toFixed(1)}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Jogos:</span><span class="stat-chip-value">${totalCells}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Grid:</span><span class="stat-chip-value">${MOSAIC_COLS}×${MOSAIC_ROWS}</span></div>
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
