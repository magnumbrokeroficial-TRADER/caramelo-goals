/* ============================================================
   📏 FIBONACCI RETRACEMENT
   ============================================================
   Calcula níveis de retração de Fibonacci a partir do "leg"
   mais recente significativo da série.

   COMO FUNCIONA:
   1. Pega janela final (ex: últimas 60 rodadas) da série
   2. Identifica swing high e swing low DENTRO dessa janela
   3. Determina direção do leg:
      - Se o high veio DEPOIS do low → leg ALTISTA
        (a série subiu; níveis de fib são pra onde ela pode recuar)
      - Se o low veio DEPOIS do high → leg BAIXISTA
        (a série caiu; níveis de fib são pra onde ela pode bouncear)
   4. Calcula os 7 níveis clássicos: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
   5. Mais 2 extensões: 127.2% e 161.8% (projeção de continuação)

   INTERPRETAÇÃO PRA GOLS:
   - 38.2% e 61.8% (zonas "douradas") = mais prováveis de "pegar" a série
   - 50% = zona psicológica
   - Extensões = onde o movimento pode terminar se quebrar 100%

   IMPORTANTE: Fib não é sinal de compra/venda — é referência de níveis
   onde reversões/pullbacks são mais prováveis. Combine com RSI e momento.
============================================================ */

const FIB_LEVELS = [
  { ratio: 0,     label: '0%',     color: '#ef4444', importance: 'high' },
  { ratio: 0.236, label: '23.6%',  color: 'rgba(168,108,46,0.7)',  importance: 'low' },
  { ratio: 0.382, label: '38.2%',  color: 'rgba(255,181,71,0.85)', importance: 'high' },
  { ratio: 0.5,   label: '50%',    color: 'rgba(168,85,247,0.7)',  importance: 'mid' },
  { ratio: 0.618, label: '61.8%',  color: 'rgba(255,181,71,0.85)', importance: 'high' },
  { ratio: 0.786, label: '78.6%',  color: 'rgba(168,108,46,0.7)',  importance: 'low' },
  { ratio: 1,     label: '100%',   color: '#26c281', importance: 'high' },
  { ratio: 1.272, label: '127.2%', color: 'rgba(168,85,247,0.45)', importance: 'low' },
  { ratio: 1.618, label: '161.8%', color: 'rgba(168,85,247,0.45)', importance: 'mid' },
];

/**
 * Calcula leg dominante e níveis de Fibonacci.
 *
 * @param {number[]} values - série de valores (gols)
 * @param {number} windowSize - quantas rodadas finais analisar (default 60)
 * @returns {object|null} { high, low, direction, highIdx, lowIdx, levels }
 */
function computeFibonacci(values, windowSize = 60) {
  if (!values || values.length < 10) return null;

  // Janela: últimos windowSize pontos (ou todos, se a série for menor)
  const start = Math.max(0, values.length - windowSize);
  const window = values.slice(start);

  // Encontra extremos absolutos da janela
  let high = -Infinity, highIdx = -1;
  let low = Infinity, lowIdx = -1;

  for (let i = 0; i < window.length; i++) {
    if (window[i] > high) { high = window[i]; highIdx = i + start; }
    if (window[i] < low)  { low  = window[i]; lowIdx  = i + start; }
  }

  // Se range é muito pequeno, não vale calcular fib
  if (high - low < 5) return null;

  // Direção do leg = qual veio depois?
  const direction = highIdx > lowIdx ? 'up' : 'down';

  // Calcula níveis
  // - up: leg de low→high; níveis de retração ficam ENTRE eles
  //       (0% no high, 100% no low — pullback do high pra baixo)
  // - down: leg de high→low; níveis de retração também
  //       (0% no low, 100% no high — bounce do low pra cima)
  const range = high - low;
  const levels = FIB_LEVELS.map(lvl => {
    const value = direction === 'up'
      ? high - range * lvl.ratio   // pullback descendo do high
      : low + range * lvl.ratio;   // bounce subindo do low
    return {
      ...lvl,
      value: Math.round(value * 10) / 10,
    };
  });

  return {
    direction,
    high,
    low,
    highIdx,
    lowIdx,
    range,
    levels,
    legStart: direction === 'up' ? lowIdx : highIdx,
    legEnd: direction === 'up' ? highIdx : lowIdx,
  };
}

/**
 * Identifica em qual nível de Fibonacci a série está agora.
 * Útil pra gerar sinais combinados (ex: "está em 61.8% + RSI sobrevendido").
 */
function currentFibPosition(value, fib) {
  if (!fib) return null;

  // Encontra os 2 níveis que cercam o valor atual
  let nearest = null, distance = Infinity;
  fib.levels.forEach(lvl => {
    const d = Math.abs(value - lvl.value);
    if (d < distance) {
      distance = d;
      nearest = lvl;
    }
  });

  return {
    nearestLevel: nearest,
    distance,
    isAtKeyLevel: nearest && nearest.importance === 'high' && distance < 1.5,
  };
}
