'use client';

import { fmtInt } from './_fmt';
import type { Summary, Goals as GoalsType } from '@/types';

type Props = {
  summary: Summary | null;
  goals: GoalsType;
};

export default function Goals({ summary, goals }: Props) {
  const spendFiat = summary?.spendFiat ?? 0;
  const totalSatoshi = summary?.totalSatoshi ?? 0;
  const progressFiat = summary?.progressFiat ?? 0;
  const progressBTC = summary?.progressBTC ?? 0;
  const btcFromSat = goals.goal_satoshi / 1e8;

  return (
    <div className="goals">
      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Fiat Invested</h3>
          <div className="pct">{progressFiat.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill" style={{ width: Math.min(100, progressFiat) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>฿{fmtInt(spendFiat)}</span>
          <span>Goal · ฿{fmtInt(goals.goal_fiat)}</span>
        </div>
      </div>
      <div className="goal-card">
        <div className="goal-top">
          <h3>Goal · Total Satoshi</h3>
          <div className="pct">{progressBTC.toFixed(2)}%</div>
        </div>
        <div className="goal-bar">
          <div className="goal-fill alt" style={{ width: Math.min(100, progressBTC) + '%' }} />
        </div>
        <div className="goal-ticks">
          <span>{fmtInt(totalSatoshi)} sat</span>
          <span>Goal · {fmtInt(goals.goal_satoshi)} sat ({btcFromSat.toFixed(2)} ₿)</span>
        </div>
      </div>
    </div>
  );
}
