/**
 * Delta Flow — Sistema de Sinais
 * Lê dados de window.__LAST_MATCH (nunca do DOM do mosaico),
 * agrupa em blocos de 20 jogos, calcula deltas, detecta regime.
 *
 * Injetado como último filho de .mosaic-section.
 * Nenhum arquivo existente é modificado (exceto index.html para
 * os 2 scripts).
 */
(function () {
  'use strict';

  // ================================================================
  // CONFIG
  // ================================================================
  var BLOCK_SIZE = 20;

  // ================================================================
  // STATE
  // ================================================================
  var DF = {
    interval: 4,
    chart: null,
  };

  // ================================================================
  // OPERACOES POR REGIME
  // ================================================================
  var OPERACOES = {
    expansao: ['Over 1.5 FT', 'Over 2.5 FT', 'BTTS', 'Lay Under'],
    aceleracao: ['Over 1.5 FT', 'Over 1.5 HT', 'BTTS', 'Lay Under'],
    contracao: ['Under 2.5 FT', 'Under HT', 'Scalp anti-over', 'Lay Over'],
    exaustao: ['Under 2.5 FT', 'Under HT', 'Scalp anti-over', 'Lay Over'],
    neutro: ['Aguardar 3+ deltas consecutivos para entrada'],
  };

  // ================================================================
  // UTILITIES
  // ================================================================

  /** Parse score "2-1" → 3 gols totais. "—" ou inválido → 0 */
  function parseGols(score) {
    if (!score || score === '—') return 0;
    var parts = String(score).split('-');
    return (parseInt(parts[0]) || 0) + (parseInt(parts[1]) || 0);
  }

  /** Read all recent_matches from all leagues in window.__LAST_MATCH */
  function readAllMatches() {
    var leagues = window.__LAST_MATCH;
    if (!leagues) return [];
    var keys = Object.keys(leagues);
    var all = [];
    for (var ki = 0; ki < keys.length; ki++) {
      var league = leagues[keys[ki]];
      if (league && league.recent_matches && league.recent_matches.length) {
        var rm = league.recent_matches;
        for (var mi = 0; mi < rm.length; mi++) {
          all.push(rm[mi]);
        }
      }
    }
    return all;
  }

  /** Group array into blocks of size N */
  function groupIntoBlocks(arr, size) {
    var blocks = [];
    for (var i = 0; i < arr.length; i += size) {
      blocks.push(arr.slice(i, i + size));
    }
    return blocks;
  }

  /** Compute delta rows between consecutive blocks */
  function computeDeltas(blocks) {
    if (blocks.length < 2) return [];
    var deltas = [];
    for (var b = 1; b < blocks.length; b++) {
      var prev = blocks[b - 1];
      var curr = blocks[b];
      var row = [];
      for (var j = 0; j < BLOCK_SIZE; j++) {
        var prevGols = parseGols((prev[j] || {}).score);
        var currGols = parseGols((curr[j] || {}).score);
        row.push(currGols - prevGols);
      }
      deltas.push(row);
    }
    return deltas;
  }

  /** Count elements in array matching predicate */
  function countBy(arr, fn) {
    var c = 0;
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i])) c++;
    }
    return c;
  }

  /** Detect regime from last delta row */
  function detectRegime(lastRow) {
    if (!lastRow) return 'neutro';
    var pos = countBy(lastRow, function (d) { return d > 0; });
    var neg = countBy(lastRow, function (d) { return d < 0; });
    var momentum = lastRow.reduce(function (a, b) { return a + b; }, 0);

    var acc = [];
    var cum = 0;
    for (var i = 0; i < lastRow.length; i++) {
      cum += lastRow[i];
      acc.push(cum);
    }
    var slope = acc.length > 4 ? acc[acc.length - 1] - acc[acc.length - 5] : 0;

    if (pos >= 12 && momentum > 3) return 'expansao';
    if (neg >= 12 && momentum < -3) return 'contracao';
    if (slope > 2) return 'aceleracao';
    if (slope < -2) return 'exaustao';
    return 'neutro';
  }

  /** Minute label for cell hover (HH:MM) */
  function getMinuteLabel(jogoIdx, horaNum, interval) {
    var totalMins = 1 + jogoIdx * interval;
    var h = horaNum + Math.floor(totalMins / 60);
    var m = totalMins % 60;
    return (h % 24).toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
  }

  /** Get hour label for a block index */
  function getBlockLabel(blockIdx, numBlocks, interval) {
    var now = new Date();
    var blockDurationMin = BLOCK_SIZE * interval;
    var offset = (numBlocks - 1 - blockIdx) * blockDurationMin;
    var t = new Date(now.getTime() - offset * 60000);
    return t.getHours().toString().padStart(2, '0') + 'h';
  }

  /** Regime colour (hex) */
  function regimeColor(r) {
    return r === 'expansao' ? '#26c281' :
      r === 'contracao' ? '#ef4444' :
      r === 'aceleracao' ? '#ffb547' :
      r === 'exaustao' ? '#ef4444' : '#8b95b1';
  }

  /** Regime background (rgba) */
  function regimeBg(r) {
    return r === 'expansao' ? 'rgba(38,194,129,0.1)' :
      r === 'contracao' ? 'rgba(239,68,68,0.1)' :
      r === 'aceleracao' ? 'rgba(255,181,71,0.1)' :
      r === 'exaustao' ? 'rgba(239,68,68,0.1)' : 'rgba(139,149,177,0.08)';
  }

  function regimeIcon(r) {
    return r === 'expansao' ? '🟢' :
      r === 'contracao' ? '🔴' :
      r === 'aceleracao' ? '🟡' :
      r === 'exaustao' ? '🔴' : '⚪';
  }

  function getBannerInfo(r, pos, neg, momentum) {
    if (r === 'expansao') return {
      title: 'Expansão detectada — pressão de over',
      sub: pos + ' deltas positivos · momentum ' + (momentum >= 0 ? '+' : '') + momentum + ' · breakout de ciclo',
    };
    if (r === 'contracao') return {
      title: 'Contração detectada — esgotamento ofensivo',
      sub: neg + ' deltas negativos · momentum ' + (momentum >= 0 ? '+' : '') + momentum + ' · correção de ciclo',
    };
    if (r === 'aceleracao') return {
      title: 'Aceleração detectada — momentum crescente',
      sub: pos + ' deltas positivos · inclinação ascendente · entrada gradual',
    };
    if (r === 'exaustao') return {
      title: 'Exaustão detectada — perda de força ofensiva',
      sub: neg + ' deltas negativos · inclinação descendente · correção esperada',
    };
    return {
      title: 'Zona de equilíbrio — aguardar definição',
      sub: 'Deltas equilibrados · sem dominância clara · neutro',
    };
  }

  function getFooterText(r, pos, neg, m) {
    if (r === 'expansao') {
      return 'Regime atual: EXPANSÃO — ' + pos + ' deltas positivos nos últimos 20 slots. '
        + 'Mercado favorece overs com momentum ' + (m >= 0 ? '+' : '') + m
        + '. Buscar entrada em Over 1.5/2.5 FT com gestão de risco.';
    }
    if (r === 'aceleracao') {
      return 'Regime atual: ACELERAÇÃO — momentum crescente com ' + pos + ' deltas positivos. '
        + 'Inclinação de cauda positiva. Entrada gradual em overs.';
    }
    if (r === 'contracao') {
      return 'Regime atual: CONTRAÇÃO — ' + neg + ' deltas negativos nos últimos 20 slots. '
        + 'Mercado favorece unders com momentum ' + (m >= 0 ? '+' : '') + m
        + '. Buscar Under 2.5 FT ou scalp anti-over.';
    }
    if (r === 'exaustao') {
      return 'Regime atual: EXAUSTÃO — perda de força ofensiva com ' + neg + ' deltas negativos. '
        + 'Inclinação de cauda negativa. Priorizar unders.';
    }
    return 'Regime atual: NEUTRO — deltas equilibrados. Aguardar 3+ deltas consecutivos '
      + 'na mesma direção para confirmar entrada.';
  }

  function metricCard(label, value, color) {
    return '<div class="df-metric">'
      + '<div class="df-metric-label">' + label + '</div>'
      + '<div class="df-metric-value" style="color:' + color + '">' + value + '</div>'
      + '</div>';
  }

  // ================================================================
  // INLINE STYLES (injetados uma vez no head)
  // ================================================================
  function injectStyles() {
    if (document.getElementById('df-styles')) return;
    var css = document.createElement('style');
    css.id = 'df-styles';
    css.textContent = '\
.delta-flow-widget {\
  flex-shrink:0;\
  width:100%;\
  margin-top:16px;\
  background:#0d0d1a;\
  border:1px solid #222;\
  border-radius:6px;\
  overflow:hidden;\
  font-family:monospace;\
}\
.df-topbar {\
  display:flex;\
  align-items:center;\
  gap:8px;\
  padding:8px 12px;\
  border-bottom:1px solid #222;\
  flex-wrap:wrap;\
}\
.df-title {\
  font-size:13px;\
  font-weight:600;\
  color:#e0e0e0;\
}\
.df-badge-live {\
  font-size:9px;\
  color:#ef4444;\
  font-weight:700;\
  letter-spacing:0.5px;\
  animation:df-pulse 2s infinite;\
}\
@keyframes df-pulse {\
  0%,100%{opacity:1}\
  50%{opacity:0.4}\
}\
.df-spacer{flex:1}\
.df-interval-group{display:flex;gap:4px}\
.df-int-btn{\
  background:transparent;\
  color:#666;\
  border:1px solid #333;\
  border-radius:3px;\
  padding:2px 8px;\
  font-size:10px;\
  font-family:monospace;\
  cursor:pointer;\
}\
.df-int-btn:hover{border-color:#555;color:#aaa}\
.df-int-active{background:#1a3a1a!important;border-color:#26c281!important;color:#26c281!important}\
.df-btn-novo{\
  background:transparent;\
  color:#8b95b1;\
  border:1px solid #333;\
  border-radius:3px;\
  padding:2px 10px;\
  font-size:10px;\
  font-family:monospace;\
  cursor:pointer;\
}\
.df-btn-novo:hover{color:#e0e0e0;border-color:#555}\
.df-metrics{\
  display:grid;\
  grid-template-columns:repeat(4,1fr);\
  gap:6px;\
  padding:8px 12px;\
}\
.df-metric{\
  background:#111;\
  border:1px solid #222;\
  border-radius:4px;\
  padding:6px 8px;\
  text-align:center;\
}\
.df-metric-label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.3px}\
.df-metric-value{font-size:16px;font-weight:700;margin-top:2px;font-family:monospace}\
.df-banner{\
  display:flex;\
  align-items:center;\
  gap:10px;\
  padding:8px 12px;\
  margin:0 12px 8px;\
  border-radius:4px;\
}\
.df-banner-icon{font-size:20px}\
.df-banner-title{font-size:12px;font-weight:600;color:#e0e0e0}\
.df-banner-sub{font-size:10px;color:#888;margin-top:2px}\
.df-mosaico{padding:0 12px 8px}\
.df-mosaico-label{font-size:10px;color:#666;margin-bottom:4px}\
.df-table-wrap{overflow-x:auto}\
.df-table{\
  width:100%;\
  border-collapse:collapse;\
  font-size:10px;\
  font-family:monospace;\
  min-width:600px;\
}\
.df-table th,.df-table td{\
  padding:2px 3px;\
  text-align:center;\
  border:1px solid #222;\
  white-space:nowrap;\
}\
.df-th-hora{color:#8b95b1;font-weight:600;position:sticky;left:0;background:#0d0d1a;z-index:1}\
.df-th-j{color:#555;font-weight:400;font-size:9px}\
.df-th-total{color:#8b95b1;font-weight:600}\
.df-td-hora{color:#8b95b1;font-weight:600;font-size:10px;position:sticky;left:0;background:#0d0d1a;z-index:1}\
.df-td-gol{font-weight:600;font-size:10px;cursor:default}\
.df-td-total{color:#8b95b1;font-weight:600}\
.g0{background:transparent;color:#444}\
.g1{background:rgba(239,68,68,0.15);color:#ef4444}\
.g2{background:rgba(255,181,71,0.15);color:#ffb547}\
.g3{background:rgba(38,194,129,0.15);color:#26c281}\
.df-row-delta{background:rgba(255,255,255,0.02)}\
.df-td-delta{font-weight:700;font-size:10px}\
.dp{color:#26c281!important}\
.dn{color:#ef4444!important}\
.dz{color:#444!important}\
.df-ops-panel{\
  display:grid;\
  grid-template-columns:1fr 1fr;\
  gap:8px;\
  padding:8px 12px;\
  border-top:1px solid #222;\
}\
.df-ops-col{min-width:0}\
.df-ops-title{font-size:11px;font-weight:600;margin-bottom:4px}\
.df-ops-item{\
  font-size:10px;\
  color:#aaa;\
  padding:2px 0;\
  display:flex;\
  align-items:center;\
  gap:6px;\
}\
.df-ops-badge{\
  display:inline-block;\
  font-size:8px;\
  padding:1px 5px;\
  border-radius:3px;\
  font-weight:700;\
  letter-spacing:0.3px;\
  white-space:nowrap;\
}\
.df-ops-badge.fav{background:rgba(38,194,129,0.2);color:#26c281}\
.df-ops-badge.waiting{background:rgba(139,149,177,0.15);color:#8b95b1}\
.df-footer{\
  font-size:10px;\
  color:#555;\
  padding:6px 12px;\
  border-top:1px solid #222;\
  line-height:1.5;\
}\
.df-empty{\
  color:#555;\
  padding:12px;\
  font-size:11px;\
  text-align:center;\
}\
.df-match-panel{\
  margin:8px 12px;\
  background:#0d1a2a;\
  border-radius:6px;\
  padding:12px;\
}\
.df-match-header{\
  font-size:10px;\
  font-weight:600;\
  color:#8b95b1;\
  text-transform:uppercase;\
  margin-bottom:8px;\
  letter-spacing:0.5px;\
}\
.df-match-teams{\
  display:flex;\
  align-items:center;\
  justify-content:space-between;\
  margin-bottom:8px;\
}\
.df-team{\
  font-size:13px;\
  font-weight:600;\
  color:#e0e0e0;\
  flex:1;\
}\
.df-team-right{\
  text-align:right;\
}\
.df-score{\
  font-size:18px;\
  font-weight:700;\
  color:#fff;\
  margin:0 16px;\
}\
.df-match-odds{\
  display:flex;\
  gap:8px;\
  margin-bottom:8px;\
}\
.df-odd-box{\
  flex:1;\
  background:#0d0d1a;\
  border:1px solid #222;\
  border-radius:4px;\
  padding:6px 8px;\
  text-align:center;\
}\
.df-odd-label{\
  display:block;\
  font-size:9px;\
  color:#8b95b1;\
}\
.df-odd-val{\
  display:block;\
  font-size:13px;\
  font-weight:700;\
  color:#e0e0e0;\
}\
.df-match-prob{\
  display:flex;\
  gap:8px;\
  margin-bottom:8px;\
}\
.df-prob-item{\
  flex:1;\
  text-align:center;\
  font-size:11px;\
  font-weight:600;\
}\
.df-match-signal{\
  text-align:center;\
  padding-top:6px;\
  border-top:1px solid #222;\
}\
.df-signal-text{\
  font-size:11px;\
  color:#8b95b1;\
}\
.df-signal-regime{\
  font-size:10px;\
  margin-top:2px;\
}\
.df-match-empty{\
  color:#555;\
  font-size:11px;\
  text-align:center;\
  padding:12px;\
}';
    document.head.appendChild(css);
  }

  // ================================================================
  // MAIN RENDER
  // ================================================================

  function render() {
    var container = document.getElementById('delta-flow-widget');
    if (!container) return;

    // Read data
    var allMatches = readAllMatches();
    if (!allMatches.length) {
      container.innerHTML = '<div class="df-empty">⏳ Aguardando dados ao vivo...</div>';
      return;
    }

    // Reverse: oldest first (window.__LAST_MATCH: most recent first)
    allMatches = allMatches.slice().reverse();

    // Read qtd. jogos from the global filter
    var qtdSelect = document.getElementById('qtdJogosSelect');
    var totalJogos = qtdSelect ? parseInt(qtdSelect.value) : 480;
    var numBlocks = Math.floor(totalJogos / BLOCK_SIZE);
    if (isNaN(numBlocks) || numBlocks < 2) numBlocks = 3;

    var totalNeeded = numBlocks * BLOCK_SIZE;
    var sliced = allMatches.slice(0, totalNeeded);

    // Ensure at least 2 full blocks
    if (sliced.length < BLOCK_SIZE * 2) {
      var usable = Math.floor(allMatches.length / BLOCK_SIZE) * BLOCK_SIZE;
      sliced = allMatches.slice(0, Math.max(BLOCK_SIZE * 2, usable));
    }

    var blocks = groupIntoBlocks(sliced, BLOCK_SIZE);
    var deltas = computeDeltas(blocks);
    var lastRow = deltas.length > 0 ? deltas[deltas.length - 1] : null;
    var regime = detectRegime(lastRow);

    var momentum = lastRow ? lastRow.reduce(function (a, b) { return a + b; }, 0) : 0;
    var posCount = lastRow ? countBy(lastRow, function (d) { return d > 0; }) : 0;
    var negCount = lastRow ? countBy(lastRow, function (d) { return d < 0; }) : 0;

    var rColor = regimeColor(regime);
    var rBg = regimeBg(regime);
    var rIcon = regimeIcon(regime);
    var isOverFav = regime === 'expansao' || regime === 'aceleracao';
    var isUnderFav = regime === 'contracao' || regime === 'exaustao';
    var isNeutro = regime === 'neutro';

    // Block hour labels
    var blockLabels = [];
    for (var bi = 0; bi < blocks.length; bi++) {
      blockLabels.push(getBlockLabel(bi, blocks.length, DF.interval));
    }

    var bannerInfo = getBannerInfo(regime, posCount, negCount, momentum);

    // ---- BUILD HTML ----
    var h = '';

    // 1. Top bar
    h += '<div class="df-topbar">';
    h += '<span class="df-title">Δ Flow <span style="font-weight:400;opacity:0.6;">· sistema de sinais</span></span>';
    h += '<span class="df-badge-live">🔴 AO VIVO</span>';
    h += '<span class="df-spacer"></span>';
    h += '<span class="df-interval-group">';
    h += '<button class="df-int-btn' + (DF.interval === 2 ? ' df-int-active' : '') + '" data-int="2">2 min</button>';
    h += '<button class="df-int-btn' + (DF.interval === 3 ? ' df-int-active' : '') + '" data-int="3">3 min</button>';
    h += '<button class="df-int-btn' + (DF.interval === 4 ? ' df-int-active' : '') + '" data-int="4">4 min</button>';
    h += '</span>';
    h += '<button class="df-btn-novo" id="dfBtnRefresh">↻ Novo ciclo</button>';
    h += '</div>';

    // 2. Metrics
    h += '<div class="df-metrics">';
    h += metricCard('Momentum', (momentum >= 0 ? '+' : '') + momentum, rColor);
    h += metricCard('Deltas +', posCount + '/20', '#26c281');
    h += metricCard('Deltas −', negCount + '/20', '#ef4444');
    h += metricCard('Regime', regime.charAt(0).toUpperCase() + regime.slice(1), rColor);
    h += '</div>';

    // 3. Banner
    h += '<div class="df-banner" style="background:' + rBg + ';border-left:4px solid ' + rColor + ';">';
    h += '<span class="df-banner-icon">' + rIcon + '</span>';
    h += '<span class="df-banner-content">';
    h += '<span class="df-banner-title">' + bannerInfo.title + '</span>';
    h += '<span class="df-banner-sub">' + bannerInfo.sub + '</span>';
    h += '</span>';
    h += '</div>';

    // 4. Delta table
    h += '<div class="df-mosaico">';
    h += '<div class="df-mosaico-label">Mosaico sincronizado (intervalo: ' + DF.interval + ' min entre jogos)</div>';
    h += '<div class="df-table-wrap">';
    h += '<table class="df-table">';

    // Header
    h += '<thead><tr>';
    h += '<th class="df-th-hora">Slot</th>';
    for (var j = 1; j <= BLOCK_SIZE; j++) {
      h += '<th class="df-th-j">J' + j + '</th>';
    }
    h += '<th class="df-th-total">Total</th>';
    h += '</tr></thead>';

    // Body rows
    h += '<tbody>';
    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      var label = blockLabels[b];
      var totalGoals = 0;
      h += '<tr>';
      h += '<td class="df-td-hora">' + label + '</td>';
      var hNum = parseInt(label);
      for (var j = 0; j < BLOCK_SIZE; j++) {
        var m = block[j];
        var gols = m ? parseGols(m.score) : 0;
        totalGoals += gols;
        var gClass = gols === 0 ? 'g0' : gols === 1 ? 'g1' : gols === 2 ? 'g2' : 'g3';
        var minLabel = getMinuteLabel(j, hNum, DF.interval);
        h += '<td class="df-td-gol ' + gClass + '" title="' + minLabel + '">' + gols + '</td>';
      }
      h += '<td class="df-td-total">' + totalGoals + '</td>';
      h += '</tr>';
    }

    // Delta row
    if (lastRow && blocks.length >= 2) {
      h += '<tr class="df-row-delta">';
      h += '<td class="df-td-hora">Δ' + blockLabels[blocks.length - 1] + '−' + blockLabels[blocks.length - 2] + '</td>';
      var deltaTotal = 0;
      for (var j = 0; j < BLOCK_SIZE; j++) {
        var d = lastRow[j];
        deltaTotal += d;
        var dClass = d > 0 ? 'dp' : d < 0 ? 'dn' : 'dz';
        h += '<td class="df-td-delta ' + dClass + '">' + (d > 0 ? '+' : '') + d + '</td>';
      }
      h += '<td class="df-td-delta ' + (deltaTotal > 0 ? 'dp' : deltaTotal < 0 ? 'dn' : 'dz') + '">'
        + (deltaTotal > 0 ? '+' : '') + deltaTotal + '</td>';
      h += '</tr>';
    }

    h += '</tbody></table>';
    h += '</div></div>';

    // 5. Match panel (current game)
    var marketBtn = document.querySelector('.market-btn.active');
    var currentMarket = marketBtn ? marketBtn.getAttribute('data-market') : 'copa';
    var leagueData = window.__LAST_MATCH ? window.__LAST_MATCH[currentMarket] : null;

    h += '<div class="df-match-panel" style="border-left:4px solid ' + rColor + ';">';
    h += '<div class="df-match-header">🔴 ' + currentMarket.toUpperCase() + ' · AO VIVO</div>';

    if (leagueData && leagueData.match) {
      var m = leagueData.match;
      var odds = leagueData.odds || {};
      var prob = leagueData.prob || {};

      var score = m.resultado && m.resultado !== '—' ? m.resultado : '0×0';
      h += '<div class="df-match-teams">';
      h += '<span class="df-team">' + m.timeA + '</span>';
      h += '<span class="df-score">' + score + '</span>';
      h += '<span class="df-team df-team-right">' + m.timeB + '</span>';
      h += '</div>';

      h += '<div class="df-match-odds">';
      if (odds.over25) {
        h += '<div class="df-odd-box"><span class="df-odd-label">Over 2.5</span><span class="df-odd-val">' + odds.over25 + '</span></div>';
      }
      if (odds.btts_sim) {
        h += '<div class="df-odd-box"><span class="df-odd-label">BTTS Sim</span><span class="df-odd-val">' + odds.btts_sim + '</span></div>';
      }
      var underOdds = odds.under25 || (odds.over25 ? (parseFloat(odds.over25) / (parseFloat(odds.over25) - 1)).toFixed(2) : null);
      if (underOdds) {
        h += '<div class="df-odd-box"><span class="df-odd-label">Under 2.5</span><span class="df-odd-val">' + underOdds + '</span></div>';
      }
      h += '</div>';

      h += '<div class="df-match-prob">';
      if (prob.over25 != null) {
        var pc1 = prob.over25 > 50 ? '#26c281' : '#ef4444';
        h += '<div class="df-prob-item" style="color:' + pc1 + ';">Over 2.5 ' + prob.over25 + '%</div>';
      }
      if (prob.under25 != null) {
        var pc2 = prob.under25 > 50 ? '#26c281' : '#ef4444';
        h += '<div class="df-prob-item" style="color:' + pc2 + ';">Under 2.5 ' + prob.under25 + '%</div>';
      }
      if (prob.btts_sim != null) {
        var pc3 = prob.btts_sim > 50 ? '#26c281' : '#ef4444';
        h += '<div class="df-prob-item" style="color:' + pc3 + ';">BTTS Sim ' + prob.btts_sim + '%</div>';
      }
      h += '</div>';

      var arrow = isOverFav ? '▲' : isUnderFav ? '▼' : '◆';
      var direction = isOverFav ? 'OVER' : isUnderFav ? 'UNDER' : 'NEUTRO';
      var sigColor = isOverFav ? '#26c281' : isUnderFav ? '#ef4444' : '#8b95b1';
      h += '<div class="df-match-signal">';
      h += '<div class="df-signal-text">Delta Flow indica: <span style="color:' + sigColor + ';font-weight:700;">' + arrow + ' ' + direction + '</span> para este jogo</div>';
      h += '<div class="df-signal-regime" style="color:' + rColor + ';">Regime: ' + regime.charAt(0).toUpperCase() + regime.slice(1) + '</div>';
      h += '</div>';
    } else {
      h += '<div class="df-match-empty">⏳ Aguardando dados do jogo atual...</div>';
    }
    h += '</div>';

    // 6. Operations panel
    var overOps, underOps;
    if (isNeutro) {
      overOps = ['Aguardar 3+ deltas consecutivos para entrada'];
      underOps = ['Aguardar 3+ deltas consecutivos para entrada'];
    } else {
      var ops = OPERACOES[regime] || OPERACOES.neutro;
      overOps = ops.filter(function (o) {
        return o.indexOf('Over') === 0 || o.indexOf('BTTS') === 0 || o === 'Lay Under';
      });
      underOps = ops.filter(function (o) {
        return o.indexOf('Under') === 0 || o.indexOf('Scalp') === 0 || o === 'Lay Over';
      });
    }

    h += '<div class="df-ops-panel">';
    // Over column
    h += '<div class="df-ops-col">';
    h += '<div class="df-ops-title" style="color:#26c281;">▲ Over</div>';
    for (var oi = 0; oi < overOps.length; oi++) {
      var badge = isNeutro
        ? '<span class="df-ops-badge waiting">⏳ Aguardar</span>'
        : '<span class="df-ops-badge ' + (isOverFav ? 'fav' : 'waiting') + '">'
          + (isOverFav ? '✅ Favorável' : '⏳ Aguardar') + '</span>';
      h += '<div class="df-ops-item">' + badge + ' ' + overOps[oi] + '</div>';
    }
    h += '</div>';
    // Under column
    h += '<div class="df-ops-col">';
    h += '<div class="df-ops-title" style="color:#ef4444;">▼ Under</div>';
    for (var ui = 0; ui < underOps.length; ui++) {
      var badge2 = isNeutro
        ? '<span class="df-ops-badge waiting">⏳ Aguardar</span>'
        : '<span class="df-ops-badge ' + (isUnderFav ? 'fav' : 'waiting') + '">'
          + (isUnderFav ? '✅ Favorável' : '⏳ Aguardar') + '</span>';
      h += '<div class="df-ops-item">' + badge2 + ' ' + underOps[ui] + '</div>';
    }
    h += '</div>';
    h += '</div>';

    // 7. Footer
    h += '<div class="df-footer">' + getFooterText(regime, posCount, negCount, momentum) + '</div>';

    container.innerHTML = h;

    // Wire interval buttons
    var intBtns = container.querySelectorAll('.df-int-btn');
    for (var ib = 0; ib < intBtns.length; ib++) {
      intBtns[ib].addEventListener('click', function () {
        DF.interval = parseInt(this.getAttribute('data-int'));
        render();
      });
    }

    // Wire refresh button
    var refreshBtn = document.getElementById('dfBtnRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        render();
      });
    }
  }

  // ================================================================
  // BOOTSTRAP
  // ================================================================

  function init() {
    // Inject styles once
    injectStyles();

    // Check if widget already exists
    if (document.getElementById('delta-flow-widget')) return;

    // Inject inside mosaic-section (fix: parent was BODY due to insertBefore logic)
    var mosaicSection = document.querySelector('.mosaic-section');
    if (!mosaicSection) return;

    var widget = document.createElement('div');
    widget.id = 'delta-flow-widget';
    widget.className = 'delta-flow-widget';

    mosaicSection.appendChild(widget);

    // Wait for data, then render (Fix B+C: polling + setter intercept)
    function tryRender(attempt) {
      attempt = attempt || 0;
      if (attempt > 60) return; // desiste após 30s

      var lm = window.__LAST_MATCH;
      var hasData = lm &&
        Object.keys(lm).some(function (k) { return lm[k] && lm[k].recent_matches && lm[k].recent_matches.length > 0; });

      if (hasData) {
        render();
        return;
      }

      // Intercepta a próxima atribuição de window.__LAST_MATCH
      if (attempt === 0) {
        var orig = Object.getOwnPropertyDescriptor(window, '__LAST_MATCH');
        if (!orig || orig.configurable) {
          var currentVal = window.__LAST_MATCH;
          Object.defineProperty(window, '__LAST_MATCH', {
            configurable: true,
            enumerable: true,
            get: function () { return currentVal; },
            set: function (val) {
              currentVal = val;
              setTimeout(render, 100);
            },
          });
        }
      }

      setTimeout(function () { tryRender(attempt + 1); }, 500);
    }
    tryRender();

    // Listen to qtd. jogos select change
    var qtdSelect = document.getElementById('qtdJogosSelect');
    if (qtdSelect) {
      qtdSelect.addEventListener('change', function () {
        setTimeout(render, 600);
      });
    }

    // Periodic re-render (sync with data updates)
    setInterval(function () {
      // Only re-render if data changed (avoid unnecessary chart recreation)
      if (window.__LAST_MATCH && Object.keys(window.__LAST_MATCH).length) {
        render();
      }
    }, 30000);
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
