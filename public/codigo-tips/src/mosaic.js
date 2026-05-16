/* ================================================================
   MOSAICO — Grade perfeita 20×N | Fonte: DarkOdds exclusivamente
   ================================================================
   20 COLUNAS FIXAS = posições de minuto
   N LINHAS = uma por hora
   Linha atual = preenchimento gradual esquerda→direita
   Linhas passadas = 20 células sempre preenchidas (grade fechada)
=============================================================== */

const MOSAIC_COLS = 20;

// ============================================================
// GERA TIMESTAMPS VIRTUAIS (API não fornece horário individual)
// Cada partida virtual dura ~4 min
// ============================================================
function assignTimestamps(matches) {
  const now = Date.now();
  return matches.map((m, i) => ({ ...m, _time: new Date(now - i * 240000) }));
}

// ============================================================
// AGRUPA PARTIDAS POR HORA, ORDENADAS POR MINUTO
// ============================================================
function groupByHour(matches) {
  const withTime = assignTimestamps(matches);
  const groups = {};
  withTime.forEach(m => {
    const h = m._time.getHours().toString().padStart(2, '0');
    if (!groups[h]) groups[h] = [];
    groups[h].push(m);
  });
  // Sort each hour by minute ascending
  Object.keys(groups).forEach(h => {
    groups[h].sort((a, b) => a._time - b._time);
  });
  return groups;
}

function getCurrentHour() {
  return new Date().getHours().toString().padStart(2, '0');
}

// ============================================================
// CRIA CÉLULA INDIVIDUAL
// ============================================================
function buildCell(match, isEmpty) {
  const cell = document.createElement('div');

  if (isEmpty || !match) {
    cell.style.cssText = `
      background: #080808;
      border: 1px solid #141414;
      border-radius: 2px;
      min-height: 40px;
    `;
    return cell;
  }

  // Parse score do formato DarkOdds: "2-0" ou "—"
  const parts = match.score && match.score !== '—' ? match.score.split('-') : null;
  const hs = parts ? parseInt(parts[0]) || 0 : null;
  const as = parts ? parseInt(parts[1]) || 0 : null;
  const hasScore = hs !== null;
  const gols = (hs || 0) + (as || 0);
  const isOver = gols >= 3;

  let bg, br;
  if (!hasScore)        { bg = '#0d0d0d'; br = '#2a2a2a'; }
  else if (isOver)      { bg = '#0a1f0a'; br = '#1f5c1f'; }
  else                  { bg = '#0a0a18'; br = '#18183a'; }

  cell.style.cssText = `
    background: ${bg};
    border: 1px solid ${br};
    border-radius: 2px;
    padding: 2px 3px;
    min-height: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    cursor: pointer;
    overflow: hidden;
  `;

  const min = match._time.getMinutes().toString().padStart(2, '0');
  const scoreText = hasScore ? match.score : '⏳';
  const scoreColor = !hasScore ? '#444' : isOver ? '#3dff3d' : '#999';

  cell.innerHTML = `
    <div style="color:#444;font-size:7px;font-family:monospace;margin-bottom:1px">${min}'</div>
    <div style="color:${scoreColor};font-weight:700;font-size:10px;line-height:1">${scoreText}</div>
    <div style="color:#444;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;margin-top:1px">
      ${(match.timeA || '').split(' ')[0]}×${(match.timeB || '').split(' ')[0]}
    </div>
  `;

  cell.title = `${min}' · ${match.timeA||'?'} vs ${match.timeB||'?'} · ${hasScore ? match.score+' ('+gols+' gols)' : 'Aguardando'}`;
  return cell;
}

// ============================================================
// CRIA UMA LINHA (1 HORA) — 20 CÉLULAS
// ============================================================
function buildHourRow(horaLabel, partidas, isCurrentHour) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `display:flex; gap:0; width:100%; align-items:stretch; margin-bottom:2px;`;

  // Label da hora (fixo, esquerda)
  const label = document.createElement('div');
  label.style.cssText = `
    width: 36px; min-width: 36px;
    background: #0d0d0d;
    border: 1px solid #1a1a1a;
    border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    color: ${isCurrentHour ? '#ffcc00' : '#444'};
    margin-right: 2px; flex-shrink: 0;
  `;
  label.textContent = horaLabel + 'h';
  wrapper.appendChild(label);

  // Grid das 20 células
  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(${MOSAIC_COLS}, 1fr);
    gap: 2px; flex: 1;
  `;

  for (let i = 0; i < MOSAIC_COLS; i++) {
    const match = partidas[i] || null;
    // Hora atual: células futuras (sem jogo) ficam vazias
    // Horas passadas: todas as células preenchidas ou vazias (grade fechada)
    grid.appendChild(buildCell(match, !match));
  }

  wrapper.appendChild(grid);
  return wrapper;
}

// ================================================================
// FUNÇÃO PRINCIPAL DE RENDERIZAÇÃO
// ================================================================
function renderMosaic(matches) {
  const container = document.getElementById('mosaicGridLive');
  if (!container) {
    console.warn('[MOSAICO] Container mosaicGridLive não encontrado');
    return;
  }

  if (!matches || !matches.length) {
    container.innerHTML = '<div style="padding:16px;color:#555;font-family:monospace;font-size:11px;">⬛ Nenhum jogo disponível — aguardando DarkOdds...</div>';
    return;
  }

  const groups      = groupByHour(matches);
  const horasKeys   = Object.keys(groups).sort(); // oldest first
  const currentHour = getCurrentHour();

  container.innerHTML = '';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = `
    padding: 6px 8px 4px;
    font-size: 9px;
    color: #555;
    font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid #141414;
    margin-bottom: 3px;
  `;
  hdr.textContent = `⬛ Mosaico DarkOdds — ${matches.length} jogos · ${horasKeys.length}h · ${MOSAIC_COLS} colunas`;
  container.appendChild(hdr);

  // Corpo: linhas por hora
  const body = document.createElement('div');
  body.style.cssText = `display:flex; flex-direction:column; padding:4px 6px;`;

  horasKeys.forEach(hora => {
    const isCurrent = hora === currentHour;
    body.appendChild(buildHourRow(hora, groups[hora], isCurrent));
  });

  container.appendChild(body);
  console.log(`[MOSAICO] ${horasKeys.length}h × ${MOSAIC_COLS} col · hora atual: ${currentHour}h`);
}

// ================================================================
// COMPATIBILIDADE COM APP.JS (renderMosaicGrid → renderMosaicLive)
// ================================================================
// Aliases para compatibilidade com app.js
function renderMosaicLive(matches, rule, options) {
  renderMosaic(matches);
}
// App.js chama renderMosaic(App.mosaicGrid, App.currentRule) em event listeners
// renderMosaic já está no escopo global (cada script é um módulo solto)

// ================================================================
// CARREGA DA DARKODDS VIA PROXY LOCAL
// ================================================================
async function loadMosaicData() {
  try {
    const res = await fetch('/api/virtual?limit=400');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let matches = [];
    // Tenta extrair partidas em qualquer formato que a API retornar
    if (data.recent_matches && data.recent_matches.length) {
      matches = data.recent_matches;
    } else if (data.matches && data.matches.length) {
      matches = data.matches;
    } else if (data.games && data.games.length) {
      matches = data.games;
    } else if (Array.isArray(data)) {
      matches = data;
    } else if (data.leagues) {
      // Pega da primeira liga disponível
      const keys = Object.keys(data.leagues);
      for (const k of keys) {
        if (data.leagues[k]?.recent_matches?.length) {
          matches = data.leagues[k].recent_matches;
          break;
        }
      }
    }

    if (!matches.length) {
      console.warn('[MOSAICO] API retornou 0 jogos — verificar DarkOdds');
      return;
    }

    renderMosaic(matches);
  } catch (err) {
    console.error('[MOSAICO] Erro ao carregar DarkOdds:', err.message);
  }
}

// Init + polling 30s
loadMosaicData();
setInterval(loadMosaicData, 30000);
