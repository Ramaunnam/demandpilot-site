import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtNum } from './engine.js';
import { wk } from './data.js';
const fmtQty = (v) => fmtNum(v, Math.abs(v) < 10 && v % 1 ? 1 : 0);
const weekLabel = wk;

// Measuring needs to happen before paint in a browser, and cannot happen at all without one.
const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect


export function useWidth(init = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(init);
  // Measure before the browser paints, so the chart is drawn at the right width once
  // instead of being drawn wrong and then corrected.
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.clientWidth;
    if (first > 0) setW(first);
    const ro = new ResizeObserver((e) => { const cw = e[0].contentRect.width; if (cw > 0) setW(cw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min, max, count = 4) {
  const span = (max - min) || 1;
  const s0 = span / count; const mag = 10 ** Math.floor(Math.log10(s0)); const e = s0 / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const t0 = Math.floor(min / step) * step; const t1 = Math.ceil(max / step) * step;
  const ticks = []; for (let v = t0; v <= t1 + step / 2; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

function linePath(pts) {
  let d = ''; let pen = false;
  for (const p of pts) {
    if (p == null) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true;
  }
  return d;
}

// Time series chart: lines, areas, forecast bands, bars, reference lines, markers, hover tooltip.
export const TimeChart = memo(function TimeChart({
  data, series, height = 260, today, refs = [], markers = [], fmtY = fmtQty, xFmt = weekLabel,
  unit = 't', onPick, selected, todayLabel = 'FORECAST →', label,
}) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const m = { l: 46, r: 14, t: 14, b: 26 };
  const W = Math.max(240, w), H = height;
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const N = data.length;
  const bars = series.filter((s) => s.kind === 'bar');
  const hasBar = bars.length > 0;
  const step = iw / (hasBar ? N : Math.max(1, N - 1));
  const X = (i) => m.l + (hasBar ? step * (i + 0.5) : step * i);
  const vals = [];
  for (const d of data) for (const s of series) {
    if (s.kind === 'band') { vals.push(d[s.lo], d[s.hi]); } else vals.push(d[s.key]);
  }
  refs.forEach((r) => vals.push(r.y));
  const fin = vals.filter((v) => v != null && Number.isFinite(v));
  const ticks = niceTicks(Math.min(0, ...fin), Math.max(1, ...fin), 4);
  const t0 = ticks[0], t1 = ticks[ticks.length - 1];
  const Y = (v) => m.t + ih - ((v - t0) / (t1 - t0)) * ih;
  const every = Math.max(1, Math.ceil(N / Math.max(2, iw / 74)));
  const todayIdx = today != null ? data.findIndex((d) => d.x === today) : -1;

  const at = useCallback((clientX, el) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const i = hasBar ? Math.floor((px - m.l) / step) : Math.round((px - m.l) / step);
    return i >= 0 && i < N ? i : null;
  }, [hasBar, step, N, m.l]);

  const move = (e) => setHover(at(e.clientX, e.currentTarget));
  const touch = (e) => {
    const t = e.touches[0];
    if (!t) return;
    const i = at(t.clientX, e.currentTarget);
    setHover(i);
    if (i != null && onPick) onPick(data[i]);
  };
  const hd = hover != null ? data[hover] : null;

  // Keep the tooltip inside the chart, and put it on the left when the point is on the right.
  const TIP = 168;
  const tipRight = hover != null && X(hover) > W - TIP - 24;
  const tipLeft = hover == null ? 0 : Math.max(0, Math.min(W - TIP, tipRight ? X(hover) - TIP - 12 : X(hover) + 12));

  return (
    <div className="chart" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} onMouseMove={move} onMouseLeave={() => setHover(null)}
        onTouchStart={touch} onTouchMove={touch} onTouchEnd={() => setHover(null)}
        onClick={() => onPick && hover != null && onPick(data[hover])}
        role="img" aria-label={label || 'Time series chart'} style={{ cursor: onPick ? 'pointer' : 'default', touchAction: 'pan-y' }}>
        <g className="gr">{ticks.map((t) => <line key={t} x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} strokeDasharray={t === 0 ? '' : '2 4'} />)}</g>
        <g className="ax">
          {ticks.map((t) => <text key={t} x={m.l - 8} y={Y(t) + 4} textAnchor="end">{fmtY(t)}</text>)}
          {data.map((d, i) => (i % every === 0 ? <text key={i} x={X(i)} y={H - 6} textAnchor="middle">{xFmt(d.x)}</text> : null))}
        </g>
        {todayIdx >= 0 && (
          <g>
            <rect x={X(todayIdx) - (hasBar ? step / 2 : 0)} y={m.t} width={W - m.r - X(todayIdx) + (hasBar ? step / 2 : 0)} height={ih} fill="var(--teal)" opacity=".05" />
            <line x1={X(todayIdx) - (hasBar ? step / 2 : 0)} x2={X(todayIdx) - (hasBar ? step / 2 : 0)} y1={m.t} y2={m.t + ih} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <text x={X(todayIdx) - (hasBar ? step / 2 : 0) + 6} y={m.t + 11} fill="var(--ink-3)" fontSize="10.5" fontWeight="700" letterSpacing=".08em">{todayLabel}</text>
          </g>
        )}
        {series.filter((s) => s.kind === 'band').map((s) => {
          const up = data.map((d, i) => (d[s.hi] == null ? null : [X(i), Y(d[s.hi])])).filter(Boolean);
          const lo = data.map((d, i) => (d[s.lo] == null ? null : [X(i), Y(d[s.lo])])).filter(Boolean).reverse();
          if (!up.length) return null;
          return <path key={s.key} d={`${linePath(up)}L${lo.map((p) => p.join(',')).join('L')}Z`} fill={s.color} opacity={s.opacity ?? 0.16} />;
        })}
        {series.filter((s) => s.kind === 'area').map((s) => {
          const pts = data.map((d, i) => (d[s.key] == null ? null : [X(i), Y(d[s.key])]));
          const valid = pts.filter(Boolean); if (!valid.length) return null;
          return <path key={s.key + 'a'} d={`${linePath(valid)}L${valid[valid.length - 1][0]},${Y(Math.max(0, t0))}L${valid[0][0]},${Y(Math.max(0, t0))}Z`} fill={s.color} opacity=".12" />;
        })}
        {bars.map((s, bi) => {
          const bw = Math.max(2, (step * 0.68) / bars.length);
          return data.map((d, i) => {
            const v = d[s.key]; if (!v) return null;
            const x = X(i) - (step * 0.68) / 2 + bi * bw;
            const hl = selected != null && d.x === selected;
            const dim = selected != null && !hl;
            return <rect key={s.key + i} x={x} y={Math.min(Y(v), Y(0))} width={bw - 1} height={Math.abs(Y(0) - Y(v))} rx="3"
              fill={dim ? 'var(--line-2)' : s.color} opacity={hover === i && !hl ? 1 : (s.opacity ?? 0.9)} />;
          });
        })}
        {refs.map((r, i) => (
          <g key={i}>
            <line x1={m.l} x2={W - m.r} y1={Y(r.y)} y2={Y(r.y)} stroke={r.color} strokeDasharray={r.dash || '5 4'} strokeWidth="1.5" />
            <text x={W - m.r - 4} y={Y(r.y) - 5} textAnchor="end" fill={r.color} fontSize="11" fontWeight="700">{r.label}</text>
          </g>
        ))}
        {series.filter((s) => s.kind === 'line' || s.kind === 'area').map((s) => (
          <path key={s.key} d={linePath(data.map((d, i) => (d[s.key] == null ? null : [X(i), Y(d[s.key])])))} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash || ''} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {markers.map((mk, i) => {
          const idx = data.findIndex((d) => d.x === mk.x); if (idx < 0) return null;
          return (
            <g key={i}>
              <circle cx={X(idx)} cy={Y(mk.y)} r="7" fill={mk.color} opacity=".18" />
              <circle cx={X(idx)} cy={Y(mk.y)} r="4" fill={mk.color} stroke="var(--surface)" strokeWidth="1.5" />
            </g>
          );
        })}
        {hover != null && hd && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={m.t} y2={m.t + ih} stroke="var(--ink-2)" strokeWidth="1" opacity=".5" />
            {series.filter((s) => (s.kind === 'line' || s.kind === 'area') && hd[s.key] != null).map((s) => <circle key={s.key} cx={X(hover)} cy={Y(hd[s.key])} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />)}
          </g>
        )}
      </svg>
      {hd && (
        <div className="tip" style={{ left: tipLeft, top: 8, width: TIP }}>
          <div className="h">Week of {xFmt(hd.x)}</div>
          {series.filter((s) => s.kind !== 'band' && hd[s.key] != null).map((s) => (
            <div className="r" key={s.key}><span><i className="sw" style={{ background: s.color }} />{s.label}</span><b className="num">{fmtQty(hd[s.key])} {unit}</b></div>
          ))}
          {series.filter((s) => s.kind === 'band' && hd[s.lo] != null).map((s) => (
            <div className="r" key={s.key}><span><i className="sw" style={{ background: s.color, opacity: 0.4 }} />{s.label}</span><b className="num">{fmtQty(hd[s.lo])}–{fmtQty(hd[s.hi])}</b></div>
          ))}
        </div>
      )}
    </div>
  );
});

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => <span key={it.label}><i className={it.kind || ''} style={{ background: it.color, color: it.color }} />{it.label}</span>)}
    </div>
  );
}

export const Spark = memo(function Spark({ values, color = 'var(--teal)', width = 72, height = 26, fill = true, mark, label }) {
  const v = values.filter((x) => x != null);
  if (!v.length) return null;
  const min = Math.min(...v, 0), max = Math.max(...v);
  const span = max - min || 1;
  const pts = values.map((x, i) => [(i / Math.max(1, values.length - 1)) * (width - 4) + 2, height - 3 - ((x - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  const zeroY = height - 3 - ((0 - min) / span) * (height - 6);
  return (
    <svg width={width} height={height} role={label ? 'img' : 'presentation'} aria-label={label} aria-hidden={label ? undefined : 'true'} style={{ display: 'block', overflow: 'visible' }}>
      {fill && <path d={`${d}L${last[0]},${height}L${pts[0][0]},${height}Z`} fill={color} opacity=".12" />}
      {min < 0 && <line x1="0" x2={width} y1={zeroY} y2={zeroY} stroke="var(--urgent)" strokeDasharray="2 2" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {mark != null && pts[mark] && <circle cx={pts[mark][0]} cy={pts[mark][1]} r="3" fill="var(--urgent)" />}
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
});

// A horizontal bar for "this much of that much". Used for line load and stock cover.
export function Meter({ pct, tone = 'var(--teal)', height = 10, over }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="loadbar" style={{ height }} role="img" aria-label={`${Math.round(pct)}%`}>
      <i style={{ width: `${w}%`, background: tone }} />
      {over && <i className="over" style={{ left: `${w}%`, width: `${Math.min(100 - w, over)}%` }} />}
    </div>
  );
}
