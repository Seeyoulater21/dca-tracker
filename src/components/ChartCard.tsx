'use client';
import { useState } from 'react';
import Chart from './Chart';
import type { EnrichedEntry } from '@/types';

type Mode = 'portfolio' | 'pnl' | 'cost';
type Timeframe = '7D' | '30D' | 'ALL';

type Props = { records: EnrichedEntry[] };

export default function ChartCard({ records }: Props) {
  const [mode, setMode] = useState<Mode>('portfolio');
  const [timeframe, setTimeframe] = useState<Timeframe>('ALL');
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div className="chart-tabs">
          <button className={'chart-tab' + (mode === 'portfolio' ? ' active' : '')} onClick={() => setMode('portfolio')}>Portfolio vs Invested</button>
          <button className={'chart-tab' + (mode === 'pnl' ? ' active' : '')} onClick={() => setMode('pnl')}>Unrealized P&amp;L</button>
          <button className={'chart-tab' + (mode === 'cost' ? ' active' : '')} onClick={() => setMode('cost')}>Cost vs Market</button>
        </div>
        <div className="timeframe">
          {(['7D', '30D', 'ALL'] as const).map((t) => (
            <button key={t} className={timeframe === t ? 'active' : ''} onClick={() => setTimeframe(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="chart-body">
        <Chart records={records} mode={mode} timeframe={timeframe} />
      </div>
    </div>
  );
}
