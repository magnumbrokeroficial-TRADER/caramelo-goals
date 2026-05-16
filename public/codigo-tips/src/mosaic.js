/* ============================================================
   🧩 MOSAIC RENDERER — Timeline horizontal cronológica
   ============================================================
   Cada LINHA = uma hora real (ex: 16h)
   Cada CÉLULA = ~3 min dentro da hora (20 slots)
   Células vazias = jogo ainda não aconteceu / sem dado
   Preenchimento progressivo conforme jogos terminam.
   Dados exclusivamente da API real.
============================================================ */

const CELLS_PER_HOUR = 20;  // 20 slots por hora (~3 min cada)
const MIN_PER_SLOT = 3;      // cada slot = 3 minutos

// ============================================================
// GERA VIRTUAL TIMESTAMPS
// API não fornece horário — cada jogo virtual dura ~4 min
// Atribuímos timestamps de trás pra frente: último jogo = agora
// ============================================================
function assignTimestamps(matches) {
  // Cada match ocupa ~4 min. Pontos a cada 240s (4 min).
  const now = Date.now();
  return matches.map((m, i) => {
    const time = new Date(now - i * 240 * 1000);
    return { ...m, _time: time };
  });
}

// ============================================================
// AGRUPA POR HORA REAL
// ============================================================
function groupByHour(matches) {
  const withTime = assignTimestamps(matches);
  const grupos = {};

  withTime.forEach(m => {
    const h = m._time.getHours().toString().padStart(2, '0');
    if (!grupos[h]) grupos[h] = [];
    grupos[h].push(m);
  });

  // Ordenar cada grupo por timestamp (mais antigo primeiro)
  Object.keys(grupos).forEach(h => {
    grupos[h].reverse(); // mais antigo primeiro = chronological dentro da hora
  });

  return grupos;
}

// ============================================================
// CALCULA MINUTO DO SLOT (0-59 → qual slot 0-19)
// ============================================================
function slotFromMinute(min) {
  return Math.floor(min / MIN_PER_SLOT);
}

// ============================================================
// CRIA UMA LINHA (UMA HORA)
// ============================================================
function buildHourRow(partidas, horaLabel) {
  const row = document.createElement('div');
  row.className = 'tl-row';

  // Label da hora (fixa à esquerda)
  const label = document.createElement('div');
  label.className = 'tl-hour-label';
  label.textContent = horaLabel + 'h';
  row.appendChild(label);

  // Mapa de slot → jogo
  const slotMap = {};
  partidas.forEach(jogo => {
    const min = jogo._time.getMinutes();
    const slot = slotFromMinute(min);
    if (slot >= 0 && slot < CELLS_PER_HOUR && !slotMap[slot]) {
      slotMap[slot] = jogo; // primeiro jogo do slot vence
    }
  });

  // 20 slots
  for (let s = 0; s < CELLS_PER_HOUR; s++) {
    const jogo = slotMap[s] || null;
    const cell = document.createElement('div');

    if (!jogo) {
      // Slot vazio — sem jogo neste horário
      cell.className = 'tl-cell tl-cell-empty';
      cell.title = `${horaLabel}h:${(s * MIN_PER_SLOT).toString().padStart(2, '0')} — sem partida`;
      row.appendChild(cell);
      continue;
    }

    // Dados do jogo
    const scoreObj = parseScore(jogo.score);
    const hasScore = scoreObj !== null;
    const gols = scoreObj ? scoreObj.home + scoreObj.away : 0;
    const isOver = gols >= 3;

    cell.className = `tl-cell ${hasScore ? (isOver ? 'tl-cell-over' : 'tl-cell-under') : 'tl-cell-pending'}`;

    const minuto = jogo._time.getMinutes().toString().padStart(2, '0');
    const placar = hasScore ? jogo.score : '—';

    cell.innerHTML = `
      <div class="tl-cell-time">${minuto}'</div>
      <div class="tl-cell-score ${hasScore ? (isOver ? 'over' : 'under') : ''}">${placar}</div>
      <div class="tl-cell-teams">${(jogo.timeA || '').slice(0, 5)}×${(jogo.timeB || '').slice(0, 5)}</div>
    `;

    cell.title = hasScore
      ? `${horaLabel}h${minuto} · ${jogo.timeA || '?'} vs ${jogo.timeB || '?'} · ${jogo.score} · ${gols} gols`
      : `${horaLabel}h${minuto} · ${jogo.timeA || '?'} vs ${jogo.timeB || '?'} · Aguardando resultado`;

    row.appendChild(cell);
  }

  return row;
}

// ============================================================
// RENDERIZADOR PRINCIPAL
// ============================================================
function renderMosaicLive(matches = [], rule = 'over25', options = {}) {
  const container = document.getElementById('mosaicGridLive');
  const statsEl = document.getElementById('mosaicStatsLive');
  if (!container) return;

  if (!matches || matches.length === 0) {
    container.innerHTML = '<div class="mosaic-empty">Nenhuma partida disponível</div>';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }

  // Pegar 400 jogos, agrupar por hora
  const jogos = matches.slice(0, 400);
  const grupos = groupByHour(jogos);
  const horas = Object.keys(grupos).sort((a, b) => parseInt(b) - parseInt(a)); // mais recente primeiro

  container.innerHTML = '';
  container.className = 'tl-container';

  // Cabeçalho
  const header = document.createElement('div');
  header.className = 'tl-header';
  header.textContent = `🧩 Mosaico Timeline · ${jogos.length} jogos · ${horas.length} horas`;
  container.appendChild(header);

  // Grid de linhas
  const grid = document.createElement('div');
  grid.className = 'tl-grid';

  let totalCompleted = 0, totalOver = 0;

  horas.forEach(hora => {
    const row = buildHourRow(grupos[hora], hora);
    grid.appendChild(row);

    // Contagem de jogos com resultado
    grupos[hora].forEach(j => {
      const scoreObj = parseScore(j.score);
      if (scoreObj) {
        totalCompleted++;
        if (scoreObj.home + scoreObj.away >= 3) totalOver++;
      }
    });
  });

  container.appendChild(grid);

  // Stats
  const pct = totalCompleted > 0 ? (totalOver / totalCompleted * 100).toFixed(1) : 0;
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-chip"><span class="stat-chip-label">✓ Over 3+</span><span class="stat-chip-value" style="color:var(--green)">${pct}%</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Total jogos:</span><span class="stat-chip-value">${totalCompleted}</span></div>
      <div class="stat-chip"><span class="stat-chip-label">Horas:</span><span class="stat-chip-value">${horas.length}</span></div>
    `;
  }

  console.log(`[MOSAICO] Timeline: ${horas.length}h × ${CELLS_PER_HOUR} cells = ${jogos.length} jogos`);
}

// Manter compatibilidade com app.js
function renderMosaic(grid, rule = 'over25') {
  return renderMosaicLive(grid, rule);
}

function renderMosaic24h() {}

// Utilitário
function parseScore(score) {
  if (!score || score === '—') return null;
  const parts = score.split('-');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0]);
  const a = parseInt(parts[1]);
  if (isNaN(h) || isNaN(a)) return null;
  return { home: h, away: a };
}
