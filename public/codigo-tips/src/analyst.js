// Analyst — detector de ciclo de gols
// Chamado a cada refresh do app (junto com fetchVirtual)

const FASE_COR = {
  compressao:    '#3B8BD4',  // azul
  aceleracao:    '#EF9F27',  // âmbar
  explosao:      '#E24B4A',  // vermelho
  explosao_forte:'#A32D2D',  // vermelho escuro
};

const FASE_LABEL = {
  compressao:    'Compressão',
  aceleracao:    'Aceleração',
  explosao:      'Explosão',
  explosao_forte:'Explosão Forte',
};

const SINAL_COR = {
  over:    '#26c281',
  under:   '#ef4444',
  neutro:  '#888780',
  aguardar:'#EF9F27',
};

async function fetchAnalyst(liga = 'copa') {
  try {
    const res = await fetch(`/api/analyst?liga=${liga}`);
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

  const faseCor = FASE_COR[data.fase_atual] || '#888';
  const faseLabel = FASE_LABEL[data.fase_atual] || data.fase_atual;
  const sinalCor = SINAL_COR[data.sinal] || '#888';
  const confianca = Math.round((data.confianca || 0) * 100);

  el.innerHTML = `
    <div style="border:1px solid #333; border-radius:8px; padding:12px; background:#111; font-size:13px; font-family:monospace;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#888;">Fase atual</span>
        <span style="color:${faseCor}; font-weight:bold;">${faseLabel}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#888;">Gols última hora</span>
        <span style="color:#fff;">${data.gols_ultima_hora}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#888;">Há ${data.horas_em_fase}h nesta fase</span>
        <span style="color:#888;">(anterior: ${data.gols_hora_anterior})</span>
      </div>
      <hr style="border-color:#333; margin:8px 0;">
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span style="color:#888;">Sinal</span>
        <span style="color:${sinalCor}; font-weight:bold; text-transform:uppercase;">${data.sinal}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#888;">Confiança</span>
        <span style="color:#fff;">${confianca}%</span>
      </div>
      <div style="color:#666; font-size:11px; margin-top:4px;">${data.descricao}</div>
    </div>
  `;
}
