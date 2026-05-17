/* ================================================================
   MOSAICO — Clone pixel-perfect do caramelotips
   Tabela 20 colunas × N horas com cabeçalhos G/％/minuto
   Over = bg verde (#1fcc59) | Under = bg vermelho (#dc2626)
   ================================================================ */
(function () {
  'use strict';

  var MOSAIC_COLS = 20;
  var MINUTE_LABELS = ['01','04','07','10','13','16','19','22','25','28','31','34','37','40','43','46','49','52','55','58'];

  function parseScore(s) {
    if (!s || s === '—' || s === '-') return 0;
    var parts = s.split('-');
    return (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0);
  }

  function computeColStats(groups, ci) {
    var vals = [];
    groups.forEach(function (g) {
      var m = g[ci];
      if (m && m.score && m.score !== '—' && m.score !== '-') {
        vals.push(parseScore(m.score));
      }
    });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    var overs = vals.filter(function (v) { return v >= 3; }).length;
    var pct = vals.length > 0 ? Math.round(overs / vals.length * 100) : null;
    return { total: total, overs: overs, pct: pct, count: vals.length };
  }

  function renderMosaic(matches) {
    var container = document.getElementById('mosaicGridLive');
    if (!container) return;

    if (!matches || !matches.length) {
      container.innerHTML = '<div style="padding:16px;color:#555;font-family:monospace;font-size:11px;">⬛ Nenhum jogo</div>';
      return;
    }

    var numHours = parseInt((document.getElementById('mosaicHoursSelect') || {}).value) || 6;
    var needed = numHours * MOSAIC_COLS;
    var sliced = matches.slice(0, needed);

    // Group into hour-blocks
    var groups = [];
    for (var i = 0; i < sliced.length; i += MOSAIC_COLS) {
      groups.push(sliced.slice(i, i + MOSAIC_COLS));
    }
    if (groups.length === 0) {
      container.innerHTML = '<div style="padding:16px;color:#555;">Sem dados suficientes</div>';
      return;
    }

    // Column stats
    var colStats = [];
    for (var c = 0; c < MOSAIC_COLS; c++) {
      colStats.push(computeColStats(groups, c));
    }

    var now = new Date();
    var display = groups.slice().reverse(); // most recent first

    // ---- BUILD HTML ----
    var h = '';

    h += '<div class="mosaic-table-wrap" style="overflow-x:auto;background:#333;border-radius:8px;border:1px solid #555;">';
    h += '<table class="mosaic-clone" style="width:100%;border-collapse:collapse;font-size:13px;font-family:system-ui,-apple-system,sans-serif;">';

    // Colgroup
    h += '<colgroup><col style="width:38px">';
    for (var ci = 0; ci < MOSAIC_COLS; ci++) h += '<col>';
    h += '<col style="width:42px"><col style="width:48px"></colgroup>';

    // ========================
    // THEAD
    // ========================
    h += '<thead>';

    // Row 0: G (total goals per column)
    h += '<tr>';
    h += '<th style="background:#1f2129;color:#d1d5db;font-weight:600;text-align:left;padding:6px 6px;border:1px solid #555;position:sticky;left:0;z-index:10;font-size:13px;line-height:1.3;">G⚽</th>';
    for (var ci = 0; ci < MOSAIC_COLS; ci++) {
      h += '<td style="background:#1f2129;color:#e5e7eb;text-align:center;padding:6px 2px;border:1px solid #555;font-size:13px;line-height:1.3;">' + colStats[ci].total + '</td>';
    }
    h += '<td style="background:#1f2129;border:1px solid #555;"></td>';
    h += '<td style="background:#1f2129;border:1px solid #555;"></td>';
    h += '</tr>';

    // Row 1: % (over percentage per column)
    h += '<tr>';
    h += '<th style="background:#1f2129;color:#d1d5db;font-weight:600;text-align:left;padding:6px 6px;border:1px solid #555;position:sticky;left:0;z-index:10;font-size:13px;line-height:1.3;">％</th>';
    for (var ci = 0; ci < MOSAIC_COLS; ci++) {
      var s = colStats[ci];
      var pctStr = s.pct !== null ? s.pct + '%' : '';
      var green = s.pct !== null && s.pct >= 50;
      h += '<td style="background:#1f2129;text-align:center;padding:6px 2px;border:1px solid #555;font-size:13px;line-height:1.3;">';
      if (pctStr) h += '<span style="color:' + (green ? '#1fcc59' : '#e5e7eb') + ';font-weight:' + (green ? '600' : '400') + ';">' + pctStr + '</span>';
      h += '</td>';
    }
    h += '<td style="background:#1f2129;border:1px solid #555;"></td>';
    h += '<td style="background:#1f2129;border:1px solid #555;"></td>';
    h += '</tr>';

    // Row 2: minute labels
    h += '<tr>';
    h += '<th style="background:#1f2129;color:#d1d5db;font-weight:600;text-align:left;padding:6px 6px;border:1px solid #555;position:sticky;left:0;z-index:10;font-size:13px;line-height:1.3;">H⏱️</th>';
    for (var ci = 0; ci < MOSAIC_COLS; ci++) {
      var sep = (ci > 0 && ci % 4 === 0) ? 'border-left:2.5px solid #888;' : '';
      h += '<td style="background:#1f2129;text-align:center;padding:6px 2px;border:1px solid #555;font-size:13.5px;font-weight:700;color:#fff;line-height:1.3;' + sep + '">' + MINUTE_LABELS[ci] + '</td>';
    }
    h += '<td style="background:#1f2129;text-align:center;padding:6px 2px;border:1px solid #555;color:#9ca3af;font-weight:600;font-size:13px;">％</td>';
    h += '<td style="background:#1f2129;text-align:center;padding:6px 2px;border:1px solid #555;color:#9ca3af;font-weight:600;font-size:13px;">G⚽</td>';
    h += '</tr>';
    h += '</thead>';

    // ========================
    // TBODY
    // ========================
    h += '<tbody>';
    for (var ri = 0; ri < display.length; ri++) {
      var group = display[ri];
      var hourLabel = String((now.getHours() - ri + 24) % 24);

      // Row aggregates
      var rowTotal = 0, rowOvers = 0, rowValid = 0;
      group.forEach(function (m) {
        if (m && m.score && m.score !== '—' && m.score !== '-') {
          var g = parseScore(m.score);
          rowTotal += g;
          if (g >= 3) rowOvers++;
          rowValid++;
        }
      });
      var rowPct = rowValid > 0 ? Math.round(rowOvers / rowValid * 100) : null;

      var totalColor = '#e5e7eb';
      if (rowPct !== null) {
        totalColor = rowPct >= 50 ? '#facc15' : '#ef4444';
      }

      h += '<tr class="result-row">';

      // Sticky hour label
      h += '<th style="background:#1f2129;color:#d1d5db;font-weight:500;padding:4px 6px;text-align:center;border:1px solid #555;position:sticky;left:0;z-index:5;font-size:0;line-height:1;">';
      h += '<div style="font-size:13.5px;font-weight:700;color:#d1d5db;">' + hourLabel + '</div>';
      h += '<input type="checkbox" style="width:12px;height:12px;display:block;margin:2px auto 0;">';
      h += '</th>';

      // Game cells
      for (var ci = 0; ci < MOSAIC_COLS; ci++) {
        var m = group[ci];
        var hasResult = m && m.score && m.score !== '—' && m.score !== '-';
        var gols = hasResult ? parseScore(m.score) : 0;
        var over = hasResult && gols >= 3;

        var bg, cellClass;
        if (!hasResult) {
          bg = '#3b3f49';
          cellClass = 'empty-cell';
        } else if (over) {
          bg = '#1fcc59';
          cellClass = 'over-hit';
        } else {
          bg = '#dc2626';
          cellClass = 'over-miss';
        }

        var sep = (ci > 0 && ci % 4 === 0) ? 'border-left:2.5px solid #888;' : '';

        h += '<td class="' + cellClass + '" style="background:' + bg + ';text-align:center;padding:4px 2px;border:1px solid #555;font-size:0;line-height:1.3;vertical-align:middle;' + sep + '"';

        if (m) {
          h += ' data-home-team="' + (m.timeA || '').toLowerCase().replace(/\s/g, '') + '"';
          h += ' data-away-team="' + (m.timeB || '').toLowerCase().replace(/\s/g, '') + '"';
          if (hasResult) {
            var parts = m.score.split('-');
            h += ' data-ft-home="' + (parseInt(parts[0]) || 0) + '"';
            h += ' data-ft-away="' + (parseInt(parts[1]) || 0) + '"';
            h += ' data-ft-sum="' + gols + '"';
          }
        }
        h += '>';

        if (hasResult) {
          h += '<div style="font-size:18px;font-weight:700;color:#fff;line-height:1.2;">' + m.score + '</div>';
          h += '<div style="font-size:10px;color:rgba(255,255,255,0.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">' + (m.timeA || '') + ' x ' + (m.timeB || '') + '</div>';
        } else if (m) {
          h += '<div style="font-size:10px;color:rgba(255,255,255,0.5);line-height:1.3;">⏳</div>';
          h += '<div style="font-size:8px;color:rgba(255,255,255,0.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px;">' + (m.timeA || '') + ' x ' + (m.timeB || '') + '</div>';
        } else {
          h += '<div style="font-size:10px;color:rgba(255,255,255,0.2);">—</div>';
        }

        h += '</td>';
      }

      // Right aggregates
      h += '<td style="background:#1f2129;text-align:center;padding:4px 2px;border:1px solid #555;font-size:13px;line-height:1.3;color:#e5e7eb;">';
      h += '<span style="' + (rowPct !== null && rowPct >= 50 ? 'color:#1fcc59;font-weight:600;' : (rowPct !== null && rowPct < 50 ? 'color:#ef4444;' : '')) + '">' + (rowPct !== null ? rowPct + '%' : '-') + '</span>';
      h += '</td>';
      h += '<td style="background:#1f2129;text-align:center;padding:4px 2px;border:1px solid #555;font-size:13px;line-height:1.3;">';
      h += '<div style="color:' + totalColor + ';font-weight:700;">' + rowTotal + '</div>';
      h += '<div style="color:#9ca3af;font-size:11px;">' + rowOvers +'</div>';
      h += '</td>';

      h += '</tr>';
    }
    h += '</tbody>';
    h += '</table></div>';

    container.innerHTML = h;

    // Update stats bar
    var totalGols = 0, totalOvers = 0, totalValid = 0;
    groups.forEach(function (g) {
      g.forEach(function (m) {
        if (m && m.score && m.score !== '—' && m.score !== '-') {
          var gols = parseScore(m.score);
          totalGols += gols;
          if (gols >= 3) totalOvers++;
          totalValid++;
        }
      });
    });
    var globalPct = totalValid > 0 ? Math.round(totalOvers / totalValid * 100) : 0;
    var globalAvg = totalValid > 0 ? (totalGols / totalValid).toFixed(1) : '0.0';

    var statsEl = document.getElementById('mosaicStatsLive');
    if (statsEl) {
      statsEl.innerHTML = '<span style="color:#8b95b1;font-size:11px;">📊 ' + globalPct + '% Over · Gols: ' + totalGols + ' · Média Gols Hora: ' + globalAvg +' · ' + groups.length + 'h</span>';
    }
  }

  // Alias compat com app.js
  function renderMosaicLive(matches, rule, options) {
    renderMosaic(matches);
  }

  // Export
  window.renderMosaic = renderMosaic;
  window.renderMosaicLive = renderMosaicLive;

  // ================================================================
  // AUTO-LOAD (mantido do original para init independente)
  // ================================================================
  async function loadMosaicData() {
    try {
      var res = await fetch('/api/virtual?limit=500');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();

      var allMatches = [];
      if (data.leagues) {
        var keys = Object.keys(data.leagues);
        for (var ki = 0; ki < keys.length; ki++) {
          var liga = data.leagues[keys[ki]];
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
})();
