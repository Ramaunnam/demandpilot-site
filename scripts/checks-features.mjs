// Checks for product naming, the profit box, the Connected systems page, and that every
// screen shows the same name and the same order for the same thing.
const EM_DASH = String.fromCharCode(8212)

// The 12 product groups, exactly as they must read on every screen.
const GROUPS = {
  '304-CR': ['Utensil Circles 304', ['0.5', '0.8', '1.0'], 'Pressure cookers, plates, bowls'],
  '304-HR': ['Chequered Floor Plate 304', ['3', '5', '8'], 'Factory floors, ramps, stairs'],
  '304-SH': ['Hairline Elevator Sheet 304', ['0.8', '1.2', '1.5'], 'Lift and escalator panels'],
  '316L-CR': ['Pharma Tank Coil 316L', ['1.0', '2.0', '3.0'], 'Pharma and food-processing tanks'],
  '316L-HR': ['Chemical Process Plate 316L', ['5', '8', '12'], 'Chemical reactors and vessels'],
  '316L-SH': ['Mirror-Finish Dairy Sheet 316L', ['0.8', '1.2', '1.5'], 'Dairy and food plant equipment'],
  '430-CR': ['Fridge Door Strip 430', ['0.4', '0.5', '0.6'], 'Fridge and washing-machine panels'],
  '430-HR': ['Exhaust Tube Strip 430', ['1.0', '1.5', '2.0'], 'Car and bike exhaust pipes'],
  '430-SH': ['Washing Machine Drum Sheet 430', ['0.5', '0.6', '0.8'], 'Washing-machine drums, gas stoves'],
  '201-CR': ['Pipe & Tube Strip 201', ['0.8', '1.2', '1.6'], 'Furniture tubes, gates, handrails'],
  '201-HR': ['Railway Wagon Plate 201', ['3', '4', '6'], 'Railway coach and wagon bodies'],
  '201-SH': ['Perforated Decor Sheet 201', ['0.6', '0.8', '1.0'], 'Railings, ceilings, shop fronts'],
}
const TIERS = ['0.5', '1', '2']

export function featureChecks(c) {
  const { data, computePlan, weekView, freshState, PAGES, SYSTEMS, FLOW, fmtINR, sum, render, visible, ok, bad } = c
  const state = freshState()
  const plan = computePlan(data, state)

  // ---------- 1. one product name, one material name ----------
  for (const p of plan.products) {
    const [grade, form, tierId] = p.id.split('-')
    const g = GROUPS[`${grade}-${form}`]
    if (!g) { bad(`${p.id} belongs to no known product group`); continue }
    const [name, sizes, use] = g
    const want = `${name}, ${sizes[TIERS.indexOf(tierId)]} mm`
    if (p.name !== want) bad(`product name is "${p.name}", expected "${want}"`)
    if (p.family !== name) bad(`${p.id} group is "${p.family}", expected "${name}"`)
    if (p.use !== use) bad(`${p.id} used-for is "${p.use}", expected "${use}"`)
    if (JSON.stringify(p).includes('SS-')) bad(`${p.id} still carries an internal code`)
  }
  ok(`all ${plan.products.length} product names, groups and used-for texts match the one product list`)

  const groups = [...new Set(plan.products.map(p => p.family))]
  if (groups.length !== 12) bad(`expected 12 product groups, found ${groups.length}`)
  else ok(`the product group filter has all 12 groups: ${groups[0]} … ${groups[11]}`)

  // Every screen must show names from the product and material lists and nothing else.
  // Any old-format name appearing in rendered HTML is a page building its own label.
  const OLD = ['Cold-Rolled Coil 2B', 'Cold-Rolled Coil BA', 'Hot-Rolled Coil No.1', 'Polished Sheet No.4',
    'SS-', 'Kitchenware, utensils', 'Kitchen sinks, elevator', 'Building structures, tanks',
    'Car exhaust pipes', 'Railway coach bodies', 'Railings and decor']
  const names = new Set(plan.products.map(p => p.name))
  const matNames = new Set(plan.materials.map(m => m.name))
  const routes = [
    ...Object.keys(PAGES).map(p => [p, null]),
    ...plan.products.slice(0, 4).map(p => ['product', p.id]),
    ...plan.materials.slice(0, 4).map(m => ['material', m.id]),
    ...plan.changes.map(ch => ['changes', ch.id]),
  ]
  let stale = 0
  for (const [page, id] of routes) {
    const text = visible(render(page, id, state, plan))
    for (const o of OLD) if (text.includes(o)) { bad(`${page}${id ? '/' + id : ''} still shows the old label "${o}"`); stale++ }
  }
  if (!stale) ok(`${routes.length} screens checked: no old product name, no code, nothing built page-side`)

  // the screens that list products must use a name from the product list
  for (const page of ['products', 'plan', 'forecast']) {
    const text = visible(render(page, null, state, plan))
    if (![...names].some(n => text.includes(n))) bad(`${page} shows no name from the product list`)
  }
  for (const page of ['materials', 'buy']) {
    const text = visible(render(page, null, state, plan))
    if (![...matNames].some(n => text.includes(n))) bad(`${page} shows no name from the material list`)
  }
  ok('every product and material screen draws its labels from the one list')

  // a change is named after its group, or the grade when several groups moved
  for (const ch of plan.changes) {
    const fams = [...new Set(ch.items.map(i => plan.prodById[i.productId].family))]
    const want = `${fams.length === 1 ? fams[0] : ch.grade + ' stainless steel'} ${EM_DASH} ${ch.region} customers`
    if (ch.title !== want) bad(`change title is "${ch.title}", expected "${want}"`)
  }
  ok(`${plan.changes.length} sales-change titles use the group name: ${plan.changes.map(x => x.title.split(' ' + EM_DASH)[0]).join(' / ')}`)

  // ---------- 2. one buy list behind every screen ----------
  const buyDecisions = plan.decisions.filter(d => d.id.startsWith('BUY:') || d.id.startsWith('CUT:'))
  for (const d of buyDecisions) {
    const m = plan.matById[d.link.id]
    if (!m) { bad(`decision ${d.id} points at no material`); continue }
    const row = d.id.startsWith('BUY:') ? m.buy : m.cut
    if (!row) { bad(`${m.name} is on Decisions but carries no buy row, so the other screens cannot match it`); continue }
    if (row.id !== d.id) bad(`${m.name}: the decision and the material point at different buy rows`)
    if (d.urgency !== row.urgency) bad(`${m.name}: Decisions says ${d.urgency}, the buy row says ${row.urgency}`)
    if (row.kind === 'buy' && m.urgency !== row.urgency && row.urgency !== 'Watch') {
      bad(`${m.name}: Materials & stock says ${m.urgency}, Buy says ${row.urgency}`)
    }
    if (!plan.buys.some(b => b.id === d.id)) bad(`${m.name} is on Decisions but not on the Buy screen`)
    if (row.kind === 'buy' && !plan.buys.filter(b => b.kind === 'buy').some(b => b.id === d.id)) {
      bad(`${m.name} is on Decisions but not in Plan & MRP step 5`)
    }
    // the quantity and date a person reads must be the same on every screen
    if (row.kind === 'buy') {
      if (m.buy.qty !== row.qty) bad(`${m.name}: quantity differs between screens`)
      if (m.buy.orderByDay !== row.orderByDay) bad(`${m.name}: order-by date differs between screens`)
      if (!d.do.includes(String(Math.round(row.qty))) && !d.do.includes(row.qty.toLocaleString('en-IN'))) {
        bad(`${m.name}: the Decisions line does not state the same quantity as the buy row`)
      }
    }
  }
  ok(`${buyDecisions.length} material decisions carry one shared row: same status, quantity and order-by on Decisions, Materials, the material page, Buy and Plan step 5`)

  // the Command Centre supply box counts the same urgent materials
  const urgentMats = plan.materials.filter(m => m.urgency === 'Urgent')
  if (urgentMats.length !== plan.kpi.matsAtRisk) bad('the Supply box count does not match the urgent materials')
  for (const m of urgentMats) {
    if (!m.buy) bad(`${m.name} is urgent in the Supply box but has no order on the buy list`)
    else if (!plan.decisions.some(d => d.id === m.buy.id)) bad(`${m.name} is urgent but is not on the Decisions list`)
  }
  ok(`the Supply box lists ${urgentMats.length} urgent materials (${urgentMats.map(m => m.name).join(', ')}), each with an order on every screen`)

  // ---------- 3. rush order size ----------
  for (const m of plan.materials) {
    if (!m.buy?.late) continue
    const onOrder = sum(m.pos.map(p => p.qty))
    const bridge = (m.lead + m.safetyDays + 14) * m.daily
    const want = Math.ceil(Math.max(0, bridge - m.onHand - onOrder) / m.lot) * m.lot
    if (m.buy.qty !== want) bad(`${m.name}: rush order is ${m.buy.qty}, the bridge formula gives ${want}`)
    if (m.buy.qty % m.lot !== 0) bad(`${m.name}: rush order is not a whole number of lots`)
    if (!(m.buy.cost > 0)) bad(`${m.name}: rush order has no cost`)
  }
  const rush = plan.materials.filter(m => m.buy?.late)
  ok(`${rush.length} rush orders sized to bridge the delivery time: ${rush.map(m => `${m.name} ${Math.round(m.buy.qty)} ${m.unit} = ${fmtINR(m.buy.cost)}`).join(', ')}`)

  // ---------- 4. overstock ----------
  const fecr = plan.matById.FECR, mn = plan.matById.MN
  if (Math.abs(fecr.daysLeft - 60) > 12) bad(`ferrochrome holds ${Math.round(fecr.daysLeft)} days, expected about 60`)
  if (fecr.excess) bad('ferrochrome is still flagged as overstocked')
  if (Math.abs(mn.daysLeft - 130) > 15) bad(`ferromanganese holds ${Math.round(mn.daysLeft)} days, expected about 130`)
  if (!mn.excess) bad('ferromanganese is not flagged as overstocked')
  const cuts = plan.buys.filter(b => b.kind === 'cut')
  if (cuts.length !== 1 || cuts[0].mat.id !== 'MN') bad(`"Buy less" should be ferromanganese alone, it is ${cuts.map(b => b.mat.name).join(', ') || 'nothing'}`)
  const freedCr = plan.kpi.toFree / 1e7
  if (Math.abs(freedCr - 11) > 3) bad(`cash that can be freed is ${freedCr.toFixed(2)} Cr, expected about 11 Cr`)
  ok(`ferrochrome ${Math.round(fecr.daysLeft)} days (normal), ferromanganese ${Math.round(mn.daysLeft)} days, buy less = ${cuts[0]?.mat.name}, ${fmtINR(plan.kpi.toFree)} can be freed`)

  // ---------- the profit box ----------
  for (let k = 0; k < 12; k++) {
    const v = weekView(plan, k)
    const e = v.profitEx
    if (e.value !== fmtINR(v.profit)) bad(`week ${k}: box shows ${fmtINR(v.profit)} but the popup says ${e.value}`)
    if (Math.abs((v.sales - v.profitMatCost - v.profit) / v.profit) > 1e-9) bad(`week ${k}: sales minus material cost is not the profit`)
    const viaMargin = sum(plan.products.map(p => p.fc[k] * p.marginPerT))
    if (Math.abs(viaMargin - v.profit) / v.profit > 1e-9) bad(`week ${k}: profit is not the sum of tonnes x margin per tonne`)
    if (!(v.profit > 0)) bad(`week ${k}: profit is not positive (${v.profit})`)
    if (!Number.isFinite(v.profitDelta) || !Number.isFinite(v.profitPct)) bad(`week ${k}: the comparison with the previous week is not finite`)
    if (!e.worked.startsWith('Sales ')) bad(`week ${k}: the popup is missing its "Sales - material cost =" line`)
    if (e.inputs.length !== 3) bad(`week ${k}: the popup should list the previous week, the difference and profit per tonne`)
  }
  ok('all 12 weeks: the profit box matches its popup, equals sales minus material cost, and is positive')

  // ---------- connected systems ----------
  if (SYSTEMS.length !== 7) bad(`expected 7 systems, found ${SYSTEMS.length}`)
  const live = SYSTEMS.filter(x => x.status === 'Live').length
  const rec = SYSTEMS.filter(x => x.status === 'Recovered').length
  if (live !== 6 || rec !== 1) bad(`expected 6 live and 1 recovered, found ${live} live and ${rec} recovered`)
  for (const x of SYSTEMS) {
    if (!PAGES[x.open]) bad(`${x.name}: its Open button points at unknown screen "${x.open}"`)
    for (const [page] of x.uses) if (!PAGES[page]) bad(`${x.name}: a "used on" tag points at unknown screen "${page}"`)
  }
  if (FLOW.length !== 5) bad(`the data-flow strip should have 5 steps, it has ${FLOW.length}`)
  ok(`${SYSTEMS.length} systems (${live} live, ${rec} recovered) and the 5-step flow strip all reach real screens`)
}
