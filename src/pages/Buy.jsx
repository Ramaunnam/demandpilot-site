import React, { useState } from 'react'
import { dayLabel } from '../data.js'
import { sum, fmtQty, fmtINR } from '../engine.js'
import { useApp, Head, Tile, MatPill, Card, Empty, deadlineText, URG_COLOR } from '../ui.jsx'

function BuyRow({ b }) {
  const { act, go, state } = useApp()
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(b.qty)
  const m = b.mat
  const isCut = b.kind === 'cut'
  const dl = deadlineText(b.orderByDay)
  return (
    <div className="drow">
      <span className="bar" style={{ background: URG_COLOR[m.urgency] }} />
      <div className="main-c">
        <div className="t1"><MatPill m={m} /><span className="tag">{isCut ? 'Buy less' : b.late ? 'Rush order' : 'Order'}</span><button className="link name" onClick={() => go('material', m.id)}>{m.name}</button><span className="what">{m.supplier}</span></div>
        <div className="do"><b>Do:</b> {isCut ? 'Skip the next order' : edit
          ? <><input className="inp qty" type="number" min={0} value={val} onChange={e => setVal(+e.target.value)} aria-label="Quantity" /> {m.unit} <span className="note">= {fmtINR(val * m.priceNow * (b.late ? 1 + state.settings.rushPremium / 100 : 1))}</span></>
          : <>Order <b>{fmtQty(b.qty, m.unit)}</b> · {fmtINR(b.cost)}{b.late && ` (incl. ${state.settings.rushPremium}% rush charge)`}
            {b.covers > 0 && <span className="note"> · covers {b.covers} week{b.covers === 1 ? '' : 's'} of use</span>}</>}</div>
        <div className="why"><b>Why:</b> {b.why}</div>
      </div>
      <div className="side-c">
        <span className={`when ${dl.late ? 'late' : ''}`}>{isCut ? 'Before next order' : dl.t}</span>
        {!isCut && <span className="note">arrives {dayLabel(b.arrivesDay)}{b.late ? ' (rushed)' : ''}</span>}
        <div className="acts">
          {edit ? <>
            <button className="btn sm pri" onClick={() => { act.editQty(b.id, val); act.approveBuy(b, val); setEdit(false) }}>Approve {fmtQty(val, m.unit)}</button>
            <button className="btn sm ghost" onClick={() => { setEdit(false); setVal(b.qty) }}>Cancel</button>
          </> : <>
            <button className="btn sm pri" onClick={() => isCut ? act.approveDecision({ id: b.id, name: m.name }) : act.approveBuy(b)}>Approve</button>
            {!isCut && <button className="btn sm" onClick={() => setEdit(true)}>Edit qty</button>}
            <button className="btn sm ghost" onClick={() => act.rejectBuy(b)}>Reject</button>
          </>}
        </div>
      </div>
    </div>
  )
}

export default function Buy() {
  const { plan, state } = useApp()
  const buys = plan.buys.filter(b => !(b.kind === 'cut' && state.approvedIds[b.id]))
  const now = buys.filter(b => b.kind === 'buy' && b.urgency !== 'Watch')
  const later = buys.filter(b => b.kind === 'buy' && b.urgency === 'Watch')
  const cuts = buys.filter(b => b.kind === 'cut')
  const placed = state.approved
  return (
    <>
      <Head title="Buy" sub="Material orders the plan suggests. Approve, change the amount, or reject." />
      <div className="grid g4">
        <Tile k="To approve now" v={`${now.length}`} d={`${now.filter(b => b.late).length} need rush delivery`} tone={now.some(b => b.urgency === 'Urgent') ? 'red' : undefined} />
        <Tile k="Money to spend" v={fmtINR(plan.kpi.toSpend)} e={plan.explain.toSpend} />
        <Tile k="Cash that can be freed" v={fmtINR(plan.kpi.toFree)} e={plan.explain.toFree} tone="green" />
        <Tile k="Placed this session" v={`${placed.length}`} d={placed.length ? fmtINR(sum(placed.map(p => p.cost))) : 'none yet'} />
      </div>
      <h3 style={{ margin: '4px 0 0' }}>Approve now</h3>
      {now.length ? <div className="dlist">{now.map(b => <BuyRow key={b.id} b={b} />)}</div> : <Empty>Nothing to approve right now.</Empty>}
      {later.length > 0 && <><h3 style={{ margin: '4px 0 0' }}>Coming up (next 3 weeks)</h3><div className="dlist">{later.map(b => <BuyRow key={b.id} b={b} />)}</div></>}
      {cuts.length > 0 && <><h3 style={{ margin: '4px 0 0' }}>Buy less — too much stock</h3><div className="dlist">{cuts.map(b => <BuyRow key={b.id} b={b} />)}</div></>}
      {placed.length > 0 && <Card title="Orders placed this session" pad={false}>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th scope="col">Order</th><th scope="col">Material</th><th scope="col" className="r">Amount</th><th scope="col" className="r">Cost</th><th scope="col">Arrives</th></tr></thead>
          <tbody>{placed.map(p => { const m = plan.matById[p.mat]; return <tr key={p.id}><td className="num">{p.id}{p.rush && <span className="tag" style={{ marginLeft: 4 }}>Rush</span>}</td><td>{m.name}</td><td className="r num">{fmtQty(p.qty, m.unit)}</td><td className="r num">{fmtINR(p.cost)}</td><td>{dayLabel(p.dueDay)}</td></tr> })}</tbody>
        </table></div></Card>}
    </>
  )
}
