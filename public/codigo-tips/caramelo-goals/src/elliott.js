/* ============================================================
   🌊 ELLIOTT WAVES (versão simplificada)
   ============================================================
   A Teoria de Elliott é complexa: alega que mercados (e,
   por extensão, séries cíclicas como gols) se movem em
   padrões fractais de:

   - 5 ondas IMPULSIVAS na direção da tendência (1, 2, 3, 4, 5)
   - 3 ondas CORRETIVAS contra a tendência (A, B, C)

   REGRAS BÁSICAS (Elliott "clássico"):
   • Onda 2 nunca pode retraçar mais de 100% da onda 1
   • Onda 3 nunca pode ser a mais curta entre 1, 3, 5
   • Onda 4 não pode invadir o território da onda 1
   • Onda 5 frequentemente atinge nível Fibonacci da onda 1

   O QUE FIZ AQUI:
   Implementei uma versão pragmática:
   1. Pega os swings detectados (alternando alto/baixo/alto/baixo)
   2. Tenta rotular os 8 últimos swings como sequência 1-2-3-4-5-A-B-C
   3. Valida regras 1, 2, 3
   4. Se passar nas regras → labels confiáveis
   5. Se falhar → marca como "estrutura indefinida"

   IMPORTANTE: Elliott em séries de gols é especulativo. Use como
   contexto adicional, não como sinal isolado.
============================================================ */

const ELLIOTT_LABELS = ['1', '2', '3', '4', '5', 'A', 'B', 'C'];

/**
 * Constrói uma sequência ZigZag a partir dos swings (alterna alto/baixo).
 * Necessário porque o detector de swings retorna alto e baixo separados.
 */
function buildZigZag(swings) {
  const all = [
    ...swings.swingHighs.map(s => ({ ...s, type: 'H' })),
    ...swings.swingLows.map(s => ({ ...s, type: 'L' })),
  ].sort((a, b) => a.index - b.index);

  // Filtra pra garantir alternância H, L, H, L...
  const zigzag = [];
  for (const point of all) {
    if (zigzag.length === 0) {
      zigzag.push(point);
    } else {
      const last = zigzag[zigzag.length - 1];
      if (point.type !== last.type) {
        zigzag.push(point);
      } else {
        // Mesmo tipo consecutivo: substitui se este é mais extremo
        if (last.type === 'H' && point.value > last.value) zigzag[zigzag.length - 1] = point;
        if (last.type === 'L' && point.value < last.value) zigzag[zigzag.length - 1] = point;
      }
    }
  }
  return zigzag;
}

/**
 * Tenta rotular os últimos 8 pontos como uma sequência Elliott completa.
 * Retorna lista de pontos com labels e flags de validade.
 */
function detectElliottWaves(swings, maxPoints = 8) {
  const zigzag = buildZigZag(swings);
  if (zigzag.length < 5) return null;

  // Pega os últimos N pontos (até maxPoints, no máximo o que tiver)
  const recent = zigzag.slice(-maxPoints);

  // Determina direção da onda 1 = direção do primeiro segmento
  const w1Direction = recent[1].value > recent[0].value ? 'up' : 'down';

  // Calcula os comprimentos das ondas (em valor absoluto)
  const waves = [];
  for (let i = 1; i < recent.length; i++) {
    waves.push({
      from: recent[i - 1],
      to: recent[i],
      length: Math.abs(recent[i].value - recent[i - 1].value),
      duration: recent[i].index - recent[i - 1].index,
    });
  }

  // ============= VALIDAÇÃO DAS REGRAS =============
  const violations = [];

  // Regra 1: Onda 2 não pode retraçar mais de 100% da onda 1
  if (waves.length >= 2) {
    if (waves[1].length > waves[0].length) {
      violations.push('Onda 2 maior que onda 1 (regra 1 violada)');
    }
  }

  // Regra 2: Onda 3 não pode ser a mais curta entre 1, 3, 5
  if (waves.length >= 5) {
    const w1 = waves[0].length;
    const w3 = waves[2].length;
    const w5 = waves[4].length;
    if (w3 < w1 && w3 < w5) {
      violations.push('Onda 3 é a mais curta (regra 2 violada)');
    }
  }

  // Regra 3: Onda 4 não pode invadir território da onda 1
  if (waves.length >= 4) {
    const w1End = recent[1].value;
    const w4End = recent[4]?.value;
    if (w1Direction === 'up' && w4End < recent[0].value) {
      violations.push('Onda 4 invadiu território da onda 1 (regra 3 violada)');
    }
    if (w1Direction === 'down' && w4End > recent[0].value) {
      violations.push('Onda 4 invadiu território da onda 1 (regra 3 violada)');
    }
  }

  // Rotula com letras/números Elliott
  const labels = ELLIOTT_LABELS.slice(0, recent.length);
  const labeled = recent.map((p, i) => ({
    ...p,
    waveLabel: i === 0 ? '0' : labels[i - 1],
    isImpulsive: i >= 1 && i <= 5,
    isCorrective: i >= 6,
  }));

  // Calcula projeção de onde a onda atual deveria terminar (Fibonacci)
  let projection = null;
  if (waves.length >= 1 && labeled.length === 5) {
    // Está terminando onda 4 → projeta onda 5
    const w1Length = waves[0].length;
    const lastPoint = labeled[labeled.length - 1];
    const w5Target = w1Direction === 'up'
      ? lastPoint.value + w1Length * 1.0   // onda 5 ≈ onda 1
      : lastPoint.value - w1Length * 1.0;
    projection = {
      label: 'Projeção onda 5',
      target: Math.round(w5Target * 10) / 10,
      basis: 'igualdade com onda 1 (Fibonacci 100%)',
    };
  }

  return {
    direction: w1Direction,
    points: labeled,
    waves,
    violations,
    isValid: violations.length === 0,
    projection,
    interpretation: getElliottInterpretation(labeled, violations.length === 0),
  };
}

function getElliottInterpretation(points, isValid) {
  if (!isValid) {
    return {
      stage: 'Estrutura indefinida',
      message: 'Os swings recentes não formam uma sequência Elliott válida — provavelmente em correção complexa ou consolidação.',
      suggestion: 'Aguardar mais clareza estrutural.',
    };
  }

  const lastWave = points[points.length - 1].waveLabel;
  const direction = points[1].value > points[0].value ? 'altista' : 'baixista';

  const map = {
    '1': { stage: 'Onda 1', message: `Início de movimento ${direction} impulsivo.`, suggestion: 'Aguardar onda 2 (correção rasa) pra entrar.' },
    '2': { stage: 'Onda 2', message: 'Correção da onda 1 — onda mais "armadilha".', suggestion: 'Esperar quebra do topo da onda 1 antes de operar.' },
    '3': { stage: 'Onda 3', message: 'Onda mais forte e longa do impulso. Momento máximo.', suggestion: direction === 'altista' ? 'Forte propensão a Over.' : 'Forte propensão a Under.' },
    '4': { stage: 'Onda 4', message: 'Correção complexa após onda 3.', suggestion: 'Aguardar conclusão pra pegar onda 5.' },
    '5': { stage: 'Onda 5', message: 'Última onda do impulso — frequentemente diverge no momento.', suggestion: 'Atenção pra reversão; preparar trade contra-tendência.' },
    'A': { stage: 'Correção A', message: 'Início de correção contra a tendência maior.', suggestion: direction === 'altista' ? 'Possível Under temporário.' : 'Possível Over temporário.' },
    'B': { stage: 'Correção B', message: 'Pullback dentro da correção. Não é reversão real.', suggestion: 'Operações curtas só.' },
    'C': { stage: 'Correção C', message: 'Última perna da correção — frequentemente igual à onda A em comprimento.', suggestion: 'Após C, retomada da tendência principal.' },
  };

  return map[lastWave] || map['1'];
}
