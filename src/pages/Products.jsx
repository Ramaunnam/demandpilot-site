import React, { useState } from 'react'
import { fmtT, fmtPct, fmtINR, daysText } from '../engine.js'
import { useApp, Head, Seg, Pill, Card, Tile, useViewState } from '../ui.jsx'
import { Spark } from '../charts.jsx'
import { HIST } from '../data.js'

export default function Products() {
  const { plan, go } = useApp()
  const families = [...new Set(plan.products.map(p => p.family))]
  const [fam, setFam] = useViewState('products.group', 'All')
  const [urg, setUrg] = useViewState('products.urgency', 'All')
  const [q, setQ] = useViewState('products.search', '')
  const list = plan.products.filter(p => (fam === 'All' || p.family === fam) && (urg === 'All' || p.urgency === urg || (urg === 'Changed' && p.change)) && p.name.toLowerCase().includes(q.toLowerCase()))
  const cnt = (u) => plan.products.filter(p => u === 'Changed' ? p.change : p.urgency === u).length
  return (
    <>
      <Head title="Products" sub={`All ${plan.products.length} products this site makes. Click one to see everything about it.`} />
      <div className="grid g3">
        <Tile k="Products" v={`${plan.products.length}`} d={`${families.length} product groups`} onClick={() => { setUrg('All'); setFam('All') }} />
        <Tile k="Need more production" v={`${cnt('Urgent') + cnt('Soon')}`} tone={cnt('Urgent') ? 'red' : undefined} d={`${cnt('Urgent')} urgent · ${cnt('Soon')} soon`} onClick={() => setUrg('Soon')} />
        <Tile k="Sales changed" v={`${cnt('Changed')}`} d="sales moved to a new level" onClick={() => setUrg('Changed')} />
      </div>
      <div className="filters">
        <input className="inp" placeholder="Search products" value={q} onChange={e => setQ(e.target.value)} aria-label="Search products" />
        <select className="sel" value={fam} onChange={e => setFam(e.target.value)} aria-label="Product group"><option value="All">All product groups</option>{families.map(f => <option key={f}>{f}</option>)}</select>
        <Seg value={urg} onChange={setUrg} options={[{ v: 'All', l: 'All' }, { v: 'Urgent', l: 'Urgent', c: cnt('Urgent') }, { v: 'Soon', l: 'Soon', c: cnt('Soon') }, { v: 'Changed', l: 'Sales changed', c: cnt('Changed') }, { v: 'OK', l: 'All good', c: cnt('OK') }]} />
      </div>
      <Card pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Product</th><th scope="col">Status</th><th scope="col">Last 26 weeks</th><th scope="col" className="r">Next 4 wks /wk</th><th scope="col" className="r">vs now</th><th scope="col" className="r">In stock</th><th scope="col" className="r">Lasts</th><th scope="col" className="r">Sales 12 wks</th></tr></thead>
          <tbody>{list.map(p => (
            <tr key={p.id} className="click" onClick={() => go('product', p.id)}>
              <td className="nm">{p.name}<small>{p.use}</small></td>
              <td><Pill u={p.urgency} />{p.change && <span className="tag" style={{ marginLeft: 4 }}>Sales {p.change.dir > 0 ? 'up' : 'down'}</span>}</td>
              <td><Spark values={p.hist.slice(HIST - 26)} /></td>
              <td className="r num">{fmtT(p.weekly)}</td>
              <td className={`r num ${p.weekly >= p.recent4 ? 'up' : 'down'}`}>{fmtPct((p.weekly / p.recent4 - 1) * 100)}</td>
              <td className="r num">{fmtT(p.onHand)}</td>
              <td className="r num">{daysText(p.daysLeft)}</td>
              <td className="r num">{fmtINR(p.value12)}</td>
            </tr>))}</tbody>
        </table></div>
        {!list.length && <div className="empty">No products match.</div>}
      </Card>
    </>
  )
}
