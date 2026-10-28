import React, { useState } from 'react'
import { HIST, AHEAD, REGIONS, wk, SIGNALS } from '../data.js'
import { sum, fmtT, fmtPct, fmtINR, fmtQty, daysText, whatIf } from '../engine.js'
import { useApp, Head, Card, Fact, Pill, MatPill, Empty, DecisionRow } from '../ui.jsx'
import { TimeChart, Legend } from '../charts.jsx'
import FilesCard from '../FilesCard.jsx'

export function WhatIfBox({ p }) {
  const { plan, go } = useApp()
  const [pct, setPct] = useState(20)
  const r = whatIf(plan, p.id, pct)
  return (
    <div>
      <div className="row between">
        <label htmlFor={`wi-${p.id}`}><b>If sales change by</b></label>
        <b className={`num ${pct >= 0 ? 'up' : 'down'}`} style={{ fontSize: 18 }}>{fmtPct(pct)}</b>
      </div>
      <input id={`wi-${p.id}`} type="range" min={-50} max={100} step={5} value={pct} onChange={e => setPct(+e.target.value)} style={{ width: '100%' }} />
      <div className="facts" style={{ marginTop: 8 }}>
        <Fact k="Sales a week" v={fmtT(r.newWeekly)} s={`now ${fmtT(p.weekly)} (${r.extraWk >= 0 ? '+' : '−'}${fmtT(Math.abs(r.extraWk))})`} />
        <Fact k="Stock lasts" v={daysText(r.newDays)} s={`now ${daysText(r.daysBefore)}`} color={r.stockUrgent ? 'var(--urgent)' : undefined} />
        <Fact k="Extra sales / wk" v={fmtINR(r.sales)} />
        <Fact k="Extra material cost / wk" v={fmtINR(r.matCost)} />
        {p.cold && <Fact k="Cold rolling, busiest week" v={`${Math.round(r.coldPeak)}% full`} color={r.coldPeak > 100 ? 'var(--urgent)' : undefined} s={r.coldPeak > 100 ? 'over capacity' : 'fits'} />}
      </div>
      <div className="tbl-wrap" style={{ marginTop: 8 }}><table className="tbl">
        <thead><tr><th scope="col">Material</th><th scope="col" className="r">Extra a week</th><th scope="col" className="r">Lasts now</th><th scope="col" className="r">Lasts after</th><th scope="col"></th></tr></thead>
        <tbody>{r.mats.slice(0, 6).map(x => (
          <tr key={x.m.id} className="click" onClick={() => go('material', x.m.id)}>
            <td className="nm">{x.m.name}</td><td className="r num">{fmtQty(x.extra, x.m.unit)}</td>
            <td className="r num">{daysText(x.daysBefore)}</td><td className="r num">{daysText(x.daysAfter)}</td>
            <td>{x.runsOutBeforeDelivery
              ? <span className="down">Runs out before delivery</span>
              : <span className="note">Still covered</span>}</td>
          </tr>))}</tbody>
      </table></div>
    </div>
  )
}

export default function Product({ id }) {
  const { plan, data, go } = useApp()
  const p = plan.prodById[id] ?? plan.products[0]
  const [range, setRange] = useState(26)
  const chart = []
  for (let t = HIST - range; t < HIST + AHEAD; t++) {
    if (t < HIST) chart.push({ x: t, actual: p.hist[t] })
    else { const k = t - HIST; chart.push({ x: t, fc: p.fc[k], lo: p.lo[k], hi: p.hi[k], ly: p.hist[t - 52] }) }
  }
  const lastI = range - 1; Object.assign(chart[lastI], { fc: chart[lastI].actual, lo: chart[lastI].actual, hi: chart[lastI].actual })
  const orders = data.orders.filter(o => o.productId === p.id).sort((a, b) => b.week - a.week)
  const ahead = orders.filter(o => o.week >= HIST)
  const decisions = plan.decisions.filter(d => d.link.id === p.id || (d.type === 'Sales change' && p.change?.id === d.id))
  const mats = plan.materials.filter(m => m.bom[p.grade] > 0).map(m => ({ m, perT: m.bom[p.grade], cost: m.bom[p.grade] * m.priceNow })).sort((a, b) => b.cost - a.cost)
  const matCost = sum(mats.map(x => x.cost))
  const regions = REGIONS.map(r => ({ r: r.id, now: sum(p.byRegionHist[r.id].slice(HIST - 4)) / 4, next: sum(p.byRegionFc[r.id].slice(0, 4)) / 4 }))
  const ex = {
    stock: { title: 'Stock lasts', value: daysText(p.daysLeft), means: 'How long finished stock in the warehouse lasts at the expected sales rate.', formula: 'stock ÷ (sales per week ÷ 7)', worked: `${fmtT(p.onHand)} ÷ (${fmtT(p.weekly)} ÷ 7) = ${daysText(p.daysLeft)}` },
    rop: { title: 'Reorder level', value: fmtT(p.rop), means: 'When stock plus what is being made falls to this level, make more.', formula: `sales during making time (${p.L}+1 weeks) + safety stock`, worked: `${fmtT(p.demandL)} + ${fmtT(p.ss)} = ${fmtT(p.rop)}`, inputs: [{ k: 'Safety stock', v: `${plan.z.toFixed(2)} × ${fmtT(p.sigma)} × √${p.L + 1} = ${fmtT(p.ss)}` }, { k: 'Stock + being made', v: fmtT(p.position) }] },
    acc: { title: 'Forecast accuracy', value: `${(p.acc * 100).toFixed(1)}%`, means: 'How close last 12 weeks of forecasts were to real sales.', formula: '100% − (total miss ÷ total sales)', worked: `100% − (${fmtT(p.err)} ÷ ${fmtT(p.tot)}) = ${(p.acc * 100).toFixed(1)}%`, inputs: [{ k: 'Old way', v: `${(p.accOld * 100).toFixed(1)}%` }] },
    cost: { title: 'Material cost per tonne', value: fmtINR(matCost), means: 'What the raw materials in one tonne cost at today\'s prices.', formula: 'Sum of (amount per tonne × price)', worked: mats.map(x => `${x.m.name} ${fmtINR(x.cost)}`).join(' + ') + ` = ${fmtINR(matCost)}` },
  }

  return (
    <>
      <Head backLink title={p.name} sub={p.use} right={<><Pill u={p.urgency} /><button className="btn sm" onClick={() => go('simulate', p.id)}>What if</button></>} />
      {decisions.length > 0 && <div className="dlist">{decisions.map(d => <DecisionRow key={d.id} d={d} />)}</div>}
      <div className="card"><div className="card-b facts">
        <Fact k="Sales a week, next 4" v={fmtT(p.weekly)} s={`last 4 weeks: ${fmtT(p.recent4)}`} />
        <Fact k="Next 12 weeks" v={fmtT(p.next12)} s={fmtINR(p.value12)} />
        <Fact k="In stock" v={fmtT(p.onHand)} s={`+ ${fmtT(sum(p.wip))} being made`} />
        <Fact k="Stock lasts" v={daysText(p.daysLeft)} e={ex.stock} s={`making takes ${p.L * 7} days`} color={p.urgency === 'Urgent' ? 'var(--urgent)' : undefined} />
        <Fact k="Reorder level" v={fmtT(p.rop)} e={ex.rop} />
        <Fact k="Forecast accuracy" v={`${(p.acc * 100).toFixed(1)}%`} e={ex.acc} s={`old way ${(p.accOld * 100).toFixed(1)}%`} />
      </div></div>

      <Card title="Sales: past and expected" sub="Tonnes per week" right={<select className="sel" value={range} onChange={e => setRange(+e.target.value)} aria-label="Range"><option value={26}>6 months</option><option value={52}>1 year</option><option value={102}>2 years</option></select>}>
        <TimeChart data={chart} today={HIST} height={260} series={[
          { key: 'band', kind: 'band', lo: 'lo', hi: 'hi', color: 'var(--teal)', label: 'Likely range' },
          { key: 'actual', kind: 'area', color: 'var(--ink-2)', label: 'Actual', width: 1.8 },
          { key: 'ly', kind: 'line', color: 'var(--ink-3)', dash: '2 3', label: 'Last year', width: 1.2 },
          { key: 'fc', kind: 'line', color: 'var(--teal)', label: 'Forecast', width: 2.6 },
        ]} />
        <div style={{ marginTop: 8 }}><Legend items={[{ label: 'Actual', color: 'var(--ink-2)' }, { label: 'Forecast', color: 'var(--teal)' }, { label: 'Same week last year', color: 'var(--ink-3)' }]} /></div>
        {p.change && <p className="note" style={{ marginBottom: 0 }}><b>Sales changed:</b> {p.change.headline} since {wk(p.change.start)}. {p.change.why} <button className="link" onClick={() => go('changes', p.change.id)}>Open</button></p>}
        {p.drivers.newsIds.length > 0 && <p className="note" style={{ marginBottom: 0 }}><b>News used:</b> {p.drivers.newsIds.map(i => SIGNALS.find(s => s.id === i).title).join('; ')}</p>}
      </Card>

      <div className="grid g2">
        <Card title="Stock and making" sub="Week by week: what arrives from production, what is sold, what is left">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Week</th><th scope="col" className="r">Start making</th><th scope="col" className="r">Ready</th><th scope="col" className="r">Sold</th><th scope="col" className="r">Left</th></tr></thead>
            <tbody>{p.proj.slice(0, 8).map(r => (
              <tr key={r.w}><td>{wk(HIST + r.w)}</td><td className="r num">{fmtT(p.make[r.w])}</td><td className="r num">{fmtT(r.arrive)}</td><td className="r num">{fmtT(r.demand)}</td>
                <td className={`r num ${r.stock < 0 ? 'down' : ''}`}>{r.stock < 0 ? `short ${fmtT(-r.stock)}` : fmtT(r.stock)}</td></tr>))}</tbody>
          </table></div>
        </Card>
        <Card title="Where sales come from" sub="Average per week">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Customers</th><th scope="col" className="r">Last 4 weeks</th><th scope="col" className="r">Next 4 weeks</th><th scope="col" className="r">Change</th></tr></thead>
            <tbody>{regions.map(r => <tr key={r.r}><td>{r.r}</td><td className="r num">{fmtT(r.now)}</td><td className="r num">{fmtT(r.next)}</td><td className={`r num ${r.next >= r.now ? 'up' : 'down'}`}>{fmtPct((r.next / Math.max(0.1, r.now) - 1) * 100)}</td></tr>)}</tbody>
          </table></div>
          <div className="row between" style={{ marginTop: 12 }}><b>Price</b><span className="num">{fmtINR(p.price)} / t</span></div>
          <div className="row between"><span>Material cost <span className="note">per tonne</span></span><span className="num">{fmtINR(matCost)}</span></div>
          <div className="row between"><span>Margin before other costs</span><span className="num up">{fmtINR(p.price - matCost)} ({Math.round((1 - matCost / p.price) * 100)}%)</span></div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Materials in one tonne" sub="Click to open the material">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Material</th><th scope="col" className="r">Per tonne</th><th scope="col" className="r">Cost</th><th scope="col">Stock</th></tr></thead>
            <tbody>{mats.map(x => <tr key={x.m.id} className="click" onClick={() => go('material', x.m.id)}><td className="nm">{x.m.name}</td><td className="r num">{x.perT < 1 ? x.perT.toFixed(3) : x.perT.toFixed(1)} {x.m.unit}</td><td className="r num">{fmtINR(x.cost)}</td><td><MatPill m={x.m} /></td></tr>)}</tbody>
          </table></div>
        </Card>
        <Card title="What if sales change?" sub="Move the slider to see the effect">
          <WhatIfBox p={p} />
        </Card>
      </div>

      <Card title="Customer orders" sub={`${ahead.length} booked ahead · ${fmtT(sum(ahead.map(o => o.qty)))}`} pad={false}>
        {orders.length ? <div className="tbl-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}><table className="tbl">
          <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Week</th><th scope="col" className="r">Tonnes</th><th scope="col" className="r">Value</th><th scope="col">Status</th></tr></thead>
          <tbody>{orders.slice(0, 40).map(o => <tr key={o.id}><td className="num">{o.id}</td><td>{o.customer}</td><td>{wk(o.week)}</td><td className="r num">{fmtT(o.qty)}</td><td className="r num">{fmtINR(o.value)}</td><td><span className="tag">{o.status}</span></td></tr>)}</tbody>
        </table></div> : <Empty>No orders.</Empty>}
      </Card>
      <FilesCard type="product" id={p.id} />
    </>
  )
}
