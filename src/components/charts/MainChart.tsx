'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  HistogramSeries,
  Time,
} from 'lightweight-charts';

interface Props {
  dados: { time: Time; value: number }[];
  bandas: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
  mm9: (number | null)[];
  rsi: (number | null)[];
  mom: (number | null)[];
  sinais: any[];
}

export default function MainChart({ dados, bandas, mm9, rsi, mom, sinais }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !macdRef.current) return;
    if (dados.length === 0) return;

    const commonOpts = {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#facc15',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(31,31,31,0.5)' },
        horzLines: { color: 'rgba(31,31,31,0.5)' },
      },
      rightPriceScale: { borderColor: '#1f1f1f' },
      timeScale: { borderColor: '#1f1f1f', timeVisible: true },
    };

    // Chart principal
    const mainChart = createChart(mainRef.current, {
      ...commonOpts,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });
    const goalsSeries = mainChart.addSeries(LineSeries, { color: '#f0f0f0', lineWidth: 2 });
    goalsSeries.setData(dados);

    // Bandas superiores
    if (bandas.upper.length > 0) {
      const upperData = bandas.upper
        .map((v, i) => (v !== null ? { time: dados[i]?.time, value: v } : null))
        .filter(Boolean) as { time: Time; value: number }[];
      if (upperData.length > 0) {
        const upperSeries = mainChart.addSeries(LineSeries, {
          color: 'rgba(38,194,129,0.5)',
          lineWidth: 1,
          lineStyle: 2,
        });
        upperSeries.setData(upperData);
      }

      const lowerData = bandas.lower
        .map((v, i) => (v !== null ? { time: dados[i]?.time, value: v } : null))
        .filter(Boolean) as { time: Time; value: number }[];
      if (lowerData.length > 0) {
        const lowerSeries = mainChart.addSeries(LineSeries, {
          color: 'rgba(239,68,68,0.5)',
          lineWidth: 1,
          lineStyle: 2,
        });
        lowerSeries.setData(lowerData);
      }
    }

    // RSI Chart
    const rsiChart = createChart(rsiRef.current, {
      ...commonOpts,
      width: rsiRef.current.clientWidth,
      height: rsiRef.current.clientHeight,
    });
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 2 });
    const rsiData = rsi
      .map((v, i) => (v !== null ? { time: dados[i]?.time, value: v } : null))
      .filter(Boolean) as { time: Time; value: number }[];
    if (rsiData.length > 0) rsiSeries.setData(rsiData);

    // MACD / Momento
    const macdChart = createChart(macdRef.current, {
      ...commonOpts,
      width: macdRef.current.clientWidth,
      height: macdRef.current.clientHeight,
    });
    const macdSeries = macdChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    const macdData = mom
      .map((v, i) =>
        v !== null
          ? {
              time: dados[i]?.time,
              value: v,
              color: v >= 0 ? 'rgba(38,194,129,0.85)' : 'rgba(239,68,68,0.85)',
            }
          : null
      )
      .filter(Boolean) as any[];
    if (macdData.length > 0) macdSeries.setData(macdData);

    // Resize handler
    const handleResize = () => {
      mainChart.applyOptions({
        width: mainRef.current?.clientWidth ?? 600,
        height: mainRef.current?.clientHeight ?? 300,
      });
      rsiChart.applyOptions({
        width: rsiRef.current?.clientWidth ?? 600,
        height: rsiRef.current?.clientHeight ?? 150,
      });
      macdChart.applyOptions({
        width: macdRef.current?.clientWidth ?? 600,
        height: macdRef.current?.clientHeight ?? 150,
      });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      rsiChart.remove();
      macdChart.remove();
    };
  }, [dados, bandas, mm9, rsi, mom, sinais]);

  return (
    <div className="flex flex-col gap-0">
      <div ref={mainRef} className="h-64 w-full" />
      <div ref={rsiRef} className="h-32 w-full" />
      <div ref={macdRef} className="h-32 w-full" />
    </div>
  );
}
