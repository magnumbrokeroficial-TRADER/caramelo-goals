/* ============================================================
   🗺️ SIGNAL MAP — Mapa de Sinais
   ============================================================
   Permite ao usuário escolher quais detectores estão ativos.
   Mostra a accuracy histórica de cada um (calculada via backtest).

   AUTO-SELEÇÃO:
   Baseada no histórico atual, identifica os top N detectores
   por taxa de acerto e ativa apenas eles.

   PERSISTÊNCIA:
   A seleção é salva no ConfigStore como cfg.disabledDetectors
   (lista de nomes de padrões desligados).
============================================================ */

const SignalMap = {
  // Lista de todos os padrões disponíveis, organizados por categoria
  getAllPatterns() {
    return [
      ...this.getCategorized().map(g => g.patterns).flat(),
    ];
  },

  // Padrões agrupados por categoria (pra render organizado)
  getCategorized() {
    return [
      {
        category: 'Padrões Clássicos',
        icon: '📊',
        patterns: [
          'MEAN REVERSION',
          'TENDÊNCIA SAUDÁVEL',
          'TOPO ESGOTADO',
          'BREAKOUT DE COMPRESSÃO',
          'DIVERGÊNCIA BAIXISTA',
          'DIVERGÊNCIA ALTISTA',
        ],
      },
      {
        category: 'Padrões de Candle',
        icon: '🕯️',
        patterns: [
          '3 SOLDADOS BRANCOS',
          '3 CORVOS PRETOS',
          'MARTELO (HAMMER)',
          'ESTRELA CADENTE',
          'CLUSTER DE TOPO',
          'CLUSTER DE FUNDO',
        ],
      },
      {
        category: 'Estrutura (S/R + Trendlines)',
        icon: '📐',
        patterns: [
          'TOQUE EM ZONA S/R',
          'QUEBRA DE ZONA S/R',
          'TOQUE EM TRENDLINE',
        ],
      },
      {
        category: 'Big Odds',
        icon: '🎯',
        patterns: [
          'CRUZAMENTO BIG ODDS',
        ],
      },
      {
        category: 'Previsão de Placar',
        icon: '🎲',
        patterns: [
          'PREVISÃO 0x0',
          'PREVISÃO UNDER 3.5',
          'PREVISÃO OVER 3.5',
          'PREVISÃO OVER 4.5',
          'PREVISÃO 5+ GOLS',
        ],
      },
    ];
  },

  // Renderiza o modal com a lista de padrões agrupada por categoria
  render(accuracyStats = {}, disabledList = []) {
    const list = document.getElementById('signalMapList');
    if (!list) return;

    list.innerHTML = '';
    const categories = this.getCategorized();

    categories.forEach(group => {
      // Header da categoria
      const header = document.createElement('div');
      header.className = 'signal-map-category';
      header.innerHTML = `<span class="category-icon">${group.icon}</span> ${group.category}`;
      list.appendChild(header);

      // Items da categoria
      group.patterns.forEach(pattern => {
        const stats = accuracyStats[pattern];
        const isEnabled = !disabledList.includes(pattern);

        let accClass = 'no-data', badgeClass = 'none', badgeText = 'sem dados';
        if (stats && stats.total >= 3) {
          if (stats.accuracy >= 60) { accClass = 'high-acc'; badgeClass = 'high'; }
          else if (stats.accuracy >= 50) { accClass = 'mid-acc'; badgeClass = 'mid'; }
          else { accClass = 'low-acc'; badgeClass = 'low'; }
          badgeText = `${stats.accuracy.toFixed(0)}%`;
        }

        const item = document.createElement('label');
        item.className = `signal-map-item ${accClass}`;
        item.innerHTML = `
          <input type="checkbox" class="signal-map-checkbox" data-pattern="${pattern}" ${isEnabled ? 'checked' : ''}>
          <div class="signal-map-info">
            <div class="signal-map-name">${pattern}</div>
            <div class="signal-map-stats">
              <span class="acc-badge ${badgeClass}">${badgeText}</span>
              ${stats && stats.total >= 3 ? `<span>${stats.wins}/${stats.total} acertos</span>` : ''}
              <span style="opacity:0.6">${stats?.direction || ''}</span>
            </div>
          </div>
        `;
        list.appendChild(item);
      });
    });
  },

  // Pega o estado atual dos checkboxes
  readSelection() {
    const checkboxes = document.querySelectorAll('.signal-map-checkbox');
    const disabled = [];
    checkboxes.forEach(cb => {
      if (!cb.checked) disabled.push(cb.dataset.pattern);
    });
    return disabled;
  },

  // Marca/desmarca todos
  selectAll(enabled) {
    document.querySelectorAll('.signal-map-checkbox').forEach(cb => {
      cb.checked = enabled;
    });
  },

  // Auto-seleção: marca apenas os top N por accuracy
  applyAutoSelection(topPatterns) {
    document.querySelectorAll('.signal-map-checkbox').forEach(cb => {
      cb.checked = topPatterns.includes(cb.dataset.pattern);
    });
  },
};
