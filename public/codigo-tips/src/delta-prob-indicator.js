/* ================================================================
   Δ Gauge — Velocímetro de Fluxo de Gols
   Compara bloco atual (20 jogos) vs bloco anterior (20 jogos)
   Renderiza gauge SVG com zonas coloridas e agulha
   ================================================================ */
(function () {
  'use strict';

  var WRAP_ID = 'delta-indicator-wrap';
  var BLOCK_SIZE = 20;

  function getScoreTotal(match) {
    if (!match || !match.score || match.score === '—') return 0;
    var p = match.score.split('-');
    return (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0);
  }

  function getActiveLiga() {
    var btn = document.querySelector('.market-btn.active');
    return btn ? btn.getAttribute('data-market') : 'copa';
  }

  function computeStats(liga) {
    var data = window.__LAST_MATCH && window.__LAST_MATCH[liga];
    if (!data || !data.recent_matches || data.recent_matches.length < BLOCK_SIZE * 2) return null;

    var m = data.recent_matches;
    var cur = m.slice(0, BLOCK_SIZE);
    var prev = m.slice(BLOCK_SIZE, BLOCK_SIZE * 2);
    var deltas = [];
    for (var i = 0; i < BLOCK_SIZE; i++) {
      deltas.push(getScoreTotal(cur[i]) - getScoreTotal(prev[i]));
    }
    var sum = deltas.reduce(function (a, b) { return a + b; }, 0);
    var max = Math.max.apply(null, deltas);
    var min = Math.min.apply(null, deltas);
    var avg = (sum / BLOCK_SIZE);
    var exp = deltas.filter(function (d) { return d > 0; }).length;
    var con = deltas.filter(function (d) { return d < 0; }).length;
    return { deltas: deltas, sum: sum, max: max, min: min, avg: avg, expansao: exp, contracao: con, total: BLOCK_SIZE };
  }

  function getZoneInfo(v) {
    if (v >= 60) return { phase: 'EXPANSÃO EXTREMA (OVER)', sub: 'MOMENTO FORTEMENTE POSITIVO', m: '▲ OVER' };
    if (v >= 20) return { phase: 'EXPANSÃO (OVER)', sub: 'MOMENTO POSITIVO', m: '▲ OVER' };
    if (v > -20) return { phase: 'NEUTRO', sub: 'MOMENTO EQUILIBRADO', m: '◆ NEUTRO' };
    if (v > -60) return { phase: 'CONTRAÇÃO (UNDER)', sub: 'MOMENTO NEGATIVO', m: '▼ UNDER' };
    return { phase: 'CONTRAÇÃO EXTREMA (UNDER)', sub: 'MOMENTO FORTEMENTE NEGATIVO', m: '▼ UNDER' };
  }

  function renderGauge(stats, liga) {
    var sum = Math.max(-80, Math.min(80, stats.sum));
    var cx = 200, cy = 190, r = 148;
    var zones = [
      { f: 180, t: 202.5, c: '#e74c3c' },
      { f: 202.5, t: 247.5, c: '#e67e22' },
      { f: 247.5, t: 292.5, c: '#f1c40f' },
      { f: 292.5, t: 337.5, c: '#a8d428' },
      { f: 337.5, t: 360, c: '#27ae60' },
    ];

    function pt(deg) {
      var rad = deg * Math.PI / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    var zoneSvg = '';
    zones.forEach(function (z) {
      var s = pt(z.f), e = pt(z.t);
      zoneSvg += '<path d="M' + s.x.toFixed(1) + ',' + s.y.toFixed(1) + ' A' + r + ',' + r + ' 0 0 1 ' + e.x.toFixed(1) + ',' + e.y.toFixed(1) + '" stroke="' + z.c + '" stroke-width="18" fill="none" />';
    });

    // Ticks at every 20
    var tickVals = [-80, -60, -40, -20, 0, 20, 40, 60, 80];
    var tickSvg = '';
    tickVals.forEach(function (v) {
      var a = 270 + v * (90 / 80);
      var rad = a * Math.PI / 180;
      var ir = r + 14, or2 = r + 24, lr = r + 36;
      var ix = cx + ir * Math.cos(rad), iy = cy + ir * Math.sin(rad);
      var ox = cx + or2 * Math.cos(rad), oy = cy + or2 * Math.sin(rad);
      var lx = cx + lr * Math.cos(rad), ly = cy + lr * Math.sin(rad);
      tickSvg += '<line x1="' + ix.toFixed(1) + '" y1="' + iy.toFixed(1) + '" x2="' + ox.toFixed(1) + '" y2="' + oy.toFixed(1) + '" stroke="#666" stroke-width="1"/>';
      tickSvg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle" fill="#777" font-size="8" font-family="monospace">' + v + '</text>';
    });

    // Sub-ticks at every 10
    for (var sv = -70; sv <= 70; sv += 10) {
      if (tickVals.indexOf(sv) >= 0) continue;
      var a2 = 270 + sv * (90 / 80);
      var rad2 = a2 * Math.PI / 180;
      var ir2 = r + 14, or3 = r + 20;
      var ix2 = cx + ir2 * Math.cos(rad2), iy2 = cy + ir2 * Math.sin(rad2);
      var ox2 = cx + or3 * Math.cos(rad2), oy2 = cy + or3 * Math.sin(rad2);
      tickSvg += '<line x1="' + ix2.toFixed(1) + '" y1="' + iy2.toFixed(1) + '" x2="' + ox2.toFixed(1) + '" y2="' + oy2.toFixed(1) + '" stroke="#444" stroke-width="0.5"/>';
    }

    // Needle
    var nAngle = Math.max(180, Math.min(360, 270 + sum * (90 / 80)));
    var nRad = nAngle * Math.PI / 180;
    var nLen = r * 0.72;
    var nx = cx + nLen * Math.cos(nRad);
    var ny = cy + nLen * Math.sin(nRad);
    var nTail = r * 0.15;
    var tx = cx - nTail * Math.cos(nRad);
    var ty = cy - nTail * Math.sin(nRad);

    var sign = sum > 0 ? '+' : '';
    var valueTxt = sign + sum;
    var zone = getZoneInfo(sum);

    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    var curH = now.getHours();
    var prevH = (curH - 1 + 24) % 24;

    return '<div id="' + WRAP_ID + '" style="padding:10px 12px 8px;border-top:1px solid #222;background:#0d0d1a;font-family:monospace;">' +
      '<div style="display:flex;gap:12px;">' +
      // === LEFT: GAUGE (70%) ===
      '<div style="flex:7;min-width:0;">' +
      '<svg viewBox="0 0 400 280" width="100%" style="display:block;">' +
      zoneSvg +
      tickSvg +
      // Needle line
      '<line x1="' + tx.toFixed(1) + '" y1="' + ty.toFixed(1) + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#e0e0e0" stroke-width="2" stroke-linecap="round"/>' +
      // Center dot
      '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#e0e0e0"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="2" fill="#0d0d1a"/>' +
      // Value text
      '<text x="' + cx + '" y="' + (cy + r * 0.52) + '" text-anchor="middle" fill="#fff" font-size="36" font-weight="bold" font-family="monospace">' + valueTxt + '</text>' +
      // Zone label
      '<text x="' + cx + '" y="' + (cy + r * 0.52 + 22) + '" text-anchor="middle" fill="#e0e0e0" font-size="12" font-weight="600" font-family="monospace">' + zone.phase + '</text>' +
      // Subtitle
      '<text x="' + cx + '" y="' + (cy + r * 0.52 + 38) + '" text-anchor="middle" fill="#888" font-size="9" font-family="monospace">' + zone.sub + '</text>' +
      '</svg>' +
      '</div>' +
      // === RIGHT: SUMMARY (30%) ===
      '<div style="flex:3;min-width:140px;padding:6px 0 0 4px;">' +
      '<div style="font-size:10px;font-weight:600;color:#8b95b1;margin-bottom:8px;text-transform:uppercase;">Resumo do Ciclo Atual</div>' +
      '<div class="di-summary-row"><span style="color:#26c281;">↑</span> <span style="color:#888;font-size:10px;">MÁX DELTA</span><br><span style="color:#e0e0e0;font-size:13px;font-weight:700;">' + stats.max + '</span></div>' +
      '<div class="di-summary-row" style="margin-top:6px;"><span style="color:#ef4444;">↓</span> <span style="color:#888;font-size:10px;">MÍN DELTA</span><br><span style="color:#e0e0e0;font-size:13px;font-weight:700;">' + stats.min + '</span></div>' +
      '<div class="di-summary-row" style="margin-top:6px;"><span style="color:#f1c40f;">~</span> <span style="color:#888;font-size:10px;">MÉDIA DELTA</span><br><span style="color:#e0e0e0;font-size:13px;font-weight:700;">' + stats.avg.toFixed(1) + '</span></div>' +
      '<div class="di-summary-row" style="margin-top:6px;"><span style="color:#8b95b1;">⊙</span> <span style="color:#888;font-size:10px;">JOGOS ANALISADOS</span><br><span style="color:#e0e0e0;font-size:13px;font-weight:700;">' + stats.expansao + '/' + stats.total + '</span></div>' +
      '<div class="di-summary-row" style="margin-top:8px;padding-top:6px;border-top:1px solid #222;">' +
      '<span style="color:#888;font-size:10px;">TENDÊNCIA GERAL</span><br>' +
      '<span style="font-size:11px;font-weight:700;color:' + (stats.sum > 0 ? '#26c281' : stats.sum < 0 ? '#ef4444' : '#8b95b1') + ';">' +
      (stats.sum > 0 ? '▲ ' : stats.sum < 0 ? '▼ ' : '◆ ') +
      (stats.sum > 0 ? 'OVER' : stats.sum < 0 ? 'UNDER' : 'NEUTRO') + '</span><br>' +
      '<span style="color:#555;font-size:9px;">' + (stats.sum > 0 ? 'Expansão dominante' : stats.sum < 0 ? 'Contração dominante' : 'Equilíbrio') + '</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      // === FOOTER ===
      '<div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px solid #1a1a2e;font-size:9px;color:#555;">' +
      '<span>Última atualização: ' + hh + ':' + mm + ':' + ss + '</span>' +
      '<span>Ciclo atual: ' + curH + 'h · Anterior: ' + prevH + 'h</span>' +
      '<span>Baseado no delta de gols por coluna (J1 → J20)</span>' +
      '</div>' +
      '</div>';
  }

  function render() {
    var liga = getActiveLiga();
    var stats = computeStats(liga);
    if (!stats) return;

    var existing = document.getElementById(WRAP_ID);
    if (existing) existing.remove();

    var html = renderGauge(stats, liga);
    var mg = document.getElementById('mosaicGridLive');
    if (mg && mg.parentNode) {
      mg.parentNode.insertAdjacentHTML('beforeend', html);
    }
  }

  function init() {
    function tryInit(n) {
      if (n > 20) return;
      if (window.__LAST_MATCH && Object.keys(window.__LAST_MATCH).length) {
        render();
        return;
      }
      setTimeout(function () { tryInit(n + 1); }, 500);
    }
    tryInit(0);
    setInterval(render, 5000);
    var qs = document.getElementById('qtdJogosSelect');
    if (qs) qs.addEventListener('change', function () { setTimeout(render, 800); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
