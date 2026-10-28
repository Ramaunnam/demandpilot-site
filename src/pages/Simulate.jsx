import React, { useState } from 'react'
import { useApp, Head, Card } from '../ui.jsx'
import { WhatIfBox } from './Product.jsx'

export default function Simulate({ id }) {
  const { plan, go } = useApp()
  const [pid, setPid] = useState(plan.prodById[id] ? id : plan.products.find(p => p.grade === '316L')?.id ?? plan.products[0].id)
  const p = plan.prodById[pid]
  return (
    <>
      <Head title="What if" sub="Pick a product and change its sales to see the effect on stock, materials, the factory and money." />
      <div className="filters">
        <label htmlFor="sim-p">Product</label>
        <select id="sim-p" className="sel" value={pid} onChange={e => setPid(e.target.value)}>{plan.products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <button className="btn sm" onClick={() => go('product', pid)}>Open product</button>
      </div>
      <Card title={p.name} sub={p.use}><WhatIfBox key={pid} p={p} /></Card>
      <p className="note">Nothing here changes the real plan. To change the plan, accept a sales change on "What changed".</p>
    </>
  )
}
