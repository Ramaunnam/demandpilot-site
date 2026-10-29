import React, { useEffect } from 'react'
import { HIST, wk, dayLabel, REGIONS, fmtWhen } from '../data.js'
import { sum, fmtT, fmtQty, fmtINR } from '../engine.js'
import { useApp, Head, Seg, Card, Tile, Empty, Icon, useViewState } from '../ui.jsx'

export default function Orders({ id }) {
  const { plan, data, go, state, act } = useApp()
  const [tab, setTab] = useViewState('orders.tab', 'customer')
  useEffect(() => { if (id === 'po' || id === 'wo' || id === 'no') setTab(id) }, [id, setTab])
  const [when, setWhen] = useViewState('orders.when', 'ahead')
  const [status, setStatus] = useViewState('orders.status', 'All')
  const [region, setRegion] = useViewState('orders.region', 'All')
  const [q, setQ] = useViewState('orders.search', '')
  const all = data.orders
  const list = all.filter(o => (when === 'all' || (when === 'ahead' ? o.week >= HIST : o.week < HIST)) && (status === 'All' || o.status === status) && (region === 'All' || o.region === region)
    && (plan.prodById[o.productId].name + o.customer).toLowerCase().includes(q.toLowerCase())).sort((a, b) => when === 'past' ? b.week - a.week : a.week - b.week)
  const placed = plan.allPos.filter(p => p.approvedNow)
  // the one you just placed sits at the top, then the rest by when they arrive
  const pos = [...plan.allPos].sort((a, b) => (b.placedAt ?? 0) - (a.placedAt ?? 0) || a.dueDay - b.dueDay)
  const notOrdered = (state.activity ?? []).filter(e => e.undo?.type === 'reject')
  const ahead = all.filter(o => o.week >= HIST)
  const work = state.production ?? []
  return (
    <>
      <Head title="Orders" sub="Customer orders for our steel, and our purchase orders for materials." />
      <div className="grid g4">
        <Tile k="Booked ahead" v={`${ahead.length}`} d={fmtT(sum(ahead.map(o => o.qty)))} onClick={() => { setTab('customer'); setWhen('ahead') }} />
        <Tile k="Value booked ahead" v={fmtINR(sum(ahead.map(o => o.value)))} />
        <Tile k="Material orders open" v={`${pos.length}`} d={`${pos.filter(p => p.approvedNow).length} placed this session`} onClick={() => setTab('po')} />
        <Tile k="Customers" v={`${new Set(all.map(o => o.customer)).size}`} d="last 8 weeks + next 4" />
      </div>
      {placed.length > 0 && tab !== 'po' && (
        <div className="alert calm">
          <Icon name="check" />
          <span className="msg">
            <b>{placed.length} material order{placed.length === 1 ? '' : 's'} placed this session.</b>{' '}
            Purchase orders are kept on the Material orders tab, not with the customer orders.
          </span>
          <button className="btn sm pri" onClick={() => setTab('po')}>Show {placed.length === 1 ? 'it' : 'them'}</button>
        </div>
      )}
      <Seg value={tab} onChange={setTab} label="Which orders"
        options={[
          { v: 'customer', l: 'Customer orders', c: all.length },
          { v: 'po', l: 'Material orders', c: placed.length ? `${pos.length} · ${placed.length} new` : pos.length },
          { v: 'wo', l: 'Production orders', c: work.length },
          { v: 'no', l: 'Not ordered', c: notOrdered.length },
        ]} />
      {tab === 'no' ? (
        <Card title="Not ordered" sub="Orders the plan suggested that you turned down. Nothing was bought." pad={false}>
          {notOrdered.length ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr>
                <th scope="col">Material</th><th scope="col" className="r">Suggested</th>
                <th scope="col" className="r">Cost avoided</th><th scope="col">Turned down</th><th scope="col"></th>
              </tr></thead>
              <tbody>
                {notOrdered.map(e => (
                  <tr key={e.id}>
                    <td className="nm">{e.matName ?? e.what}{e.matId && <small>{plan.matById[e.matId]?.what}</small>}</td>
                    <td className="r num">{e.qty != null ? fmtQty(e.qty, e.unit) : '—'}</td>
                    <td className="r num">{e.cost != null ? fmtINR(e.cost) : '—'}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{e.when ? fmtWhen(e.when) : e.at}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        {e.matId && <button className="btn sm ghost" onClick={() => go('material', e.matId)}>Material</button>}
                        <button className="btn sm" onClick={() => act.undo(e)}>Put it back</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <Empty>Nothing has been turned down. Orders you reject on the Buy screen are kept here.</Empty>}
        </Card>
      ) : tab === 'wo' ? (
        <Card title="Production orders" sub="Raised when you approve a “Make more” decision. Mock, like the rest of the demo." pad={false}>
          {work.length ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr>
                <th scope="col">Order</th><th scope="col">Product</th><th scope="col">Line</th>
                <th scope="col" className="r">Tonnes</th><th scope="col">Over</th><th scope="col">Raised</th><th scope="col">Status</th><th scope="col"></th>
              </tr></thead>
              <tbody>
                {work.map(w => (
                  <tr key={w.id} className="click" onClick={() => go('product', w.productId)}>
                    <td className="num">{w.id}<span className="tag" style={{ marginLeft: 4 }}>New</span></td>
                    <td className="nm">{w.name}</td>
                    <td>{w.line}</td>
                    <td className="r num">{fmtT(w.qty)}</td>
                    <td className="note">{w.weeks} weeks</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{w.raisedAt ? fmtWhen(w.raisedAt) : w.at}</td>
                    <td><span className="tag">{w.status}</span></td>
                    <td><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); go('plan') }}>Plan</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <Empty>No production orders yet. Approve a “Make more” decision and it will appear here.</Empty>}
        </Card>
      ) : tab === 'customer' ? <>
        <div className="filters">
          <input className="inp" placeholder="Search customer or product" value={q} onChange={e => setQ(e.target.value)} aria-label="Search orders" />
          <Seg value={when} onChange={setWhen} options={[{ v: 'ahead', l: 'Booked ahead' }, { v: 'past', l: 'Past 8 weeks' }, { v: 'all', l: 'All' }]} />
          <select className="sel" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">{['All', 'Confirmed', 'In production', 'Dispatched', 'Delivered'].map(s => <option key={s}>{s}</option>)}</select>
          <select className="sel" value={region} onChange={e => setRegion(e.target.value)} aria-label="Region"><option value="All">All customers</option>{REGIONS.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}</select>
        </div>
        <Card pad={false}>
          <div className="note" style={{ padding: '8px 14px' }}>{list.length} orders · {fmtT(sum(list.map(o => o.qty)))} · {fmtINR(sum(list.map(o => o.value)))}</div>
          {list.length ? <div className="tbl-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}><table className="tbl">
            <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Product</th><th scope="col">Week</th><th scope="col" className="r">Tonnes</th><th scope="col" className="r">Value</th><th scope="col">Status</th></tr></thead>
            <tbody>{list.slice(0, 200).map(o => <tr key={o.id} className="click" onClick={() => go('product', o.productId)}><td className="num">{o.id}</td><td>{o.customer}</td><td className="nm">{plan.prodById[o.productId].name}</td><td>{wk(o.week)}</td><td className="r num">{fmtT(o.qty)}</td><td className="r num">{fmtINR(o.value)}</td><td><span className="tag">{o.status}</span></td></tr>)}</tbody>
          </table></div> : <Empty>No orders match.</Empty>}
        </Card>
      </> : (
        <Card pad={false}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Order</th><th scope="col">Material</th><th scope="col">Supplier</th><th scope="col" className="r">Amount</th><th scope="col">Placed</th><th scope="col">Arrives</th><th scope="col">Status</th></tr></thead>
            <tbody>{pos.map(p => { const m = plan.matById[p.mat]; return <tr key={p.id} className="click" onClick={() => go('material', m.id)}><td className="num">{p.id}{p.rush && <span className="tag" style={{ marginLeft: 4 }}>Rush</span>}{p.approvedNow && <span className="tag" style={{ marginLeft: 4 }}>New</span>}</td><td className="nm">{m.name}</td><td>{m.supplier}</td><td className="r num">{fmtQty(p.qty, m.unit)}</td><td className="num" style={{ whiteSpace: 'nowrap' }}>{p.placedAt ? fmtWhen(p.placedAt) : <span className="note">earlier</span>}</td><td>{dayLabel(p.dueDay)}</td><td><span className="tag">{p.status}</span></td></tr> })}</tbody>
          </table></div>
        </Card>
      )}
    </>
  )
}
