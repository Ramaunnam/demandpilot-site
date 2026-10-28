import React, { useState } from 'react'
import { fmtQty, fmtINR, fmtPct, daysText } from '../engine.js'
import { dayLabel } from '../data.js'
import { useApp, Head, Seg, MatPill, Card, Tile, useViewState } from '../ui.jsx'

export default function Materials() {
  const { plan, go } = useApp()
  const [urg, setUrg] = useViewState('materials.urgency', 'All')
  const M = plan.materials
  const cnt = (u) => M.filter(m => m.urgency === u).length
  const list = M.filter(m => urg === 'All' || m.urgency === urg)
  const order = { Urgent: 0, Soon: 1, Info: 2, OK: 3 }
  return (
    <>
      <Head title="Materials & stock" sub="Every raw material: how much we have, how long it lasts, and when to order." />
      <div className="grid g4">
        <Tile k="Will run out" v={`${cnt('Urgent')}`} tone={cnt('Urgent') ? 'red' : 'green'} e={plan.explain.matsAtRisk} d="before new supply can arrive" onClick={() => setUrg('Urgent')} />
        <Tile k="Order this week" v={`${cnt('Soon')}`} d="order date within 7 days" onClick={() => setUrg('Soon')} />
        <Tile k="Too much stock" v={`${cnt('Info')}`} e={plan.explain.toFree} d={`${fmtINR(plan.kpi.toFree)} can be freed`} onClick={() => setUrg('Info')} />
        <Tile k="Stock value" v={fmtINR(plan.kpi.stockValue)} d={`${M.length} materials`} onClick={() => setUrg('All')} />
      </div>
      <Seg value={urg} onChange={setUrg} options={[{ v: 'All', l: 'All', c: M.length }, { v: 'Urgent', l: 'Urgent', c: cnt('Urgent') }, { v: 'Soon', l: 'Soon', c: cnt('Soon') }, { v: 'Info', l: 'Too much', c: cnt('Info') }, { v: 'OK', l: 'All good', c: cnt('OK') }]} />
      <Card pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Material</th><th scope="col">Status</th><th scope="col" className="r">In stock</th><th scope="col" className="r">Use a day</th><th scope="col">Lasts vs delivery</th><th scope="col" className="r">Order to place</th><th scope="col" className="r">Price</th></tr></thead>
          <tbody>{[...list].sort((a, b) => order[a.urgency] - order[b.urgency] || a.daysLeft - b.daysLeft).map(m => {
            const pw = plan.priceWatch.find(x => x.m.id === m.id)
            const max = Math.max(m.daysLeft, m.lead) * 1.1
            return (
              <tr key={m.id} className="click" onClick={() => go('material', m.id)}>
                <td className="nm">{m.name}<small>{m.what}</small></td>
                <td><MatPill m={m} /></td>
                <td className="r num">{fmtQty(m.onHand, m.unit)}</td>
                <td className="r num">{fmtQty(m.daily, m.unit)}</td>
                <td style={{ minWidth: 170 }}>
                  <div className="loadbar"><i style={{ width: `${Math.min(100, m.daysLeft / max * 100)}%`, background: m.urgency === 'Urgent' ? 'var(--urgent)' : 'var(--teal)' }} /></div>
                  <div className="note">{daysText(m.daysLeft)} of stock · delivery {m.lead} days</div>
                </td>
                <td className="r num">{m.buy
                  ? <>{m.buy.late ? <span className="down">Late — rush</span> : dayLabel(m.buy.orderByDay)}
                    <div className="note">{fmtQty(m.buy.qty, m.unit)} · {fmtINR(m.buy.cost)}</div></>
                  : m.cut ? <span className="note">buy less</span> : '—'}</td>
                <td className="r num">{fmtINR(m.priceNow)}{pw && <div className={`note ${pw.dir === 'Rising' ? 'down' : pw.dir === 'Falling' ? 'up' : ''}`}>{pw.dir} {fmtPct(pw.c4, 1)}</div>}</td>
              </tr>) })}</tbody>
        </table></div>
      </Card>
    </>
  )
}
