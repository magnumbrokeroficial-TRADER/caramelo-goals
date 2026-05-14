export default function MosaicTiles({
  tiles,
  virtualData,
}: {
  tiles: any[];
  virtualData?: any;
}) {
  const leagues = virtualData?.leagues || {};
  const leagueEntries = Object.entries(leagues).filter(
    ([_, v]: [string, any]) => v?.match && !v?.error
  );

  return (
    <div className="border-t border-[#1f1f1f] p-4">
      <h3 className="text-xs text-gray-500 mb-2">📊 MOSAICO DE INDICADORES</h3>

      {leagueEntries.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {leagueEntries.map(([key, data]: [string, any]) => {
            const m = data.match;
            const p = data.prob;
            const o = data.odds;
            return (
              <div key={key} className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">
                  {key === 'copa' ? '🏆' : key === 'euro' ? '🌍' : '🏴'} {key.toUpperCase()}
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {m.timeA} vs {m.timeB}
                </div>
                <div className="text-lg font-bold text-amber-400">{m.resultado}</div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="text-gray-400">{m.minuto}&apos;</span>
                  <span className="text-green-400">O2.5 {p?.over25 || '?'}%</span>
                  <span className="text-yellow-400">BTTS {p?.btts_sim || '?'}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-500">
                  <div>HT: {m.resultadoHt || '-'}</div>
                  <div>FT: {m.resultadoFt || '-'}</div>
                  <div>1º: {m.primeiroMarcar || '-'}</div>
                  <div>Odd O2.5: {o?.over25 || '-'}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Total FT</div>
            <div className="text-lg font-bold text-white">52</div>
            <div className="text-xs text-green-400">+12%</div>
          </div>
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Over 2.5</div>
            <div className="text-lg font-bold text-green-400">SIM</div>
            <div className="text-xs text-gray-500">RSI 55</div>
          </div>
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Ambas Marcam</div>
            <div className="text-lg font-bold text-yellow-400">41%</div>
            <div className="text-xs text-green-400">+3.2% EV</div>
          </div>
          <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">Próx. Rodada</div>
            <div className="text-lg font-bold text-white">00:42</div>
            <div className="text-xs text-gray-500">Copa</div>
          </div>
        </div>
      )}
    </div>
  );
}
