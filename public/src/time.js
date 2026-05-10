/* ============================================================
   🇧🇷 TIMEZONE BRASÍLIA
   ============================================================
   Helper único pra formatar horários no fuso de Brasília.
   Usado em TODOS os pontos do projeto que mostram tempo.

   - America/Sao_Paulo: UTC-3 fixo (Brasil aboliu horário de
     verão em 2019, então não há ajuste sazonal)
============================================================ */

const TZ = 'America/Sao_Paulo';

const BR = {
  // "20:46"
  hm(timestamp) {
    const d = typeof timestamp === 'number'
      ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
      : timestamp;
    return d.toLocaleTimeString('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // "20:46:33"
  hms(timestamp) {
    const d = typeof timestamp === 'number'
      ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
      : timestamp;
    return d.toLocaleTimeString('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  },

  // "10/05 20:46"
  dhm(timestamp) {
    const d = typeof timestamp === 'number'
      ? new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp)
      : timestamp;
    return d.toLocaleString('pt-BR', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Hora atual (timestamp em segundos) ajustada pra Brasília
  nowSec() {
    return Math.floor(Date.now() / 1000);
  },
};
