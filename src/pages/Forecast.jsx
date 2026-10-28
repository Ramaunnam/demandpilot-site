import React, { useMemo, useState } from 'react'
import { HIST, AHEAD, SIGNALS, wk } from '../data.js'
import { sum, mean, fmtT, fmtPct } from '../engine.js'
import { useApp, Head, Tile, Card, Seg, Info, Pill } from '../ui.jsx'
import { TimeChart, Legend } from '../charts.jsx'

export default function Forecast() {
  const { plan, go } = useApp()
  const families = [...new Set(plan.products.map(p => p.family))]
  const [fam, setFam] = useState('All')
  const [pid, setPid] = useState('All')
  const [range, setRange] = useState(52)
  const inFam = plan.products.filter(p => fam === 'All' || p.family === fam)
  const sel = pid === 'All' ? inFam : inFam.filter(p => p.id === pid)
  const label = pid !== 'All' ? sel[0]?.name : fam !== 'All' ? `${fam} (${sel.length} products)` : `All products (${sel.length})`

  const agg = useMemo(() => {
    const hist = new Array(HIST).fill(0).map((_, t) => sum(sel.map(p => p.hist[t])))
    const fc = new Array(AHEAD).fill(0).map((_, k) => sum(sel.map(p => p.fc[k])))
    const lo = new Array(AHEAD).fill(0).map((_, k) => sum(sel.map(p => p.lo[k])))
    const hi = new Array(AHEAD).fill(0).map((_, k) => sum(sel.map(p => p.hi[k])))
    const old = mean(hist.slice(HIST - 12))
    const err = sum(sel.map(p => p.err)), errOld = sum(sel.map(p => p.errOld)), tot = sum(sel.map(p => p.tot))
    return { hist, fc, lo, hi, old, acc: 1 - err / tot, accOld: 1 - errOld / tot, err, errOld, tot }
  }, [sel])

  const data = []
  for (let t = HIST - range; t < HIST + AHEAD; t++) {
    if (t < HIST) data.push({ x: t, actual: agg.hist[t], ly: null })
    else { const k = t - HIST; data.push({ x: t, fc: agg.fc[k], lo: agg.lo[k], hi: agg.hi[k], old: agg.old, ly: agg.hist[t - 52] }) }
  }
  const last = data[range - 1]; last.fc = last.actual; last.lo = last.actual; last.hi = last.actual; last.old = last.actual

  const n4 = sum(agg.fc.slice(0, 4)), ly4 = sum(agg.hist.slice(HIST - 52, HIST - 48))
  const n12 = sum(agg.fc), ly12 = sum(agg.hist.slice(HIST - 52, HIST - 40))
  const w = (f) => sum(sel.map(p => f(p) * p.weekly)) / Math.max(1, sum(sel.map(p => p.weekly)))
  const drivers = [
    { k: 'Time of year', v: w(p => p.drivers.season) * 100, s: 'Usual seasonal pattern for these weeks' },
    { k: 'Long-term growth', v: w(p => p.drivers.trend) * 100, s: 'Underlying change per year' },
    { k: 'Market news', v: w(p => p.drivers.news), s: 'News not yet seen in sales' },
  ]
  const newsIds = [...new Set(sel.flatMap(p => p.drivers.newsIds))]
  const changes = plan.changes.filter(c => c.items.some(i => sel.some(p => p.id === i.productId)))
  const ex = {
    n4: { title: 'Expected sales, next 4 weeks', value: fmtT(n4), means: `Forecast for ${label}, next 4 weeks.`, formula: 'Sum of the weekly forecasts', worked: `${agg.fc.slice(0, 4).map(v => fmtT(v)).join(' + ')} = ${fmtT(n4)}`, inputs: [{ k: 'Same 4 weeks last year', v: fmtT(ly4) }, { k: 'Change', v: fmtPct((n4 / ly4 - 1) * 100, 1) }] },
    n12: { title: 'Expected sales, next 12 weeks', value: fmtT(n12), means: `Forecast for ${label}, next 12 weeks.`, formula: 'Sum of the 12 weekly forecasts', worked: `${agg.fc.map(v => Math.round(v)).join(' + ')} = ${fmtT(n12)}`, inputs: [{ k: 'Same 12 weeks last year', v: fmtT(ly12) }] },
    acc: { title: 'Forecast accuracy', value: `${(agg.acc * 100).toFixed(1)}%`, means: 'How close the forecast was to real sales over the last 12 weeks, for this selection.', formula: '100% − (total miss ÷ total sales)', worked: `100% − (${fmtT(agg.err)} ÷ ${fmtT(agg.tot)}) = ${(agg.acc * 100).toFixed(1)}%`, inputs: [{ k: 'Old way (12-week average)', v: `${(agg.accOld * 100).toFixed(1)}%` }] },
  }

  return (
    <>
      <Head title="Forecast" sub="What customers are expected to buy from the factory, for all products, a product group or one product." />
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="filters">
          <label htmlFor="f-fam">Product group</label>
          <select id="f-fam" className="sel" value={fam} onChange={e => { setFam(e.target.value); setPid('All') }}>
            <option value="All">All products</option>{families.map(f => <option key={f}>{f}</option>)}
          </select>
          <label htmlFor="f-prod">Product</label>
          <select id="f-prod" className="sel" value={pid} onChange={e => setPid(e.target.value)}>
            <option value="All">{fam === 'All' ? 'All products' : `All ${fam}`}</option>{inFam.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{ marginLeft: 'auto' }}><Seg value={range} onChange={setRange} options={[{ v: 26, l: '6 months' }, { v: 52, l: '1 year' }, { v: 102, l: '2 years' }]} /></span>
        </div>
      </div>

      <div className="grid g4">
        <Tile k="Next 4 weeks" v={fmtT(n4)} e={ex.n4} d={<><span className={n4 >= ly4 ? 'up' : 'down'}>{fmtPct((n4 / ly4 - 1) * 100, 1)}</span> vs same weeks last year</>} />
        <Tile k="Next 12 weeks" v={fmtT(n12)} e={ex.n12} d={`about ${fmtT(n12 / 12)} a week`} />
        <Tile k="Forecast accuracy" v={`${(agg.acc * 100).toFixed(1)}%`} e={ex.acc} tone="green" d={`old way: ${(agg.accOld * 100).toFixed(1)}%`} />
        <Tile k="Sales changes" v={`${changes.length}`} d={changes.length ? changes.map(c => c.headline.split(' across')[0] + ' · ' + c.region).join('; ') : 'none in this selection'} onClick={changes.length ? () => go('changes') : undefined} />
      </div>

      <Card title={label} sub="Tonnes per week · past sales, then forecast with its likely range">
        <TimeChart data={data} today={HIST} height={300} series={[
          { key: 'band', kind: 'band', lo: 'lo', hi: 'hi', color: 'var(--teal)', label: 'Likely range' },
          { key: 'actual', kind: 'area', color: 'var(--ink-2)', label: 'Actual sales', width: 1.8 },
          { key: 'ly', kind: 'line', color: 'var(--ink-3)', dash: '2 3', label: 'Same week last year', width: 1.2 },
          { key: 'old', kind: 'line', color: 'var(--urgent)', dash: '5 4', label: 'Old way (12-wk average)', width: 1.5 },
          { key: 'fc', kind: 'line', color: 'var(--teal)', label: 'Forecast', width: 2.8 },
        ]} />
        <div style={{ marginTop: 10 }}><Legend items={[{ label: 'Actual sales', color: 'var(--ink-2)' }, { label: 'Forecast', color: 'var(--teal)' }, { label: 'Likely range (8 in 10)', color: 'var(--teal)' }, { label: 'Same week last year', color: 'var(--ink-3)' }, { label: 'Old way: 12-week average', color: 'var(--urgent)' }]} /></div>
      </Card>

      <div className="grid g-side">
        <Card title="Week by week" sub={`${sel.length} product${sel.length > 1 ? 's' : ''} · click a product to open it`} pad={false}>
          <div className="tbl-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table className="tbl">
              <thead><tr><th scope="col">Product</th>{[0, 1, 2, 3, 4, 5].map(k => <th scope="col" key={k} className="r">{wk(HIST + k)}</th>)}<th scope="col" className="r">12 weeks</th><th scope="col" className="r">vs last yr</th></tr></thead>
              <tbody>
                {sel.length > 1 && <tr style={{ background: 'var(--surface-2)' }}><td className="nm">Total</td>{[0, 1, 2, 3, 4, 5].map(k => <td key={k} className="r num"><b>{fmtT(agg.fc[k])}</b></td>)}<td className="r num"><b>{fmtT(n12)}</b></td><td className={`r num ${n12 >= ly12 ? 'up' : 'down'}`}>{fmtPct((n12 / ly12 - 1) * 100)}</td></tr>}
                {[...sel].sort((a, b) => b.next12 - a.next12).map(p => { const ly = sum(p.hist.slice(HIST - 52, HIST - 40)); return (
                  <tr key={p.id} className="click" onClick={() => go('product', p.id)}>
                    <td className="nm">{p.name}<small>{p.use}</small></td>
                    {[0, 1, 2, 3, 4, 5].map(k => <td key={k} className="r num">{fmtT(p.fc[k])}</td>)}
                    <td className="r num"><b>{fmtT(p.next12)}</b></td>
                    <td className={`r num ${p.next12 >= ly ? 'up' : 'down'}`}>{fmtPct((p.next12 / ly - 1) * 100)}</td>
                  </tr>) })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="What drives this forecast" sub="Effect on weekly sales, in plain words">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drivers.map(d => (
              <div key={d.k} className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span><b>{d.k}</b><br /><span className="note">{d.s}</span></span>
                <span className={`num ${d.v >= 0 ? 'up' : 'down'}`}>{fmtPct(d.v, 1)}</span>
              </div>
            ))}
            {newsIds.length > 0 && <div className="note">News used: {newsIds.map(id => SIGNALS.find(s => s.id === id)?.title).join('; ')}.</div>}
            {changes.map(c => (
              <button key={c.id} className="card" style={{ padding: 10, textAlign: 'left', border: '1px solid var(--line)' }} onClick={() => go('changes', c.id)}>
                <div className="row"><Pill u="Watch">Sales change</Pill><b>{c.title}</b></div>
                <div className="note" style={{ marginTop: 4 }}>{c.headline} since {wk(c.start)}. {c.status === 'open' ? 'Waiting for your decision.' : c.status === 'real' ? 'Accepted as real: the forecast follows the new level.' : c.status === 'oneoff' ? 'Treated as one-off.' : 'Being checked with sales.'}</div>
              </button>
            ))}
            <p className="note">The forecast learns from 2 years of weekly sales (level, growth and time of year), then adds market news that sales have not shown yet.</p>
          </div>
        </Card>
      </div>
    </>
  )
}
