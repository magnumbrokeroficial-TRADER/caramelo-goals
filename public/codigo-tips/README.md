# 🟡 Caramelo Goals — Sistema de Análise Técnica para Futebol Virtual

> Plataforma estilo TradingView aplicada a séries temporais de gols em futebol virtual.
> Detecta padrões automaticamente, calcula confiança, faz backtest e envia alertas.

## 🚀 Como rodar (já funciona)

Abra `index.html` direto no navegador. Não precisa de servidor nem build.

Para hot-reload durante desenvolvimento:
```bash
npx serve .
# ou
python3 -m http.server 8080
```

Sem dependências de build — é HTML/CSS/JS puro com Lightweight Charts via CDN.

## 📦 Estrutura

```
caramelo-goals/
├── index.html              # Entry point — só HTML, sem lógica
├── src/
│   ├── styles.css          # Todo o CSS do app
│   ├── data.js             # Dados reais + gerador de mocks
│   ├── indicators.js       # RSI, Bollinger, MM, Momentum
│   ├── detectors.js        # 12 detectores de padrões
│   ├── engine.js           # Orquestrador + backtest
│   ├── mosaic.js           # Mosaico de placares no rodapé
│   ├── notifications.js    # Push, Telegram, Discord
│   ├── configurator.js     # Painel de configuração
│   ├── ui.js               # Renderizadores dos painéis
│   └── app.js              # Wire de tudo + tempo real
├── docs/
│   ├── PATTERNS.md         # Documentação dos 12 padrões
│   └── CLAUDE.md           # Instruções pro Claude Code agent
├── package.json
└── README.md (este arquivo)
```

## 🎯 Funcionalidades

### Visualização
- 3 gráficos sincronizados (gols, RSI, momento)
- Bandas adaptadas ao contexto de gols
- Marcadores automáticos onde padrões foram detectados
- Mosaico de placares no rodapé

### 12 Detectores de Padrão
1. Mean Reversion (Over)
2. Tendência Saudável (Over)
3. Topo Esgotado (Under)
4. Breakout de Compressão (direção do momento)
5. Divergência Baixista (Under)
6. Divergência Altista (Over)
7. 3 Soldados Brancos (Over)
8. 3 Corvos Pretos (Under)
9. Martelo (Over)
10. Estrela Cadente (Under)
11. Cluster de Topo (Under)
12. Cluster de Fundo (Over)

Detalhes em `docs/PATTERNS.md`.

### Backtest
Cada sinal histórico é validado nas próximas N rodadas. Estatísticas separadas por direção.

### Configurador (botão ⚙️)
Sliders para ajustar limiares dos indicadores em tempo real, com preview do backtest.
Persiste no localStorage.

### Notificações (botão 🔔)
- Browser Push (nativo)
- Telegram (via Bot API)
- Discord (via Webhooks)

### Tempo Real (simulado)
Nova rodada chega a cada 30s automaticamente. Em produção: substituir por WebSocket.

## 🔌 Próximos Passos

Veja `docs/CLAUDE.md` — roteiro completo para evoluir até produção.

## ⚙️ Stack

- HTML/CSS/JS puro (zero framework)
- TradingView Lightweight Charts 4.2 (Apache 2.0)
- localStorage para persistência
- Fetch API + Notification API

## 📜 Licença

Código original do projeto. Lightweight Charts sob Apache 2.0.
