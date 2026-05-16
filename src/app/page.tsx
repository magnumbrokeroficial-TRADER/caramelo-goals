'use client';

import { useState, useEffect } from 'react';
import Dashboard from '@/components/dashboard/Dashboard';
import AnalystPanel from '@/components/analyst/AnalystPanel';

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'analyst'>('analyst');

  return (
    <div className="relative">
      {/* Toggle view */}
      <div className="fixed top-3 right-4 z-50 flex gap-1 bg-[#1f1f1f] rounded-lg p-1 text-xs">
        <button
          onClick={() => setView('analyst')}
          className={`px-3 py-1.5 rounded-md transition ${view === 'analyst' ? 'bg-amber-500 text-black font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          Analista
        </button>
        <button
          onClick={() => setView('dashboard')}
          className={`px-3 py-1.5 rounded-md transition ${view === 'dashboard' ? 'bg-amber-500 text-black font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          Dashboard
        </button>
      </div>

      {view === 'analyst' ? <AnalystPanel /> : <Dashboard />}
    </div>
  );
}
