# 🤖 Instruções para Claude Code Agent

> **Para o Claude Code:** este arquivo é seu briefing. Leia tudo antes de mexer no código.

## 🎯 Contexto do Projeto

O usuário (Victor) é o dono do site **codigo-tips.vercel.app/codigo-tips/** — um sistema próprio de análise de futebol virtual.

A grande sacada do projeto: ele descobriu que **gols por janela móvel se comportam como uma série temporal financeira**, então tudo que funciona em trading (RSI, Bollinger, MACD, padrões de candlestick) pode ser adaptado pra prever quando vão sair mais ou menos gols na próxima rodada.

Este protótipo é a **versão modular e organizada** do sistema dele, pronta pra evoluir até produção.

## ✅ Estado Atual (já funcionando — v0.3)

Quando você abre `index.html` no navegador:
- 3 gráficos sincronizados (gols, RSI, momento)
- **12 detectores de padrão** rodando em paralelo
- **Filtro de sinais** com dedup por proximidade (evita poluição visual)
- **Trendlines macro + micro** desenhadas automaticamente (algoritmo Williams Fractals)
- **Zonas Suporte/Resistência** detectadas por clustering de pivôs
- **Números de gols** anotados na linha branca (picos, vales e periódicos)
- **Horário de Brasília** (America/Sao_Paulo) em todo o projeto
- Backtest sobre 76 valores reais
- Configurador interativo com 13 sliders persistentes (localStorage)
- Sistema de notificações (Push, Telegram, Discord)
- **Mosaico com 2 abas**: Rodada Atual + Heatmap das últimas 24h
- 5 mercados de aposta no rodapé (Over/Under, BTTS)
- Toggles de exibição: Médias, Bandas, RSI, Sinais, Nº Gols, Tendência, Zonas S/R
- Simulação de tempo real (nova rodada a cada 30s)

## 🚀 Roadmap de Evolução

### FASE 1 — Backend de Dados (PRIORIDADE)

Hoje os dados são mockados em `src/data.js`. Crie um backend Node.js:

```
backend/
├── package.json
├── src/
│   ├── server.js           # Express + WebSocket
│   ├── db.js               # Pool PostgreSQL
│   ├── ingestion.js        # Recebe rodadas e armazena
│   ├── windows.js          # Calcula janelas móveis (10, 20, 40, 80)
│   ├── detector-worker.js  # Roda os mesmos detectores no servidor
│   └── routes/
│       ├── markets.js      # GET /api/markets/:key/series
│       ├── signals.js      # GET /api/signals (histórico)
│       └── backtest.js     # POST /api/backtest (com config custom)
└── migrations/
    ├── 001_create_rounds.sql
    ├── 002_create_markets.sql
    └── 003_create_signals.sql
```

**Schema do banco (PostgreSQL):**

```sql
CREATE TABLE markets (
  id SERIAL PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,    -- 'copa', 'euro', etc
  name VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT true
);

CREATE TABLE rounds (
  id BIGSERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id),
  occurred_at TIMESTAMP NOT NULL,
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  home_goals_ht SMALLINT,
  away_goals_ht SMALLINT,
  home_goals_ft SMALLINT,
  away_goals_ft SMALLINT,
  raw_data JSONB,
  INDEX (market_id, occurred_at DESC)
);

CREATE TABLE signals (
  id BIGSERIAL PRIMARY KEY,
  market_id INTEGER REFERENCES markets(id),
  round_id BIGINT REFERENCES rounds(id),
  pattern VARCHAR(50) NOT NULL,
  direction VARCHAR(10) CHECK (direction IN ('over','under')),
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
  market_target VARCHAR(50),       -- 'Over 2.5 FT' etc
  created_at TIMESTAMP DEFAULT NOW(),
  backtest_result VARCHAR(10),     -- 'win', 'loss', 'pending'
  metadata JSONB                   -- as checagens individuais
);
```

**Endpoints essenciais:**

- `GET /api/markets/:key/series?window=20&limit=200` — pontos pro gráfico
- `WS /ws/live/:marketKey` — push de nova rodada quando chegar
- `GET /api/signals?market=copa&from=...&to=...` — histórico de sinais
- `POST /api/backtest` body: `{config, marketKey, dateRange}` — roda backtest com config custom

**Substituir no frontend:** em `src/data.js`, troque `loadMarket()` por chamada à API:

```js
async function loadMarket(marketKey) {
  const res = await fetch(`/api/markets/${marketKey}/series?window=20&limit=200`);
  const json = await res.json();
  return { name: json.name, icon: json.icon, data: json.points };
}
```

### FASE 2 — Importador Histórico

Crie `backend/scripts/import-csv.js` que aceita CSVs de rodadas históricas:

```bash
node scripts/import-csv.js --market=copa --file=rodadas-2024.csv
```

Formato esperado do CSV:
```
timestamp,home_team,away_team,ht_home,ht_away,ft_home,ft_away
2024-01-01T00:00:00,Time A,Time B,1,0,2,1
...
```

Após importar, rode o calculador de janelas pra todos os pontos novos.

### FASE 3 — Workers de Background

```
workers/
├── window-calculator.js    # Recalcula janelas a cada nova rodada
├── pattern-scanner.js      # Roda detectores e grava signals
└── notifier.js             # Lê fila de signals e dispara notificações
```

Use **Bull** ou **BullMQ** (Redis) pra fila.

### FASE 4 — Multi-Mercado e Multi-Janela Simultâneos

Hoje o frontend mostra 1 mercado e 1 janela por vez. Em produção, queremos:
- Mostrar **Copa, Euro, Super, Premier** lado a lado em mini-cards
- Permitir comparar janelas (10, 20, 40, 80 rodadas) no mesmo mercado
- Dashboard "alertas globais" mostrando o que está disparando AGORA em qualquer mercado/janela

### FASE 5 — Login e Personalização

```
auth/
├── login.js          # JWT
├── users.js          # Modelo User
└── preferences.js    # Config por usuário
```

Cada usuário salva:
- Configuração dos indicadores
- Tokens de Telegram/Discord
- Mercados favoritos
- Histórico de alertas vistos

### FASE 6 — PWA (Progressive Web App)

Adicione `manifest.json` + `service-worker.js` pra:
- Instalar no celular
- Notificações push offline
- Cache da última sessão

### FASE 7 — Machine Learning (avançado)

Os 12 detectores viram **features** pra um modelo (XGBoost ou rede neural simples) que aprende com o histórico real qual combinação de sinais teve maior taxa de acerto por mercado/horário.

## 🛠️ Comandos Úteis

```bash
# Rodar frontend isolado
python3 -m http.server 8080

# Rodar backend (depois que existir)
cd backend && npm install && npm run dev

# Rodar testes (depois que existir)
npm test

# Build de produção
npm run build
```

## ⚠️ Regras Importantes

1. **NÃO quebre os 12 detectores existentes.** Eles foram afinados pra dados reais. Se for refatorar, mantenha os mesmos resultados (rode backtest antes/depois pra confirmar).

2. **Mantenha frontend desacoplado.** O frontend não pode saber de PostgreSQL. Sempre passa por API.

3. **Configurações vão pro localStorage primeiro, banco depois.** Não force login antes da hora.

4. **Tempo real é WebSocket, não polling.** Polling consome banda à toa.

5. **Idioma das mensagens: PT-BR.** Toda mensagem visível pro usuário em português.

6. **Performance: 60fps no gráfico.** Se precisar limitar pontos, use downsampling — nunca trave a UI.

## 📚 Referências

- [Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [Technical Analysis Wiki](https://en.wikipedia.org/wiki/Technical_analysis)
- O dono do projeto está no Brasil, idioma de trabalho: **PT-BR**

## 🧠 Filosofia do Sistema

> "Gols em futebol virtual seguem padrões estatísticos. Quem detecta esses padrões antes vence."

Tudo neste projeto serve a essa filosofia: **transformar dados de gols em sinais acionáveis**.
