import React from 'react'
import { HIST, wk, dayLabel } from '../data.js'
import { fmtQty, fmtINR, fmtPct, daysText } from '../engine.js'
import { useApp, Head, Card, Fact, MatPill, DecisionRow, Empty } from '../ui.jsx'
import { TimeChart } from '../charts.jsx'

export default function Material({ id }) {
  const { plan, go } = useApp()
  const m = plan.matById[id] ?? plan.materials[0]
  const u = m.unit
  const pw = plan.priceWatch.find(x => x.m.id === m.id)
  const decisions = plan.decisions.filter(d => d.link.id === m.id)
  const uses = plan.products.filter(p => m.bom[p.grade] > 0).map(p => ({ p, wk: p.weekly * m.bom[p.grade] })).sort((a, b) => b.wk - a.wk)
  const first = m.planned[0]
  const buy = m.buy      // the one calculated order for this material, shared with Buy and Decisions
  const ex = {
    days: { title: 'Stock lasts', value: daysText(m.daysLeft), means: 'How many days the stock we hold lasts at the planned use.', formula: 'stock ÷ use per day', worked: `${fmtQty(m.onHand, u)} ÷ ${fmtQty(m.daily, u)} = ${daysText(m.daysLeft)}`, inputs: [{ k: 'Use per day', v: 'next 4 weeks of planned production × amount per tonne ÷ 7' }] },
    rop: { title: 'Reorder level', value: fmtQty(m.reorderPoint, u), means: 'Order when stock falls to this level, so the new delivery arrives before we run out.', formula: 'use per day × delivery days + safety stock', worked: `${fmtQty(m.daily, u)} × ${m.lead} + ${fmtQty(m.safety, u)} = ${fmtQty(m.reorderPoint, u)}`, inputs: [{ k: 'Safety stock', v: `${m.safetyDays} days of use = ${fmtQty(m.safety, u)}` }] },
    by: first ? { title: 'Order by', value: first.orderByDay < 0 ? `Late by ${Math.round(-first.orderByDay)} days` : dayLabel(first.orderByDay), means: 'Last day to order so it arrives in time.', formula: 'day stock is needed − delivery days', worked: `${dayLabel(first.needDay)} − ${m.lead} days = ${dayLabel(first.orderByDay)}`, inputs: [{ k: 'Order size', v: `${fmtQty(first.qty, u)} (rounded up to lots of ${fmtQty(m.lot, u)})` }] } : null,
  }
  const priceChart = pw ? pw.series.map(x => ({ x: x.week, v: x.v })) : null

  return (
    <>
      <Head crumb={{ page: 'materials', label: 'Materials & stock' }} title={m.name} sub={`${m.what} · supplier ${m.supplier}`} right={<MatPill m={m} />} />
      {decisions.length > 0 && <div className="dlist">{decisions.map(d => <DecisionRow key={d.id} d={d} />)}</div>}
      <div className="card"><div className="card-b facts">
        <Fact k="In stock" v={fmtQty(m.onHand, u)} s={fmtINR(m.value)} />
        <Fact k="Use a day" v={fmtQty(m.daily, u)} />
        <Fact k="Stock lasts" v={daysText(m.daysLeft)} e={ex.days} color={m.urgency === 'Urgent' ? 'var(--urgent)' : undefined} s={`delivery takes ${m.lead} days`} />
        <Fact k="Reorder level" v={fmtQty(m.reorderPoint, u)} e={ex.rop} />
        <Fact k="Order to place" v={ex.by ? ex.by.value : 'No order needed'} e={ex.by}
          s={buy ? `${fmtQty(buy.qty, u)} · ${fmtINR(buy.cost)}` : first ? fmtQty(first.qty, u) : 'for 12 weeks'}
          color={buy?.late ? 'var(--urgent)' : undefined} />
        <Fact k="Price" v={fmtINR(m.priceNow)} s={`per ${u}`} />
      </div></div>

      <Card title="Stock week by week (MRP)" sub="Start + arriving − needed for production = end. A new order is planned when stock would fall below safety." pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Week</th><th scope="col" className="r">Start</th><th scope="col" className="r">Arriving</th><th scope="col" className="r">Needed</th><th scope="col" className="r">New order</th><th scope="col" className="r">End</th></tr></thead>
          <tbody>{m.rows.map(r => (
            <tr key={r.w} className={r.reachable ? '' : 'dim'} style={r.below ? { background: 'var(--urgent-soft, rgba(200,40,40,.06))' } : undefined}>
              <td>{wk(HIST + r.w)}{!r.reachable && <div className="note">too soon to order</div>}</td><td className="r num">{fmtQty(r.start, u)}</td><td className="r num">{r.receipts ? fmtQty(r.receipts, u) : '—'}</td>
              <td className="r num">{fmtQty(r.gross, u)}</td><td className="r num">{r.por ? <b>{fmtQty(r.por, u)}</b> : '—'}</td>
              <td className={`r num ${r.below ? 'down' : ''}`}>{fmtQty(r.end, u)}</td>
            </tr>))}</tbody>
        </table></div>
        <div className="note" style={{ padding: '8px 14px' }}>
          Safety level: {fmtQty(m.safety, u)} ({m.safetyDays} days of use). Shaded weeks would fall below it without the new order.
          {m.reachW > 0 && <> Delivery takes {m.lead} days, so an order placed today cannot arrive before the week of {wk(HIST + m.reachW)} —
          anything short before then is carried into that first order.</>}
        </div>
      </Card>

      <div className="grid g2">
        <Card title="Orders on the way" sub="Purchase orders already placed">
          {m.pos.length ? m.pos.map(po => (
            <div key={po.id} className="row between" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <span><b className="num">{po.id}</b> · {fmtQty(po.qty, u)}{po.rush && <span className="tag" style={{ marginLeft: 4 }}>Rush</span>}</span>
              <span className="note">arrives {dayLabel(po.dueDay)} · {po.status}</span>
            </div>)) : <Empty>No orders on the way.</Empty>}
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => go('buy')}>Go to Buy</button>
        </Card>
        {pw ? (
          <Card title="Price trend" sub={`Index, last 26 weeks · ${pw.dir} (${fmtPct(pw.c4, 1)} in 4 weeks)`}>
            <TimeChart data={priceChart} height={170} series={[{ key: 'v', kind: 'line', color: pw.dir === 'Rising' ? 'var(--urgent)' : 'var(--teal)', label: 'Price index', width: 2.4 }]} />
            <p style={{ margin: '8px 0 0' }}><b>Advice:</b> {pw.advice}</p>
            {pw.notice && <p className="note" style={{ margin: '4px 0 0' }}>News: {pw.notice.title}</p>}
          </Card>
        ) : (
          <Card title="Price" sub="Fixed contract price"><p style={{ margin: 0 }}>{fmtINR(m.priceNow)} per {u}. No market price movement to watch.</p></Card>
        )}
      </div>

      <Card title="Used in" sub="Products that need this material, amount per week" pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Product</th><th scope="col" className="r">Per tonne</th><th scope="col" className="r">A week</th></tr></thead>
          <tbody>{uses.map(x => <tr key={x.p.id} className="click" onClick={() => go('product', x.p.id)}><td className="nm">{x.p.name}</td><td className="r num">{m.bom[x.p.grade] < 1 ? m.bom[x.p.grade].toFixed(3) : m.bom[x.p.grade]} {u}</td><td className="r num">{fmtQty(x.wk, u)}</td></tr>)}</tbody>
        </table></div>
      </Card>
    </>
  )
}
