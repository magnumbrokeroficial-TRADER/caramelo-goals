/* ================================================================
   MOSAICO — Grid 20×20 (20 colunas × 20 jogos por coluna)
   ================================================================
   400 jogos exatos no grid
   Verde = over (≥3 gols) | Vermelho = under
   "—" = pending (jogo sem resultado)
   ================================================================ */

const MOSAIC_COLS = 20;
const MOSAIC_ROWS = 20;

// ================================================================
// UTILITIES — adaptado para dados reais da API
// ================================================================
function mGetScore(m) {
  if (!m.score || m.score === '—') return { hs: null, as: null, gols: 0 };
  const parts = m.score.split('-');
  const hs = parseInt(parts[0]) || 0;
  const as = parseInt(parts[1]) || 0;
  return { hs, as, gols: hs + as };
}

function mIsPending(m) {
  return !m.score || m.score === '—';
}

// ================================================================
// CARD DE UM JOGO
// ================================================================
function mBuildCard(m) {
  const card = document.createElement('div');
  const pending = mIsPending(m);

  let bg, border, scoreColor;
  if (pending) {
    bg = 'transparent';
    border = '#333';
    scoreColor = '#555';
  } else {
    const { gols } = mGetScore(m);
    const isOver = gols >= 3;
    bg = isOver ? '#0a2e0a' : '#2e0a0a';
    border = isOver ? '#1a5a1a' : '#5a1a1a';
    scoreColor = isOver ? '#4cff4c' : '#ff6666';
  }

  card.style.cssText = `
    background: ${bg};
    border: 1px solid ${border};
    border-radius: 3px;
    padding: 3px 4px;
    font-size: 9px;
    line-height: 1.3;
    color: #e0e0e0;
    text-align: center;
    min-height: 36px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    cursor: pointer;
  `;

  if (pending) {
    card.innerHTML = `
      <span style="color:#666;font-size:8px;">⏳</span>
      <span style="color:#555;font-size:7px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        ${m.timeA || '?'} vs ${m.timeB || '?'}
      </span>
    `;
  } else {
    const { hs, as, gols } = mGetScore(m);
    card.innerHTML = `
      <span style="color:${scoreColor};font-weight:700;">
        ${hs}-${as}
      </span>
      <span style="color:#888;font-size:7px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
        ${m.timeA || '?'} vs ${m.timeB || '?'}
      </span>
    `;
  }

  return card;
}

// ================================================================
// RENDER 20×20
// ================================================================
function renderMosaic(matches) {
  const container = document.getElementById('mosaicGridLive');
  if (!container) {
    console.warn('[MOSAICO] Container #mosaicGridLive não encontrado');
    return;
  }

  if (!matches || !matches.length) {
    container.innerHTML = '<div style="padding:16px;color:#555;font-family:monospace;font-size:11px;">⬛ Nenhum jogo — aguardando DarkOdds...</div>';
    return;
  }

  const total = MOSAIC_COLS * MOSAIC_ROWS; // 400
  const jogos = matches.slice(0, total);

  // Dividir em 20 colunas de 20 jogos
  const colunas = [];
  for (let c = 0; c < MOSAIC_COLS; c++) {
    const inicio = c * MOSAIC_ROWS;
    const fim = inicio + MOSAIC_ROWS;
    colunas.push(jogos.slice(inicio, fim));
  }

  container.innerHTML = '';
  container.style.cssText = 'padding:4px 8px; box-sizing:border-box; overflow-x:auto;';

  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(${MOSAIC_COLS}, 1fr);
    gap: 2px;
    width: 100%;
    padding: 0;
    box-sizing: border-box;
  `;

  colunas.forEach(coluna => {
    const col = document.createElement('div');
    col.style.cssText = 'display:flex; flex-direction:column; gap:2px;';

    coluna.forEach(jogo => {
      col.appendChild(mBuildCard(jogo));
    });

    // Preencher colunas incompletas com placeholders
    while (col.children.length < MOSAIC_ROWS) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        min-height: 36px;
        border: 1px solid #1a1a1a;
        border-radius: 3px;
        background: #0a0a0a;
      `;
      col.appendChild(empty);
    }

    grid.appendChild(col);
  });

  container.appendChild(grid);

  console.log(`[MOSAICO] ${MOSAIC_COLS}×${MOSAIC_ROWS} grid · ${jogos.length} jogos (${matches.length} disponíveis)`);
}

// Alias compat app.js (chamado com rule, options ignorados)
function renderMosaicLive(matches, rule, options) {
  renderMosaic(matches);
}

// ================================================================
// CARREGA DA DARKODDS + POLLING 30s
// ================================================================
async function loadMosaicData() {
  try {
    const res = await fetch('/api/virtual?limit=500');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Coletar matches de todas as ligas
    let allMatches = [];
    if (data.leagues) {
      const keys = Object.keys(data.leagues);
      for (const k of keys) {
        const liga = data.leagues[k];
        if (liga.recent_matches && liga.recent_matches.length) {
          allMatches = allMatches.concat(liga.recent_matches);
        }
      }
    } else if (data.recent_matches && data.recent_matches.length) {
      allMatches = data.recent_matches;
    } else if (data.matches && data.matches.length) {
      allMatches = data.matches;
    } else if (data.games && data.games.length) {
      allMatches = data.games;
    } else if (Array.isArray(data)) {
      allMatches = data;
    }

    if (!allMatches.length) {
      console.warn('[MOSAICO] API retornou 0 jogos');
      return;
    }

    renderMosaic(allMatches);
  } catch (err) {
    console.error('[MOSAICO] Erro:', err.message);
  }
}

loadMosaicData();
setInterval(loadMosaicData, 30000);
