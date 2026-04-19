'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { EnrichedEntry } from '@/types';

type Mode = 'portfolio' | 'pnl' | 'cost';
type Timeframe = '7D' | '30D' | 'ALL';

type ChartProps = {
  records: EnrichedEntry[];
  mode: Mode;
  timeframe: Timeframe;
};

function formatTHB(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function formatTHBFull(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function Chart({ records, mode, timeframe }: ChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 280 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    if (timeframe === '7D') return records.slice(-7);
    if (timeframe === '30D') return records.slice(-30);
    return records;
  }, [records, timeframe]);

  const { w, h } = dims;
  const padL = 52, padR = 16, padT = 20, padB = 28;
  const cw = Math.max(0, w - padL - padR);
  const ch = Math.max(0, h - padT - padB);

  // Series definitions per mode
  const series = useMemo(() => {
    if (mode === 'portfolio') {
      return [
        { key: 'portfolio', label: 'Portfolio Value', color: 'var(--accent)', fill: 'var(--accent-line)', dash: undefined, zero: false, values: data.map((d) => d.portfolioValue) },
        { key: 'invested', label: 'Invested', color: 'var(--fg-2)', dash: '4 4', fill: undefined, zero: false, values: data.map((d) => d.invested) },
      ];
    }
    if (mode === 'pnl') {
      return [
        { key: 'unrealized', label: 'Unrealized PNL', color: 'var(--accent)', fill: 'var(--accent-line)', dash: undefined, zero: true, values: data.map((d) => d.unrealized) },
      ];
    }
    // cost
    return [
      { key: 'market', label: 'Market Price', color: 'var(--accent)', fill: undefined, dash: undefined, zero: false, values: data.map((d) => d.price_thb) },
      {
        key: 'cost', label: 'Avg Cost Basis', color: 'var(--fg-2)', dash: '4 4', fill: undefined, zero: false, values: data.map((_d, i) => {
          const slice = data.slice(0, i + 1);
          const totalSat = slice.reduce((s, r) => s + r.satoshi, 0);
          const totalFiat = slice.reduce((s, r) => s + r.fiat_thb, 0);
          // cost basis in THB/BTC terms = totalFiat / (totalSat/1e8)
          return totalFiat / (totalSat / 1e8);
        }),
      },
    ];
  }, [data, mode]);

  const allVals = series.flatMap((s) => s.values);
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (series[0]?.zero) {
    // Always include zero in PNL chart
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  // padding
  const yRange = yMax - yMin || 1;
  yMin -= yRange * 0.06;
  yMax += yRange * 0.06;

  const x = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * cw);
  const y = (v: number) => padT + ch - ((v - yMin) / (yMax - yMin)) * ch;

  // Y grid lines
  const gridLines = 4;
  const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) / gridLines) * i;
    return { v, y: y(v) };
  });

  const zeroY = yMin < 0 && yMax > 0 ? y(0) : null;

  // Build area path
  function buildPath(values: number[], withArea: boolean): string {
    if (values.length === 0) return '';
    let d = `M ${x(0)} ${y(values[0]!)}`;
    for (let i = 1; i < values.length; i++) d += ` L ${x(i)} ${y(values[i]!)}`;
    if (withArea) {
      const baseY = zeroY !== null ? zeroY : padT + ch;
      d += ` L ${x(values.length - 1)} ${baseY} L ${x(0)} ${baseY} Z`;
    }
    return d;
  }

  // X ticks — approx 6 labels
  const xTickCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1 || 1)) * (data.length - 1));
    const entry = data[idx];
    return { idx, x: x(idx), date: entry ? entry.date : undefined };
  });

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (mx < padL) { setHoverIdx(null); return; }
    const rel = (mx - padL) / cw;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1))));
    setHoverIdx(idx);
  }
  function onLeave() { setHoverIdx(null); }

  const hovered = hoverIdx !== null ? (data[hoverIdx] ?? null) : null;

  // Tooltip content per mode
  const tooltipRows: { lbl: string; val: string }[] = [];
  if (hovered) {
    if (mode === 'portfolio') {
      tooltipRows.push(
        { lbl: 'Portfolio', val: formatTHBFull(hovered.portfolioValue) + ' ฿' },
        { lbl: 'Invested', val: formatTHBFull(hovered.invested) + ' ฿' },
        { lbl: 'Unrealized', val: (hovered.unrealized >= 0 ? '+' : '') + formatTHBFull(hovered.unrealized) + ' ฿' },
      );
    } else if (mode === 'pnl') {
      tooltipRows.push(
        { lbl: 'Unrealized', val: (hovered.unrealized >= 0 ? '+' : '') + formatTHBFull(hovered.unrealized) + ' ฿' },
        { lbl: '%', val: hovered.pctUnrealized.toFixed(2) + '%' },
        { lbl: 'Portfolio', val: formatTHBFull(hovered.portfolioValue) + ' ฿' },
      );
    } else {
      const slice = hoverIdx !== null ? data.slice(0, hoverIdx + 1) : [];
      const tSat = slice.reduce((s, r) => s + r.satoshi, 0);
      const tFiat = slice.reduce((s, r) => s + r.fiat_thb, 0);
      const costBasis = tFiat / (tSat / 1e8);
      tooltipRows.push(
        { lbl: 'Market Price', val: formatTHBFull(hovered.price_thb) + ' ฿' },
        { lbl: 'Avg Cost', val: formatTHBFull(costBasis) + ' ฿' },
        { lbl: 'Spread', val: ((hovered.price_thb - costBasis) / costBasis * 100).toFixed(2) + '%' },
      );
    }
  }

  const legend = series.map((s) => (
    <span key={s.key} className="legend-item">
      <span
        className="legend-swatch"
        style={{
          background: s.dash ? 'transparent' : s.color,
          border: s.dash ? `2px dashed ${s.color}` : 'none',
          height: s.dash ? 0 : 10,
        }}
      />
      {s.label}
    </span>
  ));

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {records.length === 0 ? (
        <div className="chart-empty">
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Add your first buy to see chart</span>
        </div>
      ) : (
        <>
          <div className="chart-legend">{legend}</div>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }} onMouseMove={() => {}} onMouseLeave={onLeave}>
            <svg width={w} height={h} style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={onLeave}>
              {/* grid */}
              {grid.map((g, i) => (
                <g key={i}>
                  <line x1={padL} x2={w - padR} y1={g.y} y2={g.y} stroke="var(--divider)" strokeWidth="1" />
                  <text x={padL - 8} y={g.y + 3} textAnchor="end" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                    {formatTHB(g.v)}
                  </text>
                </g>
              ))}
              {/* zero line for pnl */}
              {zeroY !== null && (
                <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
              )}
              {/* x ticks */}
              {xTicks.map((t, i) => (
                <text key={i} x={t.x} y={h - 8} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill="var(--muted)">
                  {t.date ? formatDateShort(new Date(t.date + 'T00:00:00')) : ''}
                </text>
              ))}
              {/* series: area first, then lines */}
              {series.map((s) => s.fill && (
                <path key={s.key + '-area'} d={buildPath(s.values, true)} fill={s.fill} stroke="none" />
              ))}
              {series.map((s) => (
                <path
                  key={s.key + '-line'}
                  d={buildPath(s.values, false)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.75"
                  strokeDasharray={s.dash ?? 'none'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {/* hover crosshair */}
              {hoverIdx !== null && (
                <g>
                  <line
                    x1={x(hoverIdx)} x2={x(hoverIdx)}
                    y1={padT} y2={padT + ch}
                    stroke="var(--fg)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5"
                  />
                  {series.map((s) => (
                    <circle
                      key={s.key + '-dot'}
                      cx={x(hoverIdx)} cy={y(s.values[hoverIdx] ?? 0)}
                      r="4" fill="var(--surface)"
                      stroke={s.color} strokeWidth="2"
                    />
                  ))}
                </g>
              )}
            </svg>
            {hovered && hoverIdx !== null && (
              <div
                className="tooltip visible"
                style={{ left: x(hoverIdx), top: 0 }}
              >
                <div className="t-date">{formatDate(new Date(hovered.date + 'T00:00:00'))} · Day {hovered.dayActive}</div>
                {tooltipRows.map((r, i) => (
                  <div className="t-row" key={i}>
                    <span className="t-lbl">{r.lbl}</span>
                    <span>{r.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Chart;
