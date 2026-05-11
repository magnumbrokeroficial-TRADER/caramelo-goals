/* ============================================================
   🧩 MOSAIC RENDERER (unificado, multi-período)
   ============================================================
   Renderiza o mosaico de placares no rodapé. Suporta:
   - Período selecionável: 3, 6, 8, 12, 18, 24 horas
   - Toggle "Times" pra mostrar/esconder nomes dos times virtuais
   - Toggle "Odds" pra mostrar/esconder odds simuladas
   - Stats completos: % acerto, gols totais, média gols/jogo
============================================================ */

const MOSAIC_RULES = {
  'over25':   { test: s => (s.home + s.away) >= 3, label: 'Over 2.5' },
  'over15':   { test: s => (s.home + s.away) >= 2, label: 'Over 1.5' },
  'over35':   { test: s => (s.home + s.away) >= 4, label: 'Over 3.5' },
  'over45':   { test: s => (s.home + s.away) >= 5, label: 'Over 4.5' },
  'under25':  { test: s => (s.home + s.away) <= 2, label: 'Under 2.5' },
  'btts':     { test: s => s.home >= 1 && s.away >= 1, label: 'Ambas Marcam' },
  'zerozero': { test: s => s.home === 0 && s.away === 0, label: 'Placar 0x0' },
};

// Times virtuais — nomes plausíveis pra simulação
const VIRTUAL_TEAMS = [
  'Atlético', 'Boca', 'Cruzeiro', 'Dinamo', 'Estrela', 'Flamengo',
  'Galatasaray', 'Hércules', 'Inter', 'Juventus', 'Kaiser', 'Lazio',
  'Milan', 'Nordeste', 'Olímpico', 'Palmeiras', 'Quito', 'River',
  'Santos', 'Tigres', 'União', 'Vitória', 'Xerém', 'York',
  'Zenith', 'Águia', 'Barça', 'Celtic', 'Dragão', 'Eagles',
];

function teamPair(seed) {
  const a = VIRTUAL_TEAMS[seed % VIRTUAL_TEAMS.length];
  const b = VIRTUAL_TEAMS[(seed * 7 + 3) % VIRTUAL_TEAMS.length];
  return a === b ? [a, VIRTUAL_TEAMS[(seed * 11) % VIRTUAL_TEAMS.length]] : [a, b];
}

function fakeOdds(score) {
  // Odds plausíveis baseado em quem ganhou + total de gols
  const totalGoals = score.home + score.away;
  const margin = Math.abs(score.home - score.away);
  if (score.home > score.away) {
    return margin >= 2 ? { '1': 1.45, 'X': 4.20, '2': 6.50 } : { '1': 1.95, 'X': 3.40, '2': 4.20 };
  } else if (score.away > score.home) {
    return margin >= 2 ? { '1': 6.50, 'X': 4.20, '2': 1.45 } : { '1': 4.20, 'X': 3.40, '2': 1.95 };
  }
  return { '1': 2.80, 'X': 2.95, '2': 2.85 };
}

/* ============================================================
   RENDERIZADOR PRINCIPAL
============================================================ */

function renderMosaicLive(grid, rule = 'over25', options = {}) {
  const container = document.getElementById('mosaicGridLive');
  const statsEl = document.getElementById('mosaicStatsLive');
  if (!container) return;

  const ruleObj = MOSAIC_RULES[rule] || MOSAIC_RULES.over25;
  const showTeams = options.showTeams !== undefined ? options.showTeams :
    (document.getElementById('tgShowTeams')?.checked || false);
  const showOdds = options.showOdds !== undefined ? options.showOdds :
    (document.getElementById('tgShowOdds')?.checked || false);

  container.innerHTML = '';
  container.className = `mosaic-grid ${showTeams ? 'with-teams' : ''} ${showOdds ? 'with-odds' : ''}`;

  // Define grid template baseado no número de colunas
  const cols = grid[0]?.length || 0;
  container.style.gridTemplateColumns = `60px repeat(${cols}, minmax(${showTeams ? '90px' : '46px'}, 1fr))`;

  // Linha de cabeçalho com horários (Brasília)
  container.appendChild(emptyCell('mosaic-row-label', 'Hora'));
  for (let c = 0; c < cols; c++) {
    const offsetMin = (cols - c) * 4;
    const t = new Date(Date.now() - offsetMin * 60 * 1000);
    const cell = document.createElement('div');
    cell.className = 'mosaic-header-row';
    cell.textContent = BR.hm(t);
    container.appendChild(cell);
  }

  // Linhas de dados
  let totalCells = 0, wins = 0, totalGoalsSum = 0;
  grid.forEach((row, rIdx) => {
    container.appendChild(emptyCell('mosaic-row-label', `Jogo ${rIdx + 1}`));
    row.forEach((score, cIdx) => {
      const won = ruleObj.test(score);
      totalCells++;
      if (won) wins++;
      totalGoalsSum += score.totalGoals;

      const cell = document.createElement('div');
      cell.className = `mosaic-cell ${won ? 'win' : 'loss'}`;

      // Conteúdo da célula: placar + opcional times + opcional odds
      let content = '';
      if (showTeams) {
        const [tHome, tAway] = teamPair(rIdx * 100 + cIdx + score.home + score.away);
        content += `<div class="cell-teams">${tHome.slice(0,3)} vs ${tAway.slice(0,3)}</div>`;
      }
      content += `<div class="cell-score">${score.home}-${score.away}</div>`;
      if (showOdds) {
        const o = fakeOdds(score);
        content += `<div class="cell-odds">${o['1']}/${o['X']}/${o['2']}</div>`;
      }
      cell.innerHTML = content;
      cell.title = `Placar ${score.home}-${score.away} · Total ${score.totalGoals} gols · ${ruleObj.label}: ${won ? '✓ ACERTOU' : '✗ NÃO'}`;
      container.appendChild(cell);
    });
  });

  // Stats agregados (acerto, gols, média)
  const winPct = totalCells > 0 ? (wins / totalCells * 100).toFixed(1) : 0;
  const lossPct = totalCells > 0 ? ((totalCells - wins) / totalCells * 100).toFixed(1) : 0;
  const avgGoals = totalCells > 0 ? (totalGoalsSum / totalCells).toFixed(2) : 0;
  const avgGoalsPerHour = options.hours ? (totalGoalsSum / options.hours).toFixed(1) : '—';

  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">✓</span><span class="stat-chip-value" style="color:var(--green)">${winPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">✗</span><span class="stat-chip-value" style="color:var(--red)">${lossPct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">⚽ Gols:</span><span class="stat-chip-value">${totalGoalsSum}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Média/jogo:</span><span class="stat-chip-value">${avgGoals}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Média/hora:</span><span class="stat-chip-value">${avgGoalsPerHour}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Jogos:</span><span class="stat-chip-value">${totalCells}</span></div>
    `;
  }
}

// Compatibilidade
function renderMosaic(grid, rule = 'over25') {
  return renderMosaicLive(grid, rule);
}

// Stub pra compatibilidade (a aba 24h foi unificada na principal)
function renderMosaic24h() {}

function emptyCell(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  return el;
}
