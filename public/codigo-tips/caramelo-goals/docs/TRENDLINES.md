# 📐 Trendlines + Zonas S/R no Caramelo Goals

> Inspirado em conceitos clássicos de análise técnica (não em código proprietário).
> Implementação 100% original em JS, baseada em algoritmos públicos.

## Por que isso existe

O TradingView e indicadores como o DonForex PerfectZones usam basicamente os mesmos princípios:
1. **Encontrar pivôs** (Williams Fractals ou variantes) — pontos onde o preço fez um topo ou fundo local.
2. **Conectar pivôs da mesma natureza** com retas pra formar trendlines.
3. **Agrupar pivôs próximos em valor** pra formar zonas horizontais de suporte/resistência.

A gente aplicou esses três princípios à série de **total de gols na janela** ao invés de preço.

## 1. Detecção de Pivôs

```javascript
findSwings(values, leftBars, rightBars)
```

Um ponto `i` é **pivô de alta** (swing high) se o valor `values[i]` é maior que TODOS os `leftBars` valores anteriores E TODOS os `rightBars` valores posteriores.

Pivô de baixa (swing low) é o espelho: menor que tudo ao redor.

**Por que duas escalas:**
- `macroSwingBars: 12` → pivôs precisam de 12 barras de cada lado pra serem confirmados. Detecta tendências longas e estruturais.
- `microSwingBars: 4` → mais sensível, captura movimentos curtos.

## 2. Trendlines

```javascript
buildTrendlines(swings, dataLen)
```

Pega os **2 pivôs mais recentes** da mesma natureza:

- 2 últimos topos → desenha **resistência** (linha vermelha no chart)
- 2 últimos fundos → desenha **suporte** (linha verde no chart)

A inclinação (`slope`) é calculada por regressão simples entre os dois pontos:
```
slope = (p2.value - p1.value) / (p2.index - p1.index)
```

Depois extrapolamos a reta até o final da série visível pra projetar onde a linha "passaria" no momento atual.

**Visual:**
- Macro: linha sólida grossa (laranja/verde forte)
- Micro: linha tracejada fina (mesma cor com transparência)

## 3. Zonas Suporte/Resistência

```javascript
buildSRZones(values, swings, tolerance, minTouches)
```

Algoritmo de clustering simples:

1. Coleta TODOS os pivôs (topos e fundos) — todos são níveis que a série respeitou.
2. Ordena por valor (gols).
3. Percorre em ordem: junta pivôs próximos (distância ≤ `tolerance`) num cluster.
4. Cluster com `≥ minTouches` pivôs vira uma zona.

Cada zona retorna:
- `center`: valor médio dos pivôs no cluster
- `low` / `high`: limites verticais da zona
- `touches`: quantos pivôs caíram nela (= "W" no DonForex)
- `range`: amplitude vertical (= "R" no DonForex)
- `strength`: 0-100, normalizado pelo cluster mais populoso

**Visual:** banda horizontal cinza com transparência proporcional à força. Quanto mais toques teve, mais opaca.

## Equivalência conceitual com DonForex

| DonForex (financeiro)              | Caramelo Goals                          |
| ---------------------------------- | --------------------------------------- |
| Preço (OHLC)                       | Total de gols na janela                 |
| Pivot points (high/low fractals)   | findSwings(macro/micro)                 |
| Trendlines (T:N \| L:M)            | buildTrendlines (macro/micro)           |
| S/R Zones (SRZ # \| R: pts \| W:N) | buildSRZones (range, touches, strength) |
| Distância em pts até zona próxima  | (não implementado ainda)                |

## Configuração

Tudo é ajustável via slider no botão **⚙️ Configurar**:

```javascript
{
  macroSwingBars: 12,    // janela ampla pra trendlines longas
  microSwingBars: 4,     // janela curta pra trendlines de curto prazo
  srTolerance: 2.5,      // qual distância vertical agrupa pivôs em zona
  srMinTouches: 3,       // toques mínimos pra zona ser desenhada
}
```

## Como interpretar no contexto de gols

- **Resistência (linha vermelha)**: nível onde a série "trava" pra subir. Se o total de gols está se aproximando dela, baixa probabilidade de continuar subindo (Under tende a vir).
- **Suporte (linha verde)**: chão onde a série "trava" pra cair. Toque ali com RSI sobrevendido = candidato a Mean Reversion (Over).
- **Zona S/R (banda cinza)**: faixa de valores onde a série historicamente respeitou. Quanto mais opaca, mais relevante. Romper uma zona com volume (alto momento) é sinal de breakout.

## Limitações honestas

- A análise técnica em séries de gols é uma **adaptação experimental**. Funciona melhor em séries com bastante histórico — quanto mais pontos, mais robustas as zonas.
- Trendlines de apenas 2 pivôs são **frágeis**. Em produção, considerar exigir 3+ pivôs alinhados pra confirmação.
- Zonas em séries muito voláteis tendem a ser numerosas e pouco confiáveis. Aumentar `srTolerance` pra ter zonas mais largas e estáveis.
