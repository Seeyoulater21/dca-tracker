'use client';

import { useEffect, useState } from 'react';
import type { EnrichedEntry, Summary, Goals, Delta24 } from '@/types';
import Topbar from './Topbar';
import SectionLabel from './SectionLabel';
import PnlCard from './PnlCard';

type Accent = { name: string; hex: string; strong: string; soft: string; line: string };

const ACCENTS: Accent[] = [
  { name: 'Bitcoin Orange', hex: '#F2A900', strong: '#E89100', soft: '#FFF4DC', line: 'rgba(242,169,0,0.15)' },
  { name: 'Saffron',        hex: '#E77B1D', strong: '#C86511', soft: '#FCE9D6', line: 'rgba(231,123,29,0.15)' },
  { name: 'Amber',          hex: '#D98F1C', strong: '#B37416', soft: '#FBEBCF', line: 'rgba(217,143,28,0.15)' },
  { name: 'Crimson',        hex: '#C84A3F', strong: '#A33A2F', soft: '#F5DCD8', line: 'rgba(200,74,63,0.15)' },
  { name: 'Forest',         hex: '#2E7D5B', strong: '#24634A', soft: '#D9EBDF', line: 'rgba(46,125,91,0.15)' },
  { name: 'Ink',            hex: '#2B3A66', strong: '#1F2B4D', soft: '#DBE0EE', line: 'rgba(43,58,102,0.15)' },
];

type Props = {
  records: EnrichedEntry[];
  summary: Summary | null;
  delta24: Delta24 | null;
  currentPrice: number;
  priceStale: boolean;
  goals: Goals;
};

export default function Dashboard(props: Props) {
  const [accent, setAccent] = useState<Accent>(ACCENTS[0]!);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('dca.accent') : null;
    if (saved) {
      const found = ACCENTS.find((a) => a.name === saved);
      if (found) setAccent(found);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent.hex);
    root.style.setProperty('--accent-strong', accent.strong);
    root.style.setProperty('--accent-soft', accent.soft);
    root.style.setProperty('--accent-line', accent.line);
    localStorage.setItem('dca.accent', accent.name);
  }, [accent]);

  return (
    <div className="shell">
      <Topbar
        onAdd={() => { /* wired in Task 16 */ }}
        onToggleTweaks={() => { /* wired in Task 17 */ }}
      />

      <SectionLabel num="01" title="Overview"          hint="PNL · chart · hover for daily values" />
      <div className="hero">
        <PnlCard
          summary={props.summary}
          records={props.records}
          delta24={props.delta24}
          priceStale={props.priceStale}
        />
        {/* ChartCard inserted in Task 14 */}
      </div>
      <SectionLabel num="02" title="Metrics & Goals" hint="core numbers · progress" />
      <SectionLabel num="03" title="Buy History"     hint="sortable · searchable · paginated" />

      <pre className="mono" style={{ padding: 20, fontSize: 12 }}>
        {JSON.stringify(
          {
            records: props.records.length,
            summary: props.summary ? 'present' : null,
            delta24: props.delta24,
            currentPrice: props.currentPrice,
            priceStale: props.priceStale,
            goals: props.goals,
            accent: accent.name,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
