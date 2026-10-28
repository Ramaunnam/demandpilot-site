import React, { useState } from 'react'
import { HIST, AHEAD, wk, dayLabel } from '../data.js'
import { sum, fmtT, fmtQty, fmtINR, daysText } from '../engine.js'
import { useApp, Head, Card, Pill, MatPill, useViewState } from '../ui.jsx'

export default function Plan() {
  const { plan, go } = useApp()
  const [step, setStep] = useViewState('plan.step', 1)
  const totalMake = new Array(AHEAD).fill(0).map((_, w) => sum(plan.products.map(p => p.make[w])))
  const buys = plan.buys.filter(b => b.kind === 'buy')
  const short = plan.materials.filter(m => m.planned.length)
  const steps = [
    { n: 1, t: 'Forecast', v: fmtT(plan.kpi.next12), s: 'customers will buy, 12 weeks' },
    { n: 2, t: 'Make plan', v: fmtT(sum(totalMake)), s: `forecast + stock top-up · ${plan.kpi.overWeeks} busy week${plan.kpi.overWeeks === 1 ? '' : 's'}` },
    { n: 3, t: 'Materials needed', v: `${plan.materials.length}`, s: 'materials, from the recipe per tonne' },
    { n: 4, t: 'What we have', v: `${short.length}`, s: 'materials fall below safety' },
    { n: 5, t: 'What to buy', v: `${buys.length}`, s: `orders · ${fmtINR(sum(buys.map(b => b.cost)))}` },
  ]
  return (
    <>
      <Head title="Plan & MRP" sub="How the forecast turns into a production plan and then into material orders. Click each step." />
      <div className="card"><div className="steps">
        {steps.map(s => (
          <button key={s.n} className="step" style={{ border: 0, borderRight: '1px solid var(--line)', textAlign: 'left', background: step === s.n ? 'var(--surface-2)' : 'none', boxShadow: step === s.n ? 'inset 0 -3px 0 var(--teal)' : 'none' }} onClick={() => setStep(s.n)}>
            <div className="no">{s.n}</div><b>{s.t}</b><div className="v num">{s.v}</div><div className="s">{s.s}</div>
          </button>))}
      </div></div>

      {step === 1 && <Card title="Step 1 · Forecast per product" sub="What customers are expected to buy, next 4 weeks average per week" right={<button className="btn sm" onClick={() => go('forecast')}>Full forecast</button>} pad={false}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Product</th><th scope="col" className="r">Per week</th><th scope="col" className="r">12 weeks</th></tr></thead>
          <tbody>{[...plan.products].sort((a, b) => b.next12 - a.next12).map(p => <tr key={p.id} className="click" onClick={() => go('product', p.id)}><td className="nm">{p.name}</td><td className="r num">{fmtT(p.weekly)}</td><td className="r num">{fmtT(p.next12)}</td></tr>)}</tbody>
        </table></div></Card>}

      {step === 2 && <>
        <Card title="Step 2 · Make plan vs what each line can do" sub="Planned tonnes as % of line capacity, per week. Red = over capacity.">
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Line</th>{plan.lines[0].weeks.map(x => <th scope="col" key={x.w} className="r">{wk(HIST + x.w)}</th>)}</tr></thead>
            <tbody>{plan.lines.map(l => <tr key={l.id}><td className="nm">{l.name}<small>{fmtT(l.cap)} a week</small></td>
              {l.weeks.map(x => <td key={x.w} className="r num" title={`${fmtT(x.load)} of ${fmtT(x.cap)}`} style={{ background: x.pct > 100 ? 'rgba(210,50,50,.18)' : x.pct > 90 ? 'rgba(230,150,30,.15)' : undefined, fontWeight: x.pct > 100 ? 800 : 500 }}>{Math.round(x.pct)}%</td>)}</tr>)}</tbody>
          </table></div>
          {plan.overloads.map(o => <p key={o.line.id + o.w} style={{ margin: '10px 0 0' }}><Pill u="Soon">Too busy</Pill> <b>{o.line.name}, week of {wk(HIST + o.w)}:</b> planned {fmtT(o.load)}, can do {fmtT(o.cap)}{o.line.maintenance?.week === HIST + o.w ? ` (maintenance, ${o.line.maintenance.pct}%)` : ''}. Move {fmtT(o.over)} to the weeks around it or add a weekend shift.</p>)}
        </Card>
        <Card title="How much to make, per product" sub="Make = forecast + top-up to reach target stock, spread over 6 weeks" pad={false}>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Product</th><th scope="col" className="r">Stock + being made</th><th scope="col" className="r">Target</th><th scope="col" className="r">Make, next 6 wks</th><th scope="col">Status</th></tr></thead>
            <tbody>{plan.products.map(p => <tr key={p.id} className="click" onClick={() => go('product', p.id)}><td className="nm">{p.name}</td><td className="r num">{fmtT(p.position)}</td><td className="r num">{fmtT(p.target)}</td><td className="r num">{fmtT(sum(p.make.slice(0, 6)))}</td><td><Pill u={p.urgency} /></td></tr>)}</tbody>
          </table></div></Card>
      </>}

      {step === 3 && <Card title="Step 3 · Materials needed" sub="Make plan × amount of material per tonne" pad={false}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Material</th><th scope="col" className="r">Next 4 weeks</th><th scope="col" className="r">12 weeks</th><th scope="col" className="r">Per day</th></tr></thead>
          <tbody>{plan.materials.map(m => <tr key={m.id} className="click" onClick={() => go('material', m.id)}><td className="nm">{m.name}<small>{m.what}</small></td><td className="r num">{fmtQty(sum(m.gross.slice(0, 4)), m.unit)}</td><td className="r num">{fmtQty(sum(m.gross), m.unit)}</td><td className="r num">{fmtQty(m.daily, m.unit)}</td></tr>)}</tbody>
        </table></div></Card>}

      {step === 4 && <Card title="Step 4 · What we have" sub="Stock + orders on the way, against what is needed" pad={false}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Material</th><th scope="col" className="r">In stock</th><th scope="col" className="r">On the way</th><th scope="col" className="r">Lasts</th><th scope="col" className="r">Delivery</th><th scope="col">Status</th></tr></thead>
          <tbody>{plan.materials.map(m => <tr key={m.id} className="click" onClick={() => go('material', m.id)}><td className="nm">{m.name}</td><td className="r num">{fmtQty(m.onHand, m.unit)}</td><td className="r num">{m.pos.length ? fmtQty(sum(m.pos.map(p => p.qty)), m.unit) : '—'}</td><td className={`r num ${m.urgency === 'Urgent' ? 'down' : ''}`}>{daysText(m.daysLeft)}</td><td className="r num">{m.lead} days</td><td><MatPill m={m} /></td></tr>)}</tbody>
        </table></div></Card>}

      {step === 5 && <Card title="Step 5 · What to buy" sub="Orders the plan suggests, with order-by dates" right={<button className="btn sm pri" onClick={() => go('buy')}>Approve in Buy</button>} pad={false}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Material</th><th scope="col" className="r">Order</th><th scope="col" className="r">Order by</th><th scope="col" className="r">Cost</th><th scope="col">Status</th></tr></thead>
          <tbody>{buys.map(b => <tr key={b.id} className="click" onClick={() => go('material', b.mat.id)}><td className="nm">{b.mat.name}<small>{b.why}</small></td><td className="r num">{fmtQty(b.qty, b.mat.unit)}</td><td className="r num">{b.late ? <span className="down">Late — rush</span> : dayLabel(b.orderByDay)}</td><td className="r num">{fmtINR(b.cost)}</td><td><MatPill m={b.mat} /></td></tr>)}</tbody>
        </table></div></Card>}

      <div className="row between">
        <button className="btn" disabled={step === 1} onClick={() => setStep(step - 1)}>‹ Back</button>
        <button className="btn pri" disabled={step === 5} onClick={() => setStep(step + 1)}>Next step ›</button>
      </div>
    </>
  )
}
