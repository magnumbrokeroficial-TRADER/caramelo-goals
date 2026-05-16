#!/usr/bin/env python3
"""
Analista Técnico DeepSeek — Caramelo Goals
Análise de séries de odds do Bet365 Virtual com indicadores técnicos
e inteligência artificial via DeepSeek para sugerir apostas de R$ 9,90.
"""

import argparse
import json
import math
import re
import sys
from datetime import datetime

import numpy as np
import requests

# ─── Config ──────────────────────────────────────────────────────────────
DARKODDS_URL  = "http://localhost:3003"
DEEPSEEK_KEY  = "sk-4fdab751eacb4287965d7fe139b2fa96"
DEEPSEEK_URL  = "https://api.deepseek.com/v1/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"
BET_AMOUNT    = 9.90

# ─── Indicadores Técnicos ────────────────────────────────────────────────

def calc_rsi(series: list, period: int = 14) -> list:
    """RSI (Relative Strength Index) — clássico, períodos."""
    arr = np.array(series, dtype=float)
    rsi = [None] * len(arr)
    if len(arr) < period + 1:
        return rsi
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains[:period])
    avg_loss = np.mean(losses[:period])
    rsi[period] = 100 - (100 / (1 + avg_gain / avg_loss if avg_loss != 0 else 100))
    for i in range(period + 1, len(arr)):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        rs = avg_gain / avg_loss if avg_loss != 0 else 100
        rsi[i] = 100 - (100 / (1 + rs))
    return [round(v, 2) if v is not None else None for v in rsi]


def calc_bollinger(series: list, period: int = 20, std_dev: float = 2.0) -> dict:
    """Bandas de Bollinger — média móvel central ± k*desvio."""
    arr = np.array(series, dtype=float)
    upper, middle, lower = [None] * len(arr), [None] * len(arr), [None] * len(arr)
    for i in range(period - 1, len(arr)):
        window = arr[i - period + 1: i + 1]
        m = np.mean(window)
        s = np.std(window, ddof=1)
        upper[i] = round(m + std_dev * s, 4)
        middle[i] = round(m, 4)
        lower[i] = round(m - std_dev * s, 4)
    return {"upper": upper, "middle": middle, "lower": lower}


def calc_vwap(series: list, period: int = 50) -> list:
    """VWAP simplificado — média móvel do preço."""
    arr = np.array(series, dtype=float)
    vwap = [None] * len(arr)
    if len(arr) < period:
        return vwap
    cum = np.cumsum(arr)
    for i in range(period - 1, len(arr)):
        vwap[i] = round((cum[i] - (cum[i - period] if i >= period else 0)) / period, 4)
    return vwap


def calc_macd(series: list, fast: int = 12, slow: int = 26, signal_period: int = 9) -> dict:
    """MACD — EMA rápida - EMA lenta, com linha de sinal."""
    arr = np.array(series, dtype=float)

    def emma(data, span):
        out = np.full_like(data, np.nan)
        if len(data) < span:
            return out
        alpha = 2 / (span + 1)
        out[span - 1] = np.mean(data[:span])
        for i in range(span, len(data)):
            out[i] = (data[i] - out[i - 1]) * alpha + out[i - 1]
        return out

    ema_fast = emma(arr, fast)
    ema_slow = emma(arr, slow)

    macd_line = []
    for f, s in zip(ema_fast, ema_slow):
        if not np.isnan(f) and not np.isnan(s):
            macd_line.append(round(f - s, 4))
        else:
            macd_line.append(None)

    # signal = EMA de 9 períodos da MACD line
    macd_clean = np.array([v if v is not None else 0 for v in macd_line])
    signal = [None] * len(macd_line)
    if len(macd_clean) >= signal_period:
        alpha_s = 2 / (signal_period + 1)
        idx = next((i for i, v in enumerate(macd_line) if v is not None), None)
        if idx is not None:
            signal[idx + signal_period - 1] = round(np.mean(macd_clean[idx: idx + signal_period]), 4)
            for i in range(idx + signal_period, len(macd_line)):
                signal[i] = round(
                    (macd_clean[i] - signal[i - 1]) * alpha_s + signal[i - 1], 4
                )

    histogram = []
    for m, s in zip(macd_line, signal):
        if m is not None and s is not None:
            histogram.append(round(m - s, 4))
        else:
            histogram.append(None)

    return {"macd": macd_line, "signal": signal, "histogram": histogram}


def detect_crossovers(series: list, rsi: list, vwap: list, bands: dict) -> list:
    """Detecta cruzamentos: RSI sobrecomprado/sobrevendido, preço x VWAP, bands."""
    events = []
    for i in range(1, len(series)):
        if rsi[i] is None or rsi[i - 1] is None:
            continue
        # RSI cruzou pra cima de 30 (sobrevendido → compra)
        if rsi[i - 1] < 30 <= rsi[i]:
            events.append({
                "indice": i, "tipo": "rsi_cross_up",
                "mensagem": f"RSI cruzou acima de 30 ({rsi[i - 1]} → {rsi[i]})",
                "direcao": "alta"
            })
        # RSI cruzou pra baixo de 70 (sobrecomprado → venda)
        if rsi[i - 1] > 70 >= rsi[i]:
            events.append({
                "indice": i, "tipo": "rsi_cross_down",
                "mensagem": f"RSI cruzou abaixo de 70 ({rsi[i - 1]} → {rsi[i]})",
                "direcao": "baixa"
            })
        # Preço cruzou acima da VWAP
        if vwap[i] is not None and vwap[i - 1] is not None:
            if series[i - 1] < vwap[i - 1] and series[i] >= vwap[i]:
                events.append({
                    "indice": i, "tipo": "vwap_cross_up",
                    "mensagem": f"Preço cruzou acima da VWAP ({series[i - 1]:.2f} → {series[i]:.2f})",
                    "direcao": "alta"
                })
            if series[i - 1] > vwap[i - 1] and series[i] <= vwap[i]:
                events.append({
                    "indice": i, "tipo": "vwap_cross_down",
                    "mensagem": f"Preço cruzou abaixo da VWAP ({series[i - 1]:.2f} → {series[i]:.2f})",
                    "direcao": "baixa"
                })
        # Preço tocou banda inferior (sobrevendido)
        if bands["lower"][i] is not None and abs(series[i] - bands["lower"][i]) < 0.01:
            events.append({
                "indice": i, "tipo": "bb_lower_touch",
                "mensagem": f"Preço tocou banda inferior de Bollinger ({series[i]:.2f})",
                "direcao": "alta"
            })
        # Preço tocou banda superior (sobrecomprado)
        if bands["upper"][i] is not None and abs(series[i] - bands["upper"][i]) < 0.01:
            events.append({
                "indice": i, "tipo": "bb_upper_touch",
                "mensagem": f"Preço tocou banda superior de Bollinger ({series[i]:.2f})",
                "direcao": "baixa"
            })
    return events


# ─── Busca dados ─────────────────────────────────────────────────────────

def fetch_darkodds(liga: str = "copa") -> dict:
    """Busca dados da DarkOdds API."""
    url = f"{DARKODDS_URL}/api/live?liga={liga}"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()


# ─── Detecção de Sinais ──────────────────────────────────────────────────

def detect_signals(data: dict, liga: str) -> list:
    """Analisa todas as séries e retorna sinais detectados."""
    series = data.get("series", {})
    power = data.get("power", {})
    signals = []

    # Mapear mercados: nome_serie → {rotulo, odd_original, tipo}
    mercados = {
        "over25":  {"rotulo": "Over 2.5",  "big_odd": 2.50},
        "under25": None,  # under não está nas séries, calculamos
        "over15":  {"rotulo": "Over 1.5",  "big_odd": 1.80},
        "over35":  {"rotulo": "Over 3.5",  "big_odd": 3.50},
        "over05":  {"rotulo": "Over 0.5",  "big_odd": 1.20},
        "btts_yes": {"rotulo": "BTTS Sim", "big_odd": 2.00},
        "home_odd": {"rotulo": "Casa",     "big_odd": 2.50},
        "draw_odd": {"rotulo": "Empate",   "big_odd": 3.00},
        "away_odd": {"rotulo": "Fora",     "big_odd": 2.50},
    }

    for chave, config in mercados.items():
        if config is None:
            continue
        valores = series.get(chave, [])
        if len(valores) < 30:
            continue

        # Calcular indicadores
        rsi = calc_rsi(valores, 14)
        rsi7 = calc_rsi(valores, 7)       # RSI curto para sensibilidade extra
        bands = calc_bollinger(valores, 20, 2.0)
        vwap = calc_vwap(valores, 50)
        macd = calc_macd(valores, 12, 26, 9)
        crossovers = detect_crossovers(valores, rsi, vwap, bands)

        # Últimos valores
        ultimo = valores[-1]
        ultimo_rsi = rsi[-1]
        ultimo_vwap = vwap[-1]
        ultimo_band = {
            "upper": bands["upper"][-1],
            "middle": bands["middle"][-1],
            "lower": bands["lower"][-1],
        }
        ultimo_macd = {
            "macd": macd["macd"][-1],
            "signal": macd["signal"][-1],
            "histogram": macd["histogram"][-1],
        }

        # Converter normalized back to original odd
        # normalized = 5 * 1/odd → odd = 5 / normalized
        odd_atual = round(5 / ultimo, 2) if ultimo > 0 else 0

        # ─── BIG ODDS PATTERNS ───
        # Over 2.5: odd > 2.50 + RSI < 30 → COMPRA OVER
        # (tenta RSI14 primeiro, depois RSI7 como fallback)
        big_odds_rsi = ultimo_rsi if (ultimo_rsi is not None and ultimo_rsi < 30) else (rsi7[-1] if rsi7[-1] is not None and rsi7[-1] < 30 else None)
        if chave == "over25" and odd_atual > 2.50 and big_odds_rsi is not None:
            signals.append({
                "liga": liga,
                "mercado": "Over 2.5",
                "tipo": "big_odds_over",
                "odd": odd_atual,
                "rsi": big_odds_rsi,
                "rsi14": ultimo_rsi,
                "rsi7": rsi7[-1],
                "preco_vs_vwap": "abaixo" if ultimo_vwap and ultimo < ultimo_vwap else "acima",
                "banda": "inferior" if ultimo_band["lower"] and abs(ultimo - ultimo_band["lower"]) < 0.05 else "neutra",
                "direcao": "OVER",
                "confianca_base": 75,
                "macd_hist": ultimo_macd["histogram"],
                "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
            })

        # Under 2.5: Under odd > 2.50 + RSI > 70 → VENDA UNDER
        big_odds_rsi_under = ultimo_rsi if (ultimo_rsi is not None and ultimo_rsi > 70) else (rsi7[-1] if rsi7[-1] is not None and rsi7[-1] > 70 else None)
        if chave == "over25" and big_odds_rsi_under is not None:
            under_odd = round(5 / (5 - ultimo) if ultimo < 5 else 99, 2)
            if under_odd > 2.50:
                signals.append({
                    "liga": liga,
                    "mercado": "Under 2.5",
                    "tipo": "big_odds_under",
                    "odd": under_odd,
                    "rsi": big_odds_rsi_under,
                    "rsi14": ultimo_rsi,
                    "rsi7": rsi7[-1],
                    "preco_vs_vwap": "acima" if ultimo_vwap and ultimo > ultimo_vwap else "abaixo",
                    "banda": "superior" if ultimo_band["upper"] and abs(ultimo - ultimo_band["upper"]) < 0.05 else "neutra",
                    "direcao": "UNDER",
                    "confianca_base": 70,
                    "macd_hist": ultimo_macd["histogram"],
                    "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
                })

        # BTTS Sim: odd > 2.00 + preço acima VWAP → COMPRA
        if chave == "btts_yes":
            if odd_atual > 2.00 and ultimo_vwap and ultimo > ultimo_vwap:
                signals.append({
                    "liga": liga,
                    "mercado": "BTTS Sim",
                    "tipo": "btts_momentum",
                    "odd": odd_atual,
                    "rsi": ultimo_rsi,
                    "rsi14": ultimo_rsi,
                    "rsi7": rsi7[-1],
                    "preco_vs_vwap": "acima",
                    "banda": "superior" if ultimo_band["upper"] and abs(ultimo - ultimo_band["upper"]) < 0.05 else "neutra",
                    "direcao": "BTTS",
                    "confianca_base": 70,
                    "macd_hist": ultimo_macd["histogram"],
                    "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
                })
            # BTTS Sim: odd > 2.00 + preço abaixo VWAP + tocando banda inferior
            if odd_atual > 2.00 and ultimo_vwap and ultimo < ultimo_vwap and ultimo_band["lower"] and abs(ultimo - ultimo_band["lower"]) < 0.05:
                signals.append({
                    "liga": liga,
                    "mercado": "BTTS Sim",
                    "tipo": "btts_reversal",
                    "odd": odd_atual,
                    "rsi": ultimo_rsi,
                    "rsi14": ultimo_rsi,
                    "rsi7": rsi7[-1],
                    "preco_vs_vwap": "abaixo",
                    "banda": "inferior",
                    "direcao": "BTTS",
                    "confianca_base": 75,
                    "macd_hist": ultimo_macd["histogram"],
                    "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
                })

        # RSI(7) curto + MACD: sensibilidade extra para sinais rápidos
        if chave in ("over25", "btts_yes", "over15", "over35"):
            rsi7_last = rsi7[-1]
            macd_last = ultimo_macd
            if all(v is not None for v in [rsi7_last, macd_last["macd"], macd_last["signal"]]):
                # RSI(7) < 25 (sobrevendido curto) + MACD positivo = reversão
                if rsi7_last < 25 and macd_last["macd"] > macd_last["signal"] and macd_last["histogram"] is not None and macd_last["histogram"] > 0:
                    signals.append({
                        "liga": liga, "mercado": config["rotulo"], "tipo": "rsi7_oversold_macd",
                        "odd": odd_atual, "rsi": rsi7_last, "rsi14": ultimo_rsi, "rsi7": rsi7_last,
                        "preco_vs_vwap": "abaixo" if ultimo_vwap and ultimo < ultimo_vwap else "acima",
                        "banda": "inferior" if ultimo_band["lower"] and abs(ultimo - ultimo_band["lower"]) < 0.05 else "neutra",
                        "direcao": "OVER", "confianca_base": 68,
                        "macd_hist": macd_last["histogram"],
                        "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
                    })
                # RSI(7) > 75 + MACD negativo = sobrecompra
                if rsi7_last > 75 and macd_last["macd"] < macd_last["signal"] and macd_last["histogram"] is not None and macd_last["histogram"] < 0:
                    direcao = "UNDER" if "Over" in config["rotulo"] else "PASS"
                    signals.append({
                        "liga": liga, "mercado": config["rotulo"], "tipo": "rsi7_overbought_macd",
                        "odd": odd_atual, "rsi": rsi7_last, "rsi14": ultimo_rsi, "rsi7": rsi7_last,
                        "preco_vs_vwap": "acima" if ultimo_vwap and ultimo > ultimo_vwap else "abaixo",
                        "banda": "superior" if ultimo_band["upper"] and abs(ultimo - ultimo_band["upper"]) < 0.05 else "neutra",
                        "direcao": direcao, "confianca_base": 65,
                        "macd_hist": macd_last["histogram"],
                        "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
                    })

        # Over 1.5: RSI < 25 (sobrevendido extremo) + odd > 1.80
        if chave == "over15" and odd_atual > 1.80 and ultimo_rsi is not None and ultimo_rsi < 25:
            signals.append({
                "liga": liga,
                "mercado": "Over 1.5",
                "tipo": "oversold_extreme",
                "odd": odd_atual,
                "rsi": ultimo_rsi,
                "rsi14": ultimo_rsi,
                "rsi7": rsi7[-1],
                "preco_vs_vwap": "abaixo" if ultimo_vwap and ultimo < ultimo_vwap else "acima",
                "banda": "inferior" if ultimo_band["lower"] and abs(ultimo - ultimo_band["lower"]) < 0.05 else "neutra",
                "direcao": "OVER",
                "confianca_base": 65,
                "macd_hist": ultimo_macd["histogram"],
                "cruzamentos": [c for c in crossovers if c["indice"] >= len(valores) - 5],
            })

    return signals


# ─── DeepSeek ─────────────────────────────────────────────────────────────

def consultar_deepseek(sinal: dict) -> dict:
    """Envia sinal para DeepSeek e retorna recomendação."""
    rsi14 = sinal.get('rsi14', sinal.get('rsi', 'N/A'))
    rsi7 = sinal.get('rsi7', 'N/A')

    prompt = f"""Você é um analista especializado em futebol virtual Bet365.

### Dados do Sinal
- Liga: {sinal['liga']}
- Mercado: {sinal['mercado']}
- Odd atual: {sinal['odd']}
- Direção sugerida: {sinal['direcao']}
- RSI (14): {rsi14}
- RSI (7): {rsi7}
- Preço vs VWAP: {sinal['preco_vs_vwap']}
- Banda de Bollinger: {sinal['banda']}
- Histograma MACD: {sinal['macd_hist']}
- Confiança base: {sinal['confianca_base']}%

### Padrão Detectado: {sinal['tipo']}

### Instruções
Analise se este é um bom momento para apostar R$ 9,90 neste mercado.
Considere: (1) o RSI indica extremo? (2) o preço está do lado correto da VWAP? (3) as bandas de Bollinger confirmam?

Responda APENAS com um JSON válido neste formato exato:
{{
  "deve_apostar": true,
  "confianca": 0-100,
  "justificativa": "texto de 1-2 frases explicando a decisão",
  "odd_estimada": {sinal['odd']},
  "valor_sugerido": 9.90,
  "direcao": "{sinal['direcao']}"
}}"""

    try:
        resp = requests.post(
            DEEPSEEK_URL,
            headers={
                "Authorization": f"Bearer {DEEPSEEK_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 300,
            },
            timeout=15,
        )
        resp.raise_for_status()
        body = resp.json()
        content = body["choices"][0]["message"]["content"]

        # Extrair JSON da resposta
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return {"deve_apostar": False, "confianca": 0, "justificativa": "Falha ao parsear resposta da IA", "erro": content[:200]}
    except Exception as e:
        return {"deve_apostar": False, "confianca": 0, "justificativa": f"Erro na consulta: {str(e)}", "erro": str(e)}


# ─── Main ─────────────────────────────────────────────────────────────────

def analisar(liga: str = "copa", com_deepseek: bool = True) -> dict:
    """Pipeline completa: busca → indicadores → sinais → deepseek."""
    try:
        dados = fetch_darkodds(liga)
    except Exception as e:
        return {"erro": f"Falha ao buscar dados da DarkOdds: {e}"}

    sinais = detect_signals(dados, liga)

    # Se não achou sinais com regras, retorna vazio
    if not sinais:
        return {
            "liga": liga,
            "status": "sem_sinais",
            "mensagem": "Nenhum padrão de big odds detectado no momento",
            "total_jogos": dados.get("total_jogos", 0),
            "atualizado_em": datetime.now().isoformat(),
            "sinais": [],
        }

    # Consultar DeepSeek para cada sinal
    resultados = []
    for sinal in sinais:
        if com_deepseek:
            decisao = consultar_deepseek(sinal)
        else:
            decisao = {
                "deve_apostar": sinal["confianca_base"] >= 70,
                "confianca": sinal["confianca_base"],
                "justificativa": f"Sinal {sinal['tipo']} detectado por regras técnicas",
                "odd_estimada": sinal["odd"],
                "valor_sugerido": BET_AMOUNT,
                "direcao": sinal["direcao"],
            }

        resultados.append({
            "liga": sinal["liga"],
            "mercado": sinal["mercado"],
            "odd": sinal["odd"],
            "direcao": sinal["direcao"],
            "rsi": sinal["rsi"],
            "rsi14": sinal.get("rsi14"),
            "rsi7": sinal.get("rsi7"),
            "preco_vs_vwap": sinal["preco_vs_vwap"],
            "banda": sinal["banda"],
            "macd_hist": sinal["macd_hist"],
            "cruzamentos": sinal["cruzamentos"],
            "tipo": sinal["tipo"],
            "decisao": decisao,
        })

    return {
        "liga": liga,
        "status": "sinais_encontrados",
        "total_jogos": dados.get("total_jogos", 0),
        "total_sinais": len(resultados),
        "atualizado_em": datetime.now().isoformat(),
        "power": dados.get("power"),
        "sinais": resultados,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analista Técnico DeepSeek — Caramelo Goals")
    parser.add_argument("--liga", default="copa", help="Liga para analisar (copa, euro, super, premier)")
    parser.add_argument("--no-deepseek", action="store_true", help="Pular consulta DeepSeek (usar só regras)")
    parser.add_argument("--output", default=None, help="Arquivo de saída JSON")
    args = parser.parse_args()

    resultado = analisar(args.liga, com_deepseek=not args.no_deepseek)
    saida = json.dumps(resultado, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w") as f:
            f.write(saida)
        print(f"✅ Relatório salvo em {args.output}")
    else:
        print(saida)
