import { DetectorState } from '@/types/detector';

interface AnalystSignal {
  liga: string;
  mercado: string;
  odd: number;
  direcao: string;
  rsi: number | null;
  rsi14: number | null;
  rsi7: number | null;
  preco_vs_vwap: string;
  banda: string;
  macd_hist: number | null;
  tipo: string;
  cruzamentos: any[];
  decisao: {
    deve_apostar: boolean;
    confianca: number;
    justificativa: string;
    odd_estimada: number;
    valor_sugerido: number;
    direcao: string;
  };
}

interface AnalystResult {
  liga: string;
  status: string;
  mensagem?: string;
  total_jogos: number;
  total_sinais?: number;
  atualizado_em: string;
  power?: {
    total_matches?: number;
    avg_home_goals?: number;
    avg_away_goals?: number;
    avg_total_goals?: number;
    league_lambda?: number;
    btts_baseline?: number;
  };
  sinais: AnalystSignal[];
}
