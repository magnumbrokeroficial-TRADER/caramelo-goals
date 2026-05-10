export default function MosaicTiles({ tiles }: { tiles: any[] }) {
  return (
    <div className="border-t border-[#1f1f1f] p-4">
      <h3 className="text-xs text-gray-500 mb-2">📊 MOSAICO DE INDICADORES</h3>
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
    </div>
  );
}
