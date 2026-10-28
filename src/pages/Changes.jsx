import React, { useState } from 'react'
import { HIST, SIGNALS, wk } from '../data.js'
import { sum, fmtT, fmtPct } from '../engine.js'
import { useApp, Head, Card, Seg, Pill, Empty } from '../ui.jsx'
import { TimeChart } from '../charts.jsx'

const STATUS = { open: 'Waiting for decision', real: 'Accepted as real', oneoff: 'Treated as one-off', check: 'Checking with sales' }

function ChangeCard({ c, open, onToggle }) {
  const { plan, data, act, go } = useApp()
  const keys = new Set(c.items.map(i => i.key))
  const raw = new Array(HIST).fill(0).map((_, t) => sum([...keys].map(k => data.sales[k][t])))
  const chart = []
  for (let t = HIST - 26; t < HIST; t++) chart.push({ x: t, actual: raw[t], before: t >= HIST - 6 ? sum(c.items.map(i => i.baseFc[t - (HIST - 6)])) : null })
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="row"><Pill u={c.status === 'open' ? 'Watch' : 'OK'}>{STATUS[c.status]}</Pill><h3 style={{ margin: 0 }}>{c.title}</h3></div>
          <div className="sub">{c.headline} since {wk(c.start)} · <b className={c.dir > 0 ? 'up' : 'down'}>{c.extraWk > 0 ? '+' : '−'}{fmtT(Math.abs(c.extraWk))} a week</b> · {c.conf}% sure</div>
        </div>
        <button className="btn sm" onClick={onToggle}>{open ? 'Hide' : 'Show details'}</button>
      </div>
      <div className="card-b">
        <p style={{ margin: '0 0 8px' }}><b>Why:</b> {c.why}</p>
        {open && <>
          <TimeChart data={chart} today={HIST} height={190} todayLabel="Now" series={[
            { key: 'actual', kind: 'bar', color: 'var(--navy)', label: 'Actual sales' },
            { key: 'before', kind: 'line', color: 'var(--urgent)', dash: '4 3', label: 'What we expected', width: 2 },
          ]} />
          <div className="grid g2" style={{ marginTop: 10 }}>
            <div>
              <div className="note" style={{ fontWeight: 700, marginBottom: 4 }}>Evidence</div>
              <div className="ev"><span className="ic y">✓</span>{c.items.length} product{c.items.length > 1 ? 's' : ''} moved the same way, {Math.abs(c.pct).toFixed(0)}% {c.dir > 0 ? 'above' : 'below'} what we expected</div>
              <div className="ev"><span className={`ic ${c.signal ? 'y' : 'n'}`}>{c.signal ? '✓' : '–'}</span>{c.signal ? `Market news: ${c.signal.title}` : 'No market news explains it'}</div>
              <div className="ev"><span className={`ic ${c.ordersAgree ? 'y' : 'n'}`}>{c.ordersAgree ? '✓' : '–'}</span>{c.orders ? `Customer orders: ${fmtT(c.orders.before)} → ${fmtT(c.orders.during)} a week, from ${c.orders.customers} customers${c.orders.top ? ` (biggest: ${c.orders.top})` : ''}` : 'Not enough order history'}</div>
            </div>
            <div>
              <div className="note" style={{ fontWeight: 700, marginBottom: 4 }}>Products</div>
              {c.items.map(i => { const p = plan.prodById[i.productId]; return (
                <div key={i.key} className="row between" style={{ padding: '3px 0' }}>
                  <button className="link" onClick={() => go('product', p.id)}>{p.name}</button>
                  <span className="num note">{fmtT(i.beforeWk)} → {fmtT(i.nowWk)} /wk</span>
                </div>) })}
            </div>
          </div>
        </>}
        <div className="row" style={{ marginTop: 10 }}>
          <span className="note">What should the forecast do?</span>
          <button className={`btn sm ${c.status === 'real' ? 'pri' : ''}`} onClick={() => act.decideChange(c, 'real')}>Real change — plan for it</button>
          <button className={`btn sm ${c.status === 'oneoff' ? 'pri' : ''}`} onClick={() => act.decideChange(c, 'oneoff')}>One-off — ignore it</button>
          <button className={`btn sm ${c.status === 'check' ? 'pri' : ''}`} onClick={() => act.decideChange(c, 'check')}>Check with sales</button>
          {c.status !== 'open' && <button className="btn sm ghost" onClick={() => act.decideChange(c, 'open')}>Undo</button>}
        </div>
      </div>
    </div>
  )
}

export default function Changes({ id }) {
  const { plan, act, go } = useApp()
  const [tab, setTab] = useState('sales')
  const [openId, setOpenId] = useState(id ?? plan.changes[0]?.id)
  const seenInSales = (s) => plan.changes.some(c => c.signal?.id === s.id || c.signals?.some(x => x.id === s.id))
  const market = [...SIGNALS].sort((a, b) => b.week - a.week)

  return (
    <>
      <Head title="What changed" sub="Changes in our own sales, and news from the market that may change them." />
      <Seg value={tab} onChange={setTab} options={[{ v: 'sales', l: 'In our sales', c: plan.changes.length + plan.oneOffs.length }, { v: 'market', l: 'In the market', c: SIGNALS.length }]} />
      {tab === 'sales' ? <>
        <h3 style={{ margin: '4px 0 0' }}>Sales that moved to a new level</h3>
        <p className="note" style={{ margin: 0 }}>Several weeks in a row above or below what we expected. Decide if it is real — the forecast, production plan and buying all follow your choice.</p>
        {plan.changes.length ? plan.changes.map(c => <ChangeCard key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />) : <Empty>No sales changes right now.</Empty>}
        <Card title="Single unusual weeks" sub="One week far from normal, then back. Usually a one-off order." pad={false}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th scope="col">Product</th><th scope="col">Week</th><th scope="col" className="r">Expected</th><th scope="col" className="r">Actual</th><th scope="col">Likely reason</th><th scope="col">Decision</th></tr></thead>
            <tbody>{plan.oneOffs.map(o => (
              <tr key={o.id}>
                <td><button className="link" onClick={() => go('product', o.productId)}>{o.product.name}</button><div className="note">{o.region} customers</div></td>
                <td>{wk(o.t)}</td><td className="r num">{fmtT(o.expected)}</td>
                <td className={`r num ${o.pct > 0 ? 'up' : 'down'}`}>{fmtT(o.actual)} ({fmtPct(o.pct)})</td>
                <td>{o.why}</td>
                <td><Seg value={o.status} onChange={(v) => act.decideChange({ id: o.id, title: o.product.name + ', ' + wk(o.t) }, v)} options={[{ v: 'oneoff', l: 'Ignore' }, { v: 'open', l: 'Keep' }]} /></td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      </> : (
        <div className="dlist">
          {market.map(s => { const seen = s.grades ? seenInSales(s) : null; return (
            <div key={s.id} className="drow">
              <span className="bar" style={{ background: s.kind === 'Price' ? 'var(--soon)' : s.kind === 'Supplier notice' ? 'var(--urgent)' : 'var(--watch)' }} />
              <div className="main-c">
                <div className="t1"><span className="tag">{s.kind}</span><b>{s.title}</b></div>
                <div className="why">
                  {s.grades ? <>Affects {s.grades.join(', ')} steel{s.regions.length ? ` · ${s.regions.join(', ')} customers` : ''} · expected effect {fmtPct(s.effect)} on sales</> :
                    <>Affects {s.materials.map(m => plan.matById[m].name).join(', ')}{s.effect ? ` · price ${fmtPct(s.effect)}` : ' · deliveries may be late'}</>}
                </div>
                <div className="why"><b>So what:</b> {s.grades ? (seen ? 'Already showing in our sales — see "In our sales".' : 'Not yet seen in sales. The forecast adds a small lift for it.') : s.kind === 'Price' ? 'Changes what we pay for this material.' : 'Delivery times may be longer; check order dates.'}</div>
              </div>
              <div className="side-c">
                <span className="note">{wk(s.week)} · {Math.round(s.conf * 100)}% reliable</span>
                {s.grades ? (seen ? <Pill u="Watch">Seen in sales</Pill> : <Pill u="Info">Not seen yet</Pill>)
                  : <button className="btn sm" onClick={() => go('material', s.materials[0])}>Open material</button>}
              </div>
            </div>) })}
        </div>
      )}
    </>
  )
}
