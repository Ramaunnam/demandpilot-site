import React from 'react'
import { HIST, AHEAD, SITE, REGIONS, MATERIALS, LINES, SIGNALS, wk, wkYear } from '../data.js'
import { sum, fmtT, fmtPct, fmtINR, daysText } from '../engine.js'
import { useApp, Head, Card, Tile, Pill } from '../ui.jsx'

const Step = ({ n, title, children }) => (
  <div className="pipe-row">
    <span className="pipe-no">{n}</span>
    <div><b>{title}</b><div className="note">{children}</div></div>
  </div>
)

export default function Method() {
  const { plan, data, go, openSettings, state } = useApp()
  const kp = plan.kpi
  const p = plan.prodById['316L-CR-1'] ?? plan.products[0]
  const m = plan.matById['MO'] ?? plan.materials[0]
  const c = plan.changes[0]
  const totalMake = sum(plan.products.map(x => sum(x.make)))
  const groups = [...new Set(plan.products.map(x => x.family))]   // the 12 product groups, named once in data.js

  return (
    <>
      <Head title="How it works"
        sub="Every number on every screen comes from one calculation, run on two years of weekly sales. This page is that calculation, in order, with today's figures in it." />

      <div className="grid g4">
        <Tile k="Sales history read" v={`${HIST}`} small="weeks" d={`${plan.products.length} products × ${REGIONS.length} regions = ${plan.products.length * REGIONS.length} weekly series`} />
        <Tile k="Forecast accuracy" v={`${(kp.acc * 100).toFixed(1)}%`} e={plan.explain.accuracy} tone="green" d={`the old 12-week average scores ${(kp.accOld * 100).toFixed(1)}%`} onClick={() => go('forecast')} />
        <Tile k="Decisions it produced" v={`${kp.waiting}`} e={plan.explain.waiting} d={`${kp.urgent} urgent · ${kp.soon} soon`} onClick={() => go('decisions')} />
        <Tile k="Money in view" v={fmtINR(kp.stockValue + kp.fgValue)} e={plan.explain.stockValue} d="raw material plus finished steel in stock" onClick={() => go('materials')} />
      </div>

      <Card title="The site" sub="One works, modelled end to end">
        <div className="prose">
          <p>
            <b>{SITE.name}</b> makes {SITE.what.toLowerCase()}. It sells {plan.products.length} products in {groups.length} groups —
            {' '}{groups.slice(0, 4).join(', ')}, and {groups.length - 4} more — each made in three gauges, to customers
            in {REGIONS.length} regions. Making them consumes {MATERIALS.length} raw materials through {LINES.length} production lines.
          </p>
          <p>
            Today is <b>{wkYear(HIST)}</b>, two days into the planning week. The app looks back {HIST} weeks
            and forward {AHEAD} weeks. Everything below is worked out from that, in one pass, every time you change a decision.
          </p>
        </div>
        <div className="facts" style={{ marginTop: 12 }}>
          <div className="fact"><span className="k">Products</span><span className="v">{plan.products.length}</span><span className="s">{groups.length} product groups × 3 gauges</span></div>
          <div className="fact"><span className="k">Raw materials</span><span className="v">{MATERIALS.length}</span><span className="s">metals, chemicals, packaging</span></div>
          <div className="fact"><span className="k">Production lines</span><span className="v">{LINES.length}</span><span className="s">melting through to packing</span></div>
          <div className="fact"><span className="k">Customer orders</span><span className="v">{data.orders.length}</span><span className="s">past 8 weeks + next 4</span></div>
          <div className="fact"><span className="k">Market signals</span><span className="v">{SIGNALS.length}</span><span className="s">news, prices, supplier notices</span></div>
          <div className="fact"><span className="k">Sales a week</span><span className="v">{fmtT(kp.lastWeek)}</span><span className="s">last week, all products</span></div>
        </div>
      </Card>

      <Card title="The calculation, in order" sub="Each step feeds the next. Click a step to open the screen that shows it.">
        <div className="pipe">
          <Step n="1" title={`Find what changed — ${plan.changes.length} sales changes, ${plan.oneOffs.length} one-off weeks`}>
            Each of the {plan.products.length * REGIONS.length} weekly series is compared with what the model expected.
            A single odd week is a <b>one-off</b>; several weeks in a row on the same side are a <b>change of level</b>.
            {' '}<button className="link" onClick={() => go('changes')}>What changed →</button>
          </Step>
          <Step n="2" title={`Forecast each product and region — ${fmtT(kp.next12)} over ${AHEAD} weeks`}>
            Holt-Winters with a 52-week season learns the level, the growth and the shape of the year, then market news
            that sales have not shown yet is added on top.
            {' '}<button className="link" onClick={() => go('forecast')}>Forecast →</button>
          </Step>
          <Step n="3" title={`Work out stock cover — ${plan.products.filter(x => x.urgency !== 'OK').length} products need more production`}>
            For every product: safety stock from its own forecast error, a reorder level, and a week-by-week stock projection.
            {' '}<button className="link" onClick={() => go('products')}>Products →</button>
          </Step>
          <Step n="4" title={`Turn that into a make plan — ${fmtT(totalMake)} to produce`}>
            Forecast plus the top-up needed to reach target stock, spread over six weeks, then checked against what each
            line can actually do. {kp.overWeeks ? `${kp.overWeeks} week is over capacity.` : 'No week is over capacity.'}
            {' '}<button className="link" onClick={() => go('plan')}>Plan & MRP →</button>
          </Step>
          <Step n="5" title={`Explode the recipe — ${MATERIALS.length} materials netted off stock`}>
            Make plan × the amount of each material per tonne, less what is in stock and what is already on the way.
            {' '}<button className="link" onClick={() => go('materials')}>Materials →</button>
          </Step>
          <Step n="6" title={`Decide what to buy — ${plan.buys.filter(b => b.kind === 'buy').length} orders, ${fmtINR(kp.toSpend)} due now`}>
            Each shortage becomes one order, sized to cover the delivery window and rounded to the supplier's lot size,
            with the last safe order date. {plan.buys.filter(b => b.kind === 'cut').length ? `${plan.buys.filter(b => b.kind === 'cut').length} material is overstocked, so ${fmtINR(kp.toFree)} can be freed instead.` : ''}
            {' '}<button className="link" onClick={() => go('buy')}>Buy →</button>
          </Step>
          <Step n="7" title={`Rank it for a person — ${kp.waiting} decisions, most urgent first`}>
            Orders, extra production, sales changes and busy weeks all land in one list, sorted by how soon each must be
            decided and how much money rides on it.
            {' '}<button className="link" onClick={() => go('decisions')}>Decisions →</button>
          </Step>
          <Step n="8" title="Explain every headline number">
            Each ⓘ rebuilds its number from the same inputs the screen used, so the explanation cannot drift from the figure.
          </Step>
        </div>
      </Card>

      <div className="grid g2">
        <Card title="How the forecast works" sub="Holt-Winters, additive growth, 52-week season">
          <div className="prose">
            <p>Three things are tracked for each product and region, and updated every week:</p>
            <div className="kv">
              <span><b>Level</b> — roughly how much sells in a normal week</span><span>α 0.30</span>
              <span><b>Growth</b> — how the level drifts year on year</span><span>β 0.02</span>
              <span><b>Season</b> — how each of the 52 weeks differs from normal</span><span>γ 0.06</span>
            </div>
            <div className="formula">forecast(week k) = (level + k × growth) × season(week k)</div>
            <p>
              For <b>{p.name}</b> right now: season says this week runs {fmtPct(p.drivers.season * 100, 1)} against the
              year's average, the long-term growth is {fmtPct(p.drivers.trend * 100, 1)} a year, and market news adds
              {' '}{fmtPct(p.drivers.news, 1)}. Those give {fmtT(p.weekly)} a week against {fmtT(p.recent4)} actually sold
              over the last four weeks.
            </p>
            <p>
              The shaded band on every chart is the <b>likely range</b>: 8 weeks in 10 should land inside it. It comes from
              how wrong this series' own forecasts have been over the last 26 weeks, and it widens the further ahead it goes.
            </p>
            <p>
              <b>Accuracy is measured honestly.</b> Each of the last 12 weeks is forecast using only the weeks before it,
              then compared with what really sold: {fmtT(sum(plan.products.map(x => x.err)))} of total miss
              on {fmtT(sum(plan.products.map(x => x.tot)))} of sales, so {(kp.acc * 100).toFixed(1)}% accurate.
              The same test on a plain 12-week average scores {(kp.accOld * 100).toFixed(1)}%.
            </p>
          </div>
        </Card>

        <Card title="How a sales change is found" sub="The test that separates a new level from a noisy week">
          <div className="prose">
            <p>Noise must not trigger a replan, and a real move must not be missed. A product-region is reported as changed only when all four hold:</p>
            <div className="kv">
              <span>Weeks compared with what was expected</span><span>last 6</span>
              <span>Of those, clearly off on the same side</span><span>4 or more</span>
              <span>Total gap against the expectation</span><span>≥ {state.settings.changeThreshold}%</span>
              <span>Series big enough to matter</span><span>≥ 1.5 t a week</span>
            </div>
            <p>
              A single week more than 4 standard deviations out is pulled aside as a <b>one-off</b> first, so one big order
              cannot drag the baseline. Products that moved together — same grade, same region, same direction — are
              then grouped into one decision, because they have one cause.
            </p>
            {c && <>
              <p>
                Today's largest is <b>{c.title}</b>: {c.headline.toLowerCase()} since {wk(c.start)},
                worth {c.extraWk > 0 ? '+' : '−'}{fmtT(Math.abs(c.extraWk))} a week. Confidence {c.conf}% —
                it rises with the number of products that moved, how long it has held, whether market news explains it
                {c.signal ? ` (it does: "${c.signal.title}")` : ' (nothing does)'}, and whether the order book agrees.
              </p>
              <p className="note">
                Nothing is applied until a person decides. <b>Real change</b> lifts the forecast to the new level;
                <b> one-off</b> rewrites those weeks back to what was expected. The production plan and the buying list
                follow either way. <button className="link" onClick={() => go('changes', c.id)}>Open it →</button>
              </p>
            </>}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="How much stock to hold" sub="Safety stock, reorder level and target">
          <div className="prose">
            <p>
              Forecasts are never exact, so a buffer covers the error over the time it takes to make more — not the whole
              year's error, only the part that can hurt before production catches up.
            </p>
            <div className="formula">
              safety stock = z × forecast error × √(making weeks + 1)<br />
              reorder level = sales during making time + safety stock<br />
              target = reorder level + the next 2 weeks of sales
            </div>
            <p>
              At a <b>{state.settings.serviceLevel}% service level</b>, z = {plan.z.toFixed(2)}. For <b>{p.name}</b>, which
              takes {p.L * 7} days to make: safety stock {fmtT(p.ss)}, reorder level {fmtT(p.rop)}, target {fmtT(p.target)}.
              Stock plus what is already in production is {fmtT(p.position)} — {p.position <= p.rop ? 'at or below the reorder level, so more is planned' : 'above the reorder level, so nothing extra is needed'}.
            </p>
            <p className="note">
              Raise the service level and every buffer grows with it. <button className="link" onClick={openSettings}>Change it in settings →</button>
            </p>
          </div>
        </Card>

        <Card title="How buying is worked out (MRP)" sub="Netting, lot sizes, and what a late order can and cannot fix">
          <div className="prose">
            <p>Each material is run forward week by week:</p>
            <div className="formula">stock at end = stock at start + arriving − needed for production</div>
            <p>
              When the end would fall below the safety level, one order is planned. It is sized to cover the whole
              delivery window rather than a single week, then rounded up to the supplier's lot size — a buyer places one
              order for a month's use, not four weekly ones.
            </p>
            <p>
              <b>An order cannot arrive before the delivery time is up.</b> For <b>{m.name}</b> delivery
              takes {m.lead} days, so no new order can land in the first {m.reachW} week{m.reachW === 1 ? '' : 's'};
              whatever is short by then is carried forward into the first order that can actually arrive. That is why the
              early rows of its stock table can sit below safety with no order against them.
            </p>
            <p>
              Stock lasts {daysText(m.daysLeft)} and the normal order date has {m.planned[0] && m.planned[0].orderByDay < 0 ? 'passed' : 'not passed'}.
              A rush order cuts delivery to about {m.rushDays} days for {state.settings.rushPremium}% more, which is why
              it shows as urgent rather than impossible.
              {' '}<button className="link" onClick={() => go('material', m.id)}>Open {m.name} →</button>
            </p>
          </div>
        </Card>
      </div>

      <Card title="The rules you can change" sub="Four settings, each one visible in the numbers above" pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Setting</th><th scope="col" className="r">Now</th><th scope="col">What it moves</th><th scope="col" className="r">Effect today</th></tr></thead>
          <tbody>
            <tr><td className="nm">Service level<small>how often stock should cover demand</small></td><td className="r num">{state.settings.serviceLevel}%</td>
              <td>Safety stock for all {plan.products.length} products</td><td className="r num">z = {plan.z.toFixed(2)} · {fmtT(sum(plan.products.map(x => x.ss)))} held as buffer</td></tr>
            <tr><td className="nm">Sales-change threshold<small>how far sales must move to be reported</small></td><td className="r num">{state.settings.changeThreshold}%</td>
              <td>Which changes reach the Decisions list</td><td className="r num">{plan.changes.length} change{plan.changes.length === 1 ? '' : 's'} found</td></tr>
            <tr><td className="nm">Rush delivery charge<small>paid when the order date has passed</small></td><td className="r num">{state.settings.rushPremium}%</td>
              <td>Cost of every late order</td><td className="r num">{plan.buys.filter(b => b.late).length} order{plan.buys.filter(b => b.late).length === 1 ? '' : 's'} affected</td></tr>
            <tr><td className="nm">Too-much-stock limit<small>when holding more becomes waste</small></td><td className="r num">{state.settings.excessDays} days</td>
              <td>Which materials are flagged to free cash</td><td className="r num">{plan.materials.filter(x => x.excess).length} flagged · {fmtINR(kp.toFree)}</td></tr>
          </tbody>
        </table></div>
        <div className="row" style={{ padding: '10px 16px 16px' }}>
          <button className="btn pri" onClick={openSettings}>Open settings</button>
          <span className="note">Changing one re-runs the whole calculation. Nothing is sent anywhere.</span>
        </div>
      </Card>

      <Card title="Where the numbers come from" sub="Honest about what is real and what is not">
        <div className="prose">
          <p>
            <b>All data here is generated, not real.</b> It is built from a fixed seed, so the same figures appear every
            time the app is opened and any number can be checked twice. {HIST} weeks of weekly sales were generated for
            each product and region from a level, a yearly growth rate, a seasonal shape and 6% random noise.
          </p>
          <p>
            Three changes of level and three one-off weeks were deliberately planted in that history, and the app is
            expected to find all six from the sales alone — it finds {plan.changes.length} changes
            and {plan.oneOffs.length} one-offs. Two of the three changes have supporting market news in the signal list;
            the third ({plan.changes.find(x => !x.signal)?.title ?? 'none'}) deliberately has none, so it shows what an
            unexplained move looks like.
          </p>
          <p>
            Prices, delivery times, lot sizes and line capacities are plausible figures for a mid-size stainless works,
            not quotes. Approving an order writes a purchase order into this browser only — nothing is emailed, and no
            supplier is contacted.
          </p>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Pill u="Info">Mock data</Pill>
          <span className="note">Decisions you take are kept in this browser so you can come back to them. Reset clears them.</span>
        </div>
      </Card>

      <Card title="Words used on these screens" pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th scope="col">Word</th><th scope="col">What it means here</th></tr></thead>
          <tbody>
            {[
              ['Forecast', `What customers are expected to buy, per product, per region, per week, for the next ${AHEAD} weeks.`],
              ['Likely range', 'The band the forecast should land inside 8 weeks out of 10.'],
              ['Sales change', 'Several weeks in a row away from the forecast on the same side — a new level, not noise.'],
              ['One-off', 'A single week far from normal, then back. Usually one large order or a customer pausing.'],
              ['Safety stock', 'The buffer that covers forecast error while more is being made.'],
              ['Reorder level', 'Stock plus work in progress falling to this level is the signal to make or buy more.'],
              ['Make plan', 'How much to produce each week: the forecast plus any top-up to reach target stock.'],
              ['MRP', 'Material requirements planning — turning the make plan into material orders, netted off stock.'],
              ['Lead time', 'Days between placing an order and it arriving. Nothing can arrive sooner.'],
              ['Lot size', 'The smallest amount a supplier will ship, and the step it increases in.'],
              ['Order by', 'The last day an order can be placed and still arrive before stock runs out.'],
              ['Urgent', 'Stock runs out before new supply could normally arrive. Needs a decision today.'],
              ['Soon', 'Nothing is short yet, but the order date is inside a week.'],
              ['Watch', 'Sales moved and the forecast may need to follow. Decide this week.'],
            ].map(([k, v]) => <tr key={k}><td className="nm" style={{ whiteSpace: 'nowrap' }}>{k}</td><td>{v}</td></tr>)}
          </tbody>
        </table></div>
      </Card>
    </>
  )
}
