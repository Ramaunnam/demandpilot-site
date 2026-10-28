import React, { useState } from 'react'
import { HIST, AHEAD, wk, wkRange } from '../data.js'
import { weekView, fmtT, fmtPct, fmtINR } from '../engine.js'
import { useApp, Tile, Card, Info, Icon, DecisionRow, Pill, deadlineText } from '../ui.jsx'
import { TimeChart } from '../charts.jsx'

export default function Command() {
  const { plan, go, data } = useApp()
  const [k, setK] = useState(0)
  const v = weekView(plan, k)
  const kp = plan.kpi
  const top = plan.decisions[0]
  const urgent = plan.decisions.filter(d => d.urgency === 'Urgent')
  const chart = plan.factoryFc.map((t, i) => ({ x: HIST + i, t }))
  const openPOs = plan.allPos.filter(p => p.status !== 'Received')
  const booked = data.orders.filter(o => o.week >= HIST)
  const buyDue = plan.buys.filter(b => b.kind === 'buy' && b.urgency !== 'Watch')
  const label = k === 0 ? 'This week' : k === 1 ? 'Next week' : `In ${k} weeks`

  return (
    <>
      <div className="ph">
        <div>
          <h1>Command Centre</h1>
          <p>Integrated Steelworks · what customers will buy, and what needs a decision.</p>
        </div>
        <div className="weeksel" aria-label="Choose week">
          <button disabled={k === 0} onClick={() => setK(k - 1)} aria-label="Previous week">‹</button>
          <span className="lbl">{label} <small>· {wkRange(HIST + k)}</small></span>
          <button disabled={k === AHEAD - 1} onClick={() => setK(k + 1)} aria-label="Next week">›</button>
        </div>
      </div>

      {!top && <div className="alert calm"><Icon name="check" /><span className="msg"><b>All clear.</b> Every order is placed and every sales change decided. The plan is up to date.</span><button className="btn sm" onClick={() => go('method')}>How this was worked out</button></div>}
      {top && (top.urgency === 'Urgent'
        ? <div className="alert"><Icon name="bolt" /><span className="msg"><b>Today:</b> {top.do.replace(' (rush delivery)', '')} — <b>{top.deadlineDay < 0 ? 'normal order date has passed, rush delivery needed' : deadlineText(top.deadlineDay).t.toLowerCase()}</b>.{urgent.length > 1 && ` ${urgent.length - 1} other urgent item${urgent.length > 2 ? 's' : ''}.`}</span><button className="btn sm pri" onClick={() => go(top.link.page, top.link.id)}>Open</button></div>
        : <div className="alert calm"><Icon name="check" /><span className="msg">Nothing urgent today. Next: {top.name} — {top.do}.</span></div>)}

      <div className="grid g4">
        <Tile k={`Demand · ${label.toLowerCase()}`} light={Math.abs(v.change) > 8 ? 'soon' : 'good'} e={v.ex}
          v={fmtT(v.total)} d={<><span className={v.change >= 0 ? 'up' : 'down'}>{fmtPct(v.change, 1)}</span> vs {k === 0 ? 'last week' : 'the week before'}</>} onClick={() => go('forecast')} />
        <Tile k={`Profit · ${label.toLowerCase()}`} light={v.profitDelta >= 0 ? 'good' : 'urgent'} e={v.profitEx}
          v={fmtINR(v.profit)}
          d={<><span className={v.profitDelta >= 0 ? 'up' : 'down'}>{v.profitDelta >= 0 ? '▲' : '▼'} {fmtINR(Math.abs(v.profitDelta))}</span> {v.profitDelta >= 0 ? 'more' : 'less'} than {k === 0 ? 'last week' : 'the week before'}</>}
          onClick={() => go('products')} />
        <Tile k="Supply · materials running out" light={kp.matsAtRisk ? 'urgent' : 'good'} tone={kp.matsAtRisk ? 'red' : 'green'} e={plan.explain.matsAtRisk}
          v={`${kp.matsAtRisk}`} small={`of ${plan.materials.length}`} d={kp.matsAtRisk ? plan.materials.filter(m => m.urgency === 'Urgent').map(m => m.name).join(', ') + ' — before new supply arrives' : 'Every material lasts until new supply arrives'} onClick={() => go('materials')} />
        <Tile k="Money · to buy now" light={kp.toSpend > 0 ? 'soon' : 'good'} e={plan.explain.toSpend}
          v={fmtINR(kp.toSpend)} d={<>{fmtINR(kp.toFree)} can be freed <Info e={plan.explain.toFree} right /></>} onClick={() => go('buy')} />
      </div>

      <div className="grid g-cc">
        <Card title="Expected sales, week by week" sub="All products · click a bar to pick a week"
          right={<button className="btn sm" onClick={() => go('forecast')}>Full forecast <Icon name="arrow" size={13} /></button>}>
          <TimeChart data={chart} height={210} series={[{ key: 't', kind: 'bar', color: 'var(--navy)', label: 'Expected sales' }]}
            selected={HIST + k} onPick={(d) => setK(d.x - HIST)} />
          <div className="movers" style={{ marginTop: 12 }}>
            <div>
              <div className="mv-h">Going up · {label.toLowerCase()} vs same week last year</div>
              {v.up.length ? v.up.slice(0, 3).map(x => <div className="mv" key={x.p.id}><button onClick={() => go('product', x.p.id)}>{x.p.name}</button><span className="up num">+{fmtT(x.delta)} ({fmtPct(x.pct)})</span></div>)
                : <div className="note" style={{ paddingTop: 6 }}>Nothing above last year this week.</div>}
            </div>
            <div>
              <div className="mv-h">Going down</div>
              {v.down.length ? v.down.slice(0, 3).map(x => <div className="mv" key={x.p.id}><button onClick={() => go('product', x.p.id)}>{x.p.name}</button><span className="down num">−{fmtT(Math.abs(x.delta))} ({fmtPct(x.pct)})</span></div>)
                : <div className="note" style={{ paddingTop: 6 }}>Nothing below last year this week.</div>}
            </div>
          </div>
        </Card>

        <Card title="Act now" sub={`${plan.decisions.length} waiting · most urgent first`} right={<button className="btn sm ghost" onClick={() => go('decisions')}>See all <Icon name="arrow" size={13} /></button>}>
          <div className="dlist compact">
            {plan.decisions.length
              ? plan.decisions.slice(0, 5).map(d => <DecisionRow key={d.id} d={d} compact />)
              : <div className="empty">Nothing waiting. <button className="link" onClick={() => go('decisions')}>See what was decided</button></div>}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <button className="card tile" onClick={() => go('buy')}>
          <div className="k"><Icon name="cart" size={14} />Buy</div>
          <div className="v">{buyDue.length}<small>orders to approve</small></div>
          <div className="d">{buyDue.filter(b => b.late).length} need rush delivery · {fmtINR(kp.toSpend)} in total</div>
        </button>
        <button className="card tile" onClick={() => go('orders')}>
          <div className="k"><Icon name="file" size={14} />Orders</div>
          <div className="v">{booked.length}<small>customer orders booked ahead</small></div>
          <div className="d">{fmtT(booked.reduce((s, o) => s + o.qty, 0))} to deliver · {openPOs.length} material orders on the way</div>
        </button>
      </div>
    </>
  )
}
