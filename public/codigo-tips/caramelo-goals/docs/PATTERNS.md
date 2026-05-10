# 📚 Documentação dos 12 Padrões de Detecção

> Referência técnica de cada padrão implementado em `src/detectors.js`.
> Cada um foi adaptado do contexto financeiro (candlestick) pro contexto de gols.

---

## Estrutura comum de retorno

Todo detector retorna ou `null` (padrão não detectado) ou:

```js
{
  active: true,
  confidence: 0-100,
  pattern: 'NOME DO PADRÃO',
  direction: 'over' | 'under',
  message: 'Explicação em PT-BR',
  market: ['Over 2.5 FT', ...],
  checks: [{ name, passed, partial?, detail }, ...]
}
```

A confiança é calculada a partir de quantas checagens passaram completamente vs parcialmente.

---

## 1. Mean Reversion (→ Over)

**Lógica:** quando a sequência de gols está esticada pra baixo (poucos gols), tende a voltar pra média.

**Condições:**
- Valor atual ≤ banda inferior × 1.05
- RSI < 35 (sobrevendido)
- Momento (MM rápida − MM lenta) virando pra cima

**Por que funciona:** estatisticamente, sequências extremas se corrigem. Quando a média móvel curta vira pra cima depois de uma queda longa, há acumulação de "energia de retorno".

**Mercados sugeridos:** Over 1.5 FT, Over 2.5 FT, Ambas Sim

---

## 2. Tendência Saudável (→ Over)

**Lógica:** sequência subindo de forma consistente, ainda longe do ponto de exaustão.

**Condições:**
- Valor > banda do meio (média)
- Momento positivo (> 0.5)
- RSI entre 50 e 70 (zona saudável, não saturada)

**Por que funciona:** "the trend is your friend" — uma vez confirmada a tendência, vale segui-la até aparecer sinal de reversão.

**Mercados sugeridos:** Over 2.5 FT, Over 3.5 FT

---

## 3. Topo Esgotado (→ Under)

**Lógica:** o espelho do mean reversion — sequência esticada pra cima, prestes a corrigir.

**Condições:**
- Valor ≥ banda superior × 0.97
- RSI > 68 (sobrecomprado)
- Momento desacelerando (atual < anterior)

**Mercados sugeridos:** Under 2.5 FT, Under 3.5 FT

---

## 4. Breakout de Compressão (→ direção do momento)

**Lógica:** quando as bandas se fecham (baixa volatilidade) e depois abrem rapidamente, vem movimento direcional forte.

**Condições:**
- Largura das últimas 5-12 rodadas < 85% da largura média histórica
- Largura atual > 105% da largura média
- Momento atual com força clara (|Mom| > 1)

**Por que funciona:** baixa volatilidade é "munição se acumulando". O sinal do momento dá a direção do disparo.

**Mercados sugeridos:** Over 2.5 / Ambas Sim (se momento positivo) ou Under 2.5 (se negativo)

---

## 5. Divergência Baixista (→ Under)

**Lógica:** o valor faz NOVO topo, mas o momento faz topo MAIS BAIXO. Sinal interno de fraqueza.

**Condições:**
- Topo recente (últimas 5 rodadas) > topo anterior (15-5 rodadas atrás)
- Momento no topo recente < momento no topo anterior

**Por que funciona:** o gráfico de preço pode mentir, mas o momento entrega a verdade. Quando ele falha em confirmar um novo topo, a tendência está enfraquecida.

**Mercados sugeridos:** Under 2.5 FT

---

## 6. Divergência Altista (→ Over)

**Lógica:** espelho da #5. Valor faz novo fundo mais baixo, mas o momento faz fundo mais alto.

**Condições:**
- Fundo recente < fundo anterior
- Momento no fundo recente > momento no fundo anterior

**Mercados sugeridos:** Over 2.5 FT, Ambas Sim

---

## 7. 3 Soldados Brancos (→ Over)

**Lógica:** padrão clássico de candlestick — 3 rodadas seguidas em alta com avanços consistentes.

**Condições:**
- 3 valores consecutivos: a < b < c
- Cada passo ≥ 1 gol (b-a ≥ 1, c-b ≥ 1)
- Avanço total ≥ 2 gols (c - a ≥ 2)
- Idealmente acima da média e com momento positivo

**Por que funciona:** consistência de movimento. Não é volatilidade aleatória, é tendência confirmada por múltiplos pontos.

**Mercados sugeridos:** Over 2.5 FT, Over 3.5 FT

---

## 8. 3 Corvos Pretos (→ Under)

**Lógica:** espelho do #7 — 3 rodadas seguidas em queda.

**Condições:**
- 3 valores consecutivos: a > b > c
- Cada passo ≥ 1 gol
- Queda total ≥ 2 gols
- Abaixo da média + momento negativo

**Mercados sugeridos:** Under 2.5 FT, Under 1.5 FT

---

## 9. Martelo / Hammer (→ Over)

**Lógica:** queda forte seguida de recuperação imediata. Vendedores tentaram derrubar, compradores reverteram.

**Condições:**
- Queda significativa nas últimas 1-2 rodadas (≥ 3 gols)
- Recuperação ≥ 50% da queda na rodada atual
- Mínimo da queda tocou banda inferior
- Valor atual voltando à média

**Por que funciona:** o "puxão pra baixo" foi rejeitado. Sinal de exaustão da pressão vendedora.

**Mercados sugeridos:** Over 2.5 FT, Ambas Sim

---

## 10. Estrela Cadente / Shooting Star (→ Under)

**Lógica:** espelho do martelo. Subida forte rejeitada com queda imediata.

**Condições:**
- Subida significativa nas últimas 1-2 rodadas (≥ 3 gols)
- Queda ≥ 50% da subida na rodada atual
- Pico tocou banda superior
- Valor atual voltando à média

**Mercados sugeridos:** Under 2.5 FT, Under 3.5 FT

---

## 11. Cluster de Topo (→ Under)

**Lógica:** consolidação prolongada perto da banda superior — falta de força pra romper sugere queda iminente.

**Condições:**
- 3-5 das últimas 5 rodadas dentro de 92% da banda superior
- RSI > 55 (zona de sobrecompra)
- Variação total das últimas 5 ≤ 6 gols (consolidação real)

**Por que funciona:** "consolidação no topo" sem rompimento é leitura clássica de exaustão. O mercado tenta avançar mas não consegue.

**Mercados sugeridos:** Under 2.5 FT, Under 3.5 FT

---

## 12. Cluster de Fundo (→ Over)

**Lógica:** espelho do #11 — consolidação prolongada perto da banda inferior.

**Condições:**
- 3-5 das últimas 5 rodadas dentro de 108% da banda inferior
- RSI < 45 (zona de sobrevenda)
- Variação total das últimas 5 ≤ 6 gols

**Mercados sugeridos:** Over 2.5 FT, Ambas Sim

---

## Sistema de Pontuação

Cada checagem dentro de um detector pode estar:
- `passed: true` → peso cheio (~30 pontos no exemplo)
- `partial: true` (mas não passed) → peso médio (~12 pontos)
- nenhuma das duas → 0 pontos

A confiança final é `min(100, soma_pesos)`. Sinais com confiança < `minConfidence` (configurável, default 35) são descartados.

## Como adicionar um novo padrão

1. Crie a função em `src/detectors.js`:
```js
function detectMyPattern(state, i) {
  const { values, rsi, bands, mom } = state;
  if (i < 25) return null; // dados insuficientes

  // ... sua lógica de checagem ...

  return {
    active: true,
    confidence: 0-100,
    pattern: 'MEU PADRÃO',
    direction: 'over' | 'under',
    message: '...',
    market: [...],
    checks: [...],
  };
}
```

2. Adicione na lista `DETECTORS` no fim do arquivo:
```js
const DETECTORS = [..., detectMyPattern];
```

3. Pronto — o engine roda automaticamente. Veja o backtest se vale a pena.

## Calibração

Após coletar histórico suficiente (≥ 1000 rodadas), use o configurador pra:
1. Variar limiares (RSI 30 vs 35 vs 40)
2. Variar período do RSI (7, 14, 21)
3. Variar desvio da banda (1.5, 1.8, 2.0)
4. Comparar acerto do backtest

Os parâmetros que dão maior acerto se tornam o default novo.
