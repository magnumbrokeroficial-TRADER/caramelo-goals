/* ============================================================
   🧩 MOSAIC RENDERER
   ============================================================
   Constrói a grade do rodapé com placares dos jogos individuais.
   Cada célula:
   - Texto: "1-2", "0-3" etc (placar)
   - Cor:
     · Verde se o placar atende ao critério (default: Over 2.5 = total ≥ 3 gols)
     · Vermelho se não atende
   - Hover: aumenta e mostra outline
============================================================ */

const MOSAIC_RULES = {
  'over25': { test: s => (s.home + s.away) >= 3, label: 'Over 2.5' },
  'over15': { test: s => (s.home + s.away) >= 2, label: 'Over 1.5' },
  'over35': { test: s => (s.home + s.away) >= 4, label: 'Over 3.5' },
  'under25': { test: s => (s.home + s.away) <= 2, label: 'Under 2.5' },
  'btts':    { test: s => s.home >= 1 && s.away >= 1, label: 'Ambas Marcam' },
};

function renderMosaic(grid, rule = 'over25') {
  const container = document.getElementById('mosaicGrid');
  const statsEl = document.getElementById('mosaicStats');
  if (!container) return;

  const ruleObj = MOSAIC_RULES[rule] || MOSAIC_RULES.over25;
  container.innerHTML = '';

  // Linha de cabeçalho com horários (slots de tempo)
  container.appendChild(emptyCell('mosaic-row-label', ''));
  for (let c = 0; c < grid[0].length; c++) {
    const t = new Date();
    t.setMinutes(t.getMinutes() - (grid[0].length - c) * 15);
    const cell = document.createElement('div');
    cell.className = 'mosaic-header-row';
    cell.textContent = t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

function emptyCell(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}
