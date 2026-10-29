import React from 'react'
import { HIST, SIGNALS, wk, fmtWhen } from '../data.js'
import { sum, fmtT, fmtPct, fmtINR } from '../engine.js'
import { useApp, Head, Card, Tile, Seg, Pill, Empty, Icon, useViewState } from '../ui.jsx'
import { TimeChart, Legend } from '../charts.jsx'

// What a decision means, in the planner's words, and the colour that goes with it.
const STATE = {
  open: { pill: 'Watch', label: 'Waiting for you' },
  real: { pill: 'Good', label: 'Planned for' },
  oneoff: { pill: 'Info', label: 'Ignored as a one-off' },
  check: { pill: 'Soon', label: 'With the sales team' },
}

// When a change was decided, from the trail of what the planner did.
const decidedAt = (activity, id) => (activity ?? []).find(e => e.link?.page === 'changes' && e.link?.id === id)?.when ?? null

function ChangeCard({ c, open, onToggle }) {
  const { plan, data, act, go, state } = useApp()
  const keys = new Set(c.items.map(i => i.key))
  const raw = new Array(HIST).fill(0).map((_, t) => sum([...keys].map(k => data.sales[k][t])))
  const chart = []
  for (let t = HIST - 26; t < HIST; t++) {
    chart.push({ x: t, actual: raw[t], before: t >= HIST - 6 ? sum(c.items.map(i => i.baseFc[t - (HIST - 6)])) : null })
  }
  const st = STATE[c.status] ?? STATE.open
  const money = Math.abs(c.extraWk) * 12 * (plan.prodById[c.items[0].productId]?.price ?? 0)
  const when = decidedAt(state.activity, c.id)

  return (
    <div className={`card chg ${c.status}`}>
      <div className="card-h">
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <Pill u={st.pill}>{st.label}</Pill>
            <h3 style={{ margin: 0 }}>{c.title}</h3>
          </div>
          <div className="sub">
            {c.headline} since {wk(c.start)} ·{' '}
            <b className={c.dir > 0 ? 'up' : 'down'}>{c.extraWk > 0 ? '+' : '−'}{fmtT(Math.abs(c.extraWk))} a week</b>
            {' '}· worth about {fmtINR(money)} over 12 weeks · {c.conf}% sure
          </div>
        </div>
        <button className="btn sm" onClick={onToggle} aria-expanded={open}>{open ? 'Hide working' : 'Show working'}</button>
      </div>

      <div className="card-b">
        <p className="chg-why"><b>Why it may have happened:</b> {c.why}</p>

        {open && <>
          <TimeChart data={chart} today={HIST} height={200} todayLabel="Now"
            label={`Weekly sales for ${c.title}`}
            series={[
              { key: 'actual', kind: 'bar', color: 'var(--navy)', label: 'Actual sales' },
              { key: 'before', kind: 'line', color: 'var(--urgent)', dash: '4 3', label: 'What we expected', width: 2 },
            ]} />
          <div style={{ margin: '8px 0 14px' }}>
            <Legend items={[{ label: 'Actual sales', color: 'var(--navy)' }, { label: 'What we expected before it moved', color: 'var(--urgent)' }]} />
          </div>

          <div className="grid g2">
            <div>
              <div className="chg-h">What makes us think so</div>
              <div className="ev"><span className="ic y">✓</span>
                {c.items.length} product{c.items.length > 1 ? 's' : ''} moved the same way, {Math.abs(c.pct).toFixed(0)}% {c.dir > 0 ? 'above' : 'below'} what we expected
              </div>
              <div className="ev"><span className={`ic ${c.signal ? 'y' : 'n'}`}>{c.signal ? '✓' : '–'}</span>
                {c.signal ? <>Market news: {c.signal.title}</> : 'No market news explains it'}
              </div>
              <div className="ev"><span className={`ic ${c.ordersAgree ? 'y' : 'n'}`}>{c.ordersAgree ? '✓' : '–'}</span>
                {c.orders
                  ? <>Customer orders went {fmtT(c.orders.before)} → {fmtT(c.orders.during)} a week, from {c.orders.customers} customer{c.orders.customers === 1 ? '' : 's'}{c.orders.top ? ` (biggest: ${c.orders.top})` : ''}</>
                  : 'Not enough order history to tell'}
              </div>
            </div>
            <div>
              <div className="chg-h">Products that moved</div>
              <div className="tbl-wrap"><table className="tbl">
                <thead><tr><th scope="col">Product</th><th scope="col" className="r">Was</th><th scope="col" className="r">Now</th></tr></thead>
                <tbody>
                  {c.items.map(i => {
                    const p = plan.prodById[i.productId]
                    return (
                      <tr key={i.key} className="click" onClick={() => go('product', p.id)}>
                        <td className="nm">{p.name}</td>
                        <td className="r num note">{fmtT(i.beforeWk)}</td>
                        <td className={`r num ${i.nowWk >= i.beforeWk ? 'up' : 'down'}`}>{fmtT(i.nowWk)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            </div>
          </div>
        </>}

        {c.status === 'open' ? (
          <div className="chg-ask">
            <div className="chg-q">What should the forecast do about it?</div>
            <div className="row">
              <button className="btn sm pri" onClick={() => act.decideChange(c, 'real')}>
                <Icon name="check" size={13} />Plan for it
              </button>
              <button className="btn sm" onClick={() => act.decideChange(c, 'oneoff')}>Ignore — a one-off</button>
              <button className="btn sm ghost" onClick={() => act.decideChange(c, 'check')}>Ask the sales team</button>
            </div>
            <div className="note chg-hint">
              <b>Plan for it</b> moves the forecast to the new level, so the make plan and the buying list follow.
              {' '}<b>Ignore</b> leaves the forecast where it was.
            </div>
          </div>
        ) : (
          <div className={`chg-done ${c.status}`}>
            <Icon name={c.status === 'real' ? 'check' : c.status === 'oneoff' ? 'x' : 'bolt'} size={15} />
            <div className="chg-done-t">
              {c.status === 'real' && <>
                <b>Planned for.</b> The forecast now follows the new level — {c.extraWk > 0 ? '+' : '−'}{fmtT(Math.abs(c.extraWk))} a week
                across {c.items.length} product{c.items.length > 1 ? 's' : ''}, and the make plan and buying list have moved with it.
              </>}
              {c.status === 'oneoff' && <>
                <b>Ignored.</b> Those weeks are treated as unusual, so the forecast stays where it was.
              </>}
              {c.status === 'check' && <>
                <b>With the sales team.</b> Nothing has changed in the plan while you wait to hear back.
              </>}
              {when && <div className="note">Decided {fmtWhen(when)}</div>}
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              {c.status === 'real' && <button className="btn sm" onClick={() => go('plan')}>See the plan</button>}
              <button className="btn sm" onClick={() => go('forecast')}>Forecast</button>
              <button className="btn sm ghost" onClick={() => act.decideChange(c, 'open')}>Undo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Changes({ id }) {
  const { plan, act, go } = useApp()
  const [tab, setTab] = useViewState('changes.tab', 'sales')
  const [openId, setOpenId] = useViewState('changes.open', null)
  const shown = id ?? openId ?? plan.changes[0]?.id
  // arriving with one change in the address shows just that change, opened
  const only = id ? plan.changes.filter(c => c.id === id) : plan.changes

  const waiting = plan.changes.filter(c => c.status === 'open')
  const planned = plan.changes.filter(c => c.status === 'real')
  const ignored = plan.changes.filter(c => c.status === 'oneoff')
  const asking = plan.changes.filter(c => c.status === 'check')
  const oneOffOpen = plan.oneOffs.filter(o => o.status !== 'oneoff')

  const seenInSales = (s) => plan.changes.find(c => c.signal?.id === s.id || c.signals?.some(x => x.id === s.id))
  const market = [...SIGNALS].sort((a, b) => b.week - a.week)

  return (
    <>
      <Head backLink title="What changed"
        sub="Sales that have moved to a new level, and news from the market that may move them next. Nothing changes the plan until you decide." />

      <div className="grid g4">
        <Tile k="Waiting for you" v={`${waiting.length + oneOffOpen.length}`} tone={waiting.length ? 'amber' : undefined}
          d={`${waiting.length} sales change${waiting.length === 1 ? '' : 's'} · ${oneOffOpen.length} odd week${oneOffOpen.length === 1 ? '' : 's'}`}
          onClick={() => setTab('sales')} />
        <Tile k="Planned for" v={`${planned.length}`} tone={planned.length ? 'green' : undefined}
          d={planned.length ? `${fmtT(sum(planned.map(c => Math.abs(c.extraWk))))} a week now in the plan` : 'none accepted yet'}
          onClick={() => go('plan')} />
        <Tile k="Ignored" v={`${ignored.length}`} d="treated as one-off, forecast unchanged" />
        <Tile k="Market signals" v={`${SIGNALS.length}`} d="news, prices and supplier notices" onClick={() => setTab('market')} />
      </div>

      <Seg value={tab} onChange={setTab} label="What to look at"
        options={[
          { v: 'sales', l: 'In our sales', c: plan.changes.length + plan.oneOffs.length },
          { v: 'market', l: 'In the market', c: SIGNALS.length },
        ]} />

      {tab === 'sales' ? <>
        <Card title="Sales that moved to a new level"
          sub="Several weeks in a row above or below what we expected — and still there this week. Your choice drives the forecast, the make plan and the buying list.">
          {id && plan.changes.length > 1 && (
            <div className="row between chg-only">
              <span className="note">Showing one sales change.</span>
              <button className="btn sm" onClick={() => go('changes')}>Show all {plan.changes.length}</button>
            </div>
          )}
          {only.length
            ? <div className="chg-list">
              {only.map(c => (
                <ChangeCard key={c.id} c={c} open={shown === c.id}
                  onToggle={() => setOpenId(shown === c.id ? '' : c.id)} />
              ))}
            </div>
            : <Empty>No sales change right now. Every product is selling close to its forecast.</Empty>}
        </Card>

        <Card title="Single unusual weeks"
          sub="One week far from normal, then straight back. Usually one big order, or a customer pausing — not a change of level." pad={false}>
          {plan.oneOffs.length ? (
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr>
                <th scope="col">Product</th><th scope="col">Week</th>
                <th scope="col" className="r">Expected</th><th scope="col" className="r">Actually sold</th>
                <th scope="col">Likely reason</th><th scope="col">Use it in the forecast?</th>
              </tr></thead>
              <tbody>
                {plan.oneOffs.map(o => (
                  <tr key={o.id}>
                    <td className="nm">
                      <button className="link" onClick={() => go('product', o.productId)}>{o.product.name}</button>
                      <small>{o.region} customers</small>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{wk(o.t)}</td>
                    <td className="r num note">{fmtT(o.expected)}</td>
                    <td className={`r num ${o.pct > 0 ? 'up' : 'down'}`}>{fmtT(o.actual)} ({fmtPct(o.pct)})</td>
                    <td>{o.why}</td>
                    <td>
                      <Seg value={o.status === 'oneoff' ? 'oneoff' : 'open'} label="Use this week in the forecast"
                        onChange={(v) => act.decideChange({ id: o.id, title: `${o.product.name}, ${wk(o.t)}` }, v)}
                        options={[{ v: 'open', l: 'Keep it' }, { v: 'oneoff', l: 'Leave it out' }]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <Empty>No odd weeks in the last ten.</Empty>}
          <div className="note" style={{ padding: '10px 16px' }}>
            <b>Keep it</b> leaves the week in the history the forecast learns from.
            {' '}<b>Leave it out</b> replaces it with what was expected, so one freak week does not drag the forecast.
          </div>
        </Card>
      </> : (
        <Card title="News and notices" sub="What the market feeds are saying, newest first. The forecast already allows for anything not yet visible in our own sales." pad={false}>
          <div className="mkt">
            {market.map(s => {
              const change = s.grades ? seenInSales(s) : null
              const mats = s.materials ?? []
              return (
                <div key={s.id} className="mkt-row">
                  <span className="bar" style={{ background: s.kind === 'Price' ? 'var(--soon)' : s.kind === 'Supplier notice' ? 'var(--urgent)' : 'var(--watch)' }} />
                  <div className="mkt-main">
                    <div className="t1">
                      <span className="tag">{s.kind}</span>
                      <b>{s.title}</b>
                    </div>
                    <div className="why">
                      <b>Affects:</b>{' '}
                      {s.grades
                        ? <>{s.grades.join(', ')} steel{s.regions.length ? ` · ${s.regions.join(', ')} customers` : ' · all regions'} · expected effect {fmtPct(s.effect)} on sales</>
                        : <>{mats.map((m, i) => (
                          <React.Fragment key={m}>
                            {i > 0 && ', '}
                            <button className="link" onClick={() => go('material', m)}>{plan.matById[m]?.name ?? m}</button>
                          </React.Fragment>
                        ))}{s.effect ? ` · price ${fmtPct(s.effect)}` : ' · deliveries may run late'}</>}
                    </div>
                    <div className="why">
                      <b>So what:</b>{' '}
                      {s.grades
                        ? (change
                          ? 'It is already showing in our own sales — decide it under "In our sales".'
                          : 'Not in our sales yet. The forecast adds a small lift for it until it shows up.')
                        : s.kind === 'Price'
                          ? 'Changes what we pay for this material, and so the margin on the steel that uses it.'
                          : 'Delivery may take longer than usual — check the order-by dates.'}
                    </div>
                  </div>
                  <div className="mkt-side">
                    <span className="note">{wk(s.week)} · {Math.round(s.conf * 100)}% reliable</span>
                    {s.grades
                      ? (change
                        ? <button className="btn sm" onClick={() => { setTab('sales'); setOpenId(change.id); go('changes', change.id) }}>See the change</button>
                        : <Pill u="Info">Not seen yet</Pill>)
                      : <button className="btn sm" onClick={() => go('material', mats[0])}>Open material</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </>
  )
}
