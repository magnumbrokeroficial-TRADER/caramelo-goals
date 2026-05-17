// Analyst — adaptado para novo /api/analyst (colunas, não ciclo)

const SINAL_COR = {
  over:    '#26c281',
  under:   '#ef4444',
  neutro:  '#888780',
  aguardar:'#EF9F27',
};

async function fetchAnalyst(liga) {
  try {
    const res = await fetch('/api/analyst?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[Analyst] erro:', e.message);
    return null;
  }
}

function renderAnalyst(data, containerId = 'analystWidget') {
  const el = document.getElementById(containerId);
  if (!el || !data) return;

  if (!data.analysis || data.analysis.length === 0) {
    el.innerHTML = '<div style="color:#666;font-size:12px;padding:8px;">Sem dados de análise.</div>';
    return;
  }

  // Ordena por |score| (maior convicção primeiro)
  const sorted = [...data.analysis].sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const top = sorted.slice(0, 5);

  const bestOver = data.summary?.bestOver;
  const bestUnder = data.summary?.bestUnder;
  const bestOverColor = bestOver?.pOver >= 65 ? '#26c281' : '#888';
  const bestUnderColor = bestUnder?.pUnder >= 65 ? '#ef4444' : '#888';

  el.innerHTML = `
    <div style="border:1px solid #333;border-radius:8px;padding:12px;background:#111;font-size:13px;font-family:monospace;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#888;">Hora atual</span>
        <span style="color:#fff;font-weight:bold;">${String(data.hour).padStart(2,'0')}h</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#888;">Média global</span>
        <span style="color:#fff;">${data.meta?.globalMean?.toFixed(2) || '-'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#888;">Sinais fortes</span>
        <span style="color:#fff;">${data.summary?.strongSignals || 0}</span>
      </div>
      <hr style="border-color:#333;margin:8px 0;">
      ${bestOver ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#888;">Melhor OVER</span>
        <span style="color:${bestOverColor};font-weight:bold;">${bestOver.game} ${bestOver.pOver.toFixed(1)}%</span>
      </div>` : ''}
      ${bestUnder ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#888;">Melhor UNDER</span>
        <span style="color:${bestUnderColor};font-weight:bold;">${bestUnder.game} ${bestUnder.pUnder.toFixed(1)}%</span>
      </div>` : ''}
      <hr style="border-color:#333;margin:8px 0;">
      <div style="color:#666;font-size:11px;margin-bottom:6px;">TOP COLUNAS</div>
      ${top.map(a => {
        const isOver = a.pOver >= 50;
        const pct = isOver ? a.pOver : a.pUnder;
        const cor = isOver ? '#26c281' : '#ef4444';
        return `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span style="color:#aaa;">${a.game} ${a.time}</span>
          <span style="color:${cor};">${isOver ? 'OVER' : 'UNDER'} ${pct.toFixed(1)}%</span>
        </div>`;
      }).join('')}
    </div>
  `;
}
