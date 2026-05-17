// lib/virtual.ts
// Busca e parseia dados do /api/virtual em um grid hora x coluna.

import type { Game } from './strategy';

const VIRTUAL_TTL_MS = 15_000; // 15s de cache em memória
let virtualCache: { ts: number; data: any } | null = null;

export function getBaseUrl(req: Request): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function fetchVirtualData(baseUrl: string): Promise<any> {
  const now = Date.now();
  if (virtualCache && now - virtualCache.ts < VIRTUAL_TTL_MS) {
    return virtualCache.data;
  }
  const url = `${baseUrl}/api/virtual`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`/api/virtual retornou ${res.status}`);
  const data = await res.json();
  virtualCache = { ts: now, data };
  return data;
}

/**
 * Converte minuto (1, 4, 7, ..., 58) em coluna (1..20).
 */
export function minuteToColumn(minute: number): number {
  if (minute < 1 || minute > 58) return 0;
  const col = (minute - 1) / 3 + 1;
  return Number.isInteger(col) && col >= 1 && col <= 20 ? col : 0;
}

/**
 * Tenta extrair jogos do payload do /api/virtual.
 * Formato real: { leagues: { copa: { recent_matches: [{ score: "2-1", minuto: "—", ... }] } } }
 * Agrupa matches em blocos de 20 (1 bloco = 1 hora sintética para o motor de estratégia).
 */
export function parseGames(virtualData: any): Game[] {
  const out: Game[] = [];
  const BLOCK = 20;

  const parseScore = (s: string): number => {
    if (!s || s === '—' || s === '-') return 0;
    const p = s.split('-');
    return (parseInt(p[0], 10) || 0) + (parseInt(p[1], 10) || 0);
  };

  const extractFromMatches = (matches: any[]) => {
    if (!Array.isArray(matches)) return;
    const total = matches.length;
    const numBlocks = Math.floor(total / BLOCK);
    for (let b = 0; b < numBlocks; b++) {
      const hour = numBlocks - 1 - b;
      const block = matches.slice(b * BLOCK, (b + 1) * BLOCK);
      for (let c = 0; c < block.length; c++) {
        const m = block[c];
        const goals = typeof m.score === 'string' ? parseScore(m.score) : (num(m.gols ?? m.goals ?? m.score ?? 0));
        out.push({ hour, column: c + 1, minute: c * 3 + 1, goals });
      }
    }
  };

  const leagues = virtualData?.leagues || virtualData?.ligas || {};
  if (typeof leagues === 'object' && !Array.isArray(leagues)) {
    for (const key of Object.keys(leagues)) {
      const liga = leagues[key];
      extractFromMatches(liga.recent_matches || liga.matches || liga.jogos || liga.partidas || []);
    }
  } else if (Array.isArray(leagues)) {
    for (const liga of leagues) {
      extractFromMatches(liga.recent_matches || liga.matches || liga.jogos || liga.partidas || []);
    }
  }

  return out.filter(g => g.column > 0);
}

function num(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseInt(v, 10);
  return NaN;
}

/**
 * Constrói grid: Map<hora, number[20]> onde grid[hora][col-1] = gols.
 */
export function buildGrid(games: Game[]): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  for (const g of games) {
    if (!grid.has(g.hour)) grid.set(g.hour, new Array(20).fill(0));
    grid.get(g.hour)![g.column - 1] = g.goals;
  }
  return grid;
}

/**
 * Retorna horas ordenadas (mais recente primeiro).
 */
export function sortedHoursDesc(grid: Map<number, number[]>): number[] {
  return [...grid.keys()].sort((a, b) => b - a);
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function columnToMinute(col: number): number {
  return (col - 1) * 3 + 1;
}
