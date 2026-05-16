/* ================================================================
   MOSAICO — Grade exata estilo referência | DarkOdds
   ================================================================
   H → G → % → linhas de hora → H (rodapé)
   20 slots fixos: 01 04 07 10 ... 58 (step 3 min)
   Verde = over (≥3 gols) | Vermelho = under
=============================================================== */

const MOSAIC_MINUTE_SLOTS = [
  '01','04','07','10','13','16','19','22','25','28',
  '31','34','37','40','43','46','49','52','55','58'
];
const MOSAIC_COLS = MOSAIC_MINUTE_SLOTS.length; // 20

// Timestamps virtuais (API não fornece horário por jogo)
function assignTimestamps(matches) {
  const now = Date.now();
  return matches.map((m, i) => ({ ...m, _time: new Date(now - i * 240000) }));
}

// Hora do jogo (do timestamp virtual)
function mGetHour(m) {
  if (m._time) return m._time.getHours().toString().padStart(2, '0');
  return '--';
}

// Minuto do jogo (do timestamp virtual)
function mGetMinute(m) {
  if (m._time) return m._time.getMinutes().toString().padStart(2, '0');
  return '--';
}

// Slot (0-19) baseado no minuto
function mGetSlot(m) {
  const min = parseInt(mGetMinute(m));
  let best = 0, bestDiff = 999;
  MOSAIC_MINUTE_SLOTS.forEach((s, i) => {
    const diff = Math.abs(parseInt(s) - min);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

// Placar e gols (formato DarkOdds: score = "2-0")
function mGetScore(m) {
  if (!m.score || m.score === '—') return { hs: null, as: null, gols: 0 };
  const parts = m.score.split('-');
  const hs = parseInt(parts[0]) || 0;
  const as = parseInt(parts[1]) || 0;
  return { hs, as, gols: hs + as };
}

// Agrupar por hora → { "03": [null, match, null, ...], "04": [...] }
function mGroupByHour(matches) {
  const withTime = assignTimestamps(matches.slice(0, 400));
  const hours = {};
  withTime.forEach(m => {
    const h = mGetHour(m);
    if (!hours[h]) hours[h] = new Array(MOSAIC_COLS).fill(null);
    const slot = mGetSlot(m);
    if (!hours[h][slot]) hours[h][slot] = m;
  });
  return hours;
}

// ================================================================
// LINHA H — Cabeçalho de minutos (topo e rodapé)
// ================================================================
function mBuildHeaderRow() {
  const row = document.createElement('div');
  row.style.cssText = `display:grid; grid-template-columns:28px repeat(${MOSAIC_COLS},1fr); gap:1px; margin-bottom:1px;`;

  const lh = document.createElement('div');
  lh.style.cssText = `background:#111; color:#666; font-size:9px; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; justify-content:center; border-radius:2px; padding:3px 0;`;
  lh.textContent = 'H';
  row.appendChild(lh);

  MOSAIC_MINUTE_SLOTS.forEach(min => {
    const c = document.createElement('div');
    c.style.cssText = `background:#111; color:#aaa; font-size:9px; font-family:'JetBrains Mono',monospace; text-align:center; padding:3px 1px; border-radius:2px; font-weight:700;`;
    c.textContent = min;
    row.appendChild(c);
  });
  return row;
}

// ================================================================
// LINHAS G e % — Estatísticas por coluna
// ================================================================
function mBuildStatsRows(hoursData) {
  const allHours = Object.values(hoursData);

  // G: total de gols por coluna
  const golsRow = document.createElement('div');
  golsRow.style.cssText = `display:grid; grid-template-columns:28px repeat(${MOSAIC_COLS},1fr); gap:1px; margin-bottom:1px;`;
  const glabel = document.createElement('div');
  glabel.style.cssText = `background:#111; color:#888; font-size:8px; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; justify-content:center; border-radius:2px;`;
  glabel.textContent = 'G';
  golsRow.appendChild(glabel);

  const pctRow = document.createElement('div');
  pctRow.style.cssText = `display:grid; grid-template-columns:28px repeat(${MOSAIC_COLS},1fr); gap:1px; margin-bottom:2px;`;
  const plabel = document.createElement('div');
  plabel.style.cssText = `background:#111; color:#888; font-size:8px; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; justify-content:center; border-radius:2px;`;
  plabel.textContent = '%';
  pctRow.appendChild(plabel);

  for (let col = 0; col < MOSAIC_COLS; col++) {
    let totalGols = 0, totalJogos = 0, overCount = 0;
    allHours.forEach(slots => {
      const m = slots[col];
      if (!m) return;
      const { gols } = mGetScore(m);
      totalGols += gols;
      totalJogos++;
      if (gols >= 3) overCount++;
    });

    const gc = document.createElement('div');
    gc.style.cssText = `background:#0d1a0d; color:#4cff4c; font-size:8px; font-family:'JetBrains Mono',monospace; text-align:center; padding:2px 1px; border-radius:2px; font-weight:700;`;
    gc.textContent = totalGols || '';
    golsRow.appendChild(gc);

    const overPct  = totalJogos ? Math.round(overCount / totalJogos * 100) : 0;
    const underPct = totalJogos ? 100 - overPct : 0;
    const pc = document.createElement('div');
    pc.style.cssText = `background:#0d0d0d; font-size:7px; font-family:'JetBrains Mono',monospace; text-align:center; padding:1px; border-radius:2px; display:flex; flex-direction:column; line-height:1.3;`;
    pc.innerHTML = `<span style="color:#4cff4c">${overPct}</span><span style="color:#ff4c4c">${underPct}</span>`;
    pctRow.appendChild(pc);
  }

  return [golsRow, pctRow];
}

// ================================================================
// LINHA DE UMA HORA
// ================================================================
function mBuildHourRow(horaLabel, slots, isCurrentHour) {
  const row = document.createElement('div');
  row.style.cssText = `display:grid; grid-template-columns:28px repeat(${MOSAIC_COLS},1fr); gap:1px; margin-bottom:1px;`;

  // Label da hora
  const lbl = document.createElement('div');
  lbl.style.cssText = `
    background:#111;
    color:${isCurrentHour ? '#ffcc00' : '#666'};
    font-size:9px;
    font-family:'JetBrains Mono',monospace;
    font-weight:700;
    display:flex; align-items:center; justify-content:center;
    border-radius:2px;
  `;
  lbl.textContent = horaLabel;
  row.appendChild(lbl);

  slots.forEach(m => {
    const cell = document.createElement('div');
    if (!m || !m.score || m.score === '—') {
      cell.style.cssText = `background:#0a0a0a; border:1px solid #111; border-radius:2px; min-height:28px;`;
      row.appendChild(cell);
      return;
    }

    const { hs, as, gols } = mGetScore(m);
    const isOver = gols >= 3;
    const bg = isOver ? '#0a2e0a' : '#2e0a0a';
    const scoreColor = isOver ? '#4cff4c' : '#ff6666';

    cell.style.cssText = `
      background:${bg};
      border-radius:2px;
      min-height:28px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:700;
      font-family:'JetBrains Mono',monospace;
      color:${scoreColor};
      cursor:pointer;
    `;
    cell.textContent = `${hs}-${as}`;
    cell.title = `${mGetHour(m)}:${mGetMinute(m)} · ${m.timeA||'?'} vs ${m.timeB||'?'} · ${gols} gols`;
    row.appendChild(cell);
  });

  return row;
}

// ================================================================
// RENDERIZAÇÃO PRINCIPAL
// ================================================================
function renderMosaic(matches) {
  const container = document.getElementById('mosaicGridLive');
  if (!container) {
    console.warn('[MOSAICO] Container mosaicGridLive não encontrado');
    return;
  }

  if (!matches || !matches.length) {
    container.innerHTML = '<div style="padding:16px;color:#555;font-family:monospace;font-size:11px;">⬛ Nenhum jogo — aguardando DarkOdds...</div>';
    return;
  }

  const hoursData   = mGroupByHour(matches);
  const hoursKeys   = Object.keys(hoursData).sort(); // oldest first
  const currentHour = new Date().getHours().toString().padStart(2, '0');

  container.innerHTML = '';
  container.style.cssText = `padding:4px 8px; box-sizing:border-box; overflow-x:auto;`;

  // Linha H (topo)
  container.appendChild(mBuildHeaderRow());

  // Linhas G e %
  const [golsRow, pctRow] = mBuildStatsRows(hoursData);
  container.appendChild(golsRow);
  container.appendChild(pctRow);

  // Linhas de hora
  hoursKeys.forEach(hora => {
    container.appendChild(mBuildHourRow(hora, hoursData[hora], hora === currentHour));
  });

  // Linha H (rodapé)
  container.appendChild(mBuildHeaderRow());

  console.log(`[MOSAICO] ${hoursKeys.length} horas × ${MOSAIC_COLS} colunas · ${matches.length} jogos`);
}

// Alias compat app.js
function renderMosaicLive(matches, rule, options) {
  renderMosaic(matches);
}

// ================================================================
// CARREGA DA DARKODDS + POLLING 30s
// ================================================================
async function loadMosaicData() {
  try {
    const res = await fetch('/api/virtual?limit=400');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let matches = [];
    if (data.recent_matches && data.recent_matches.length) {
      matches = data.recent_matches;
    } else if (data.matches && data.matches.length) {
      matches = data.matches;
    } else if (data.games && data.games.length) {
      matches = data.games;
    } else if (Array.isArray(data)) {
      matches = data;
    } else if (data.leagues) {
      const keys = Object.keys(data.leagues);
      for (const k of keys) {
        if (data.leagues[k]?.recent_matches?.length) {
          matches = data.leagues[k].recent_matches;
          break;
        }
      }
    }

    if (!matches.length) {
      console.warn('[MOSAICO] API retornou 0 jogos');
      return;
    }

    renderMosaic(matches);
  } catch (err) {
    console.error('[MOSAICO] Erro:', err.message);
  }
}

loadMosaicData();
setInterval(loadMosaicData, 30000);
