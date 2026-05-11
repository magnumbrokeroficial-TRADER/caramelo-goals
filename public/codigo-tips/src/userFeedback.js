/* ============================================================
   ✅❌ USER FEEDBACK
   ============================================================
   Permite ao usuário marcar cada sinal como ACERTOU ou ERROU
   manualmente (caixinha ON-OFF nos cards). Feedback fica salvo
   no localStorage e pode ser usado para recalibrar accuracy
   no futuro.
============================================================ */

const UserFeedback = {
  STORAGE_KEY: 'codigotips_feedback',

  loadAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  },

  saveAll(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Falha ao salvar feedback:', e);
    }
  },

  // Pega feedback (win/loss/null) de um sinal
  // Aceita objeto sig ou string key
  get(sigOrKey) {
    const key = typeof sigOrKey === 'string' ? sigOrKey : `${sigOrKey.dataIndex}-${sigOrKey.pattern}`;
    return this.loadAll()[key] || null;
  },

  set(key, value) {
    const data = this.loadAll();
    data[key] = value;
    this.saveAll(data);
  },

  clear(key) {
    const data = this.loadAll();
    delete data[key];
    this.saveAll(data);
  },

  // Stats agregadas por padrão (para complementar o backtest automático)
  statsByPattern() {
    const all = this.loadAll();
    const byPattern = {};
    Object.entries(all).forEach(([key, fb]) => {
      const pattern = key.split('-').slice(1).join('-');
      if (!byPattern[pattern]) byPattern[pattern] = { wins: 0, losses: 0 };
      if (fb === 'win') byPattern[pattern].wins++;
      if (fb === 'loss') byPattern[pattern].losses++;
    });
    Object.values(byPattern).forEach(s => {
      s.total = s.wins + s.losses;
      s.accuracy = s.total > 0 ? (s.wins / s.total) * 100 : 0;
    });
    return byPattern;
  },
};
// v1.0.4 - fix 404
