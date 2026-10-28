// Renders every screen, for every product / material / change, and checks the numbers.
// No browser needed: the pages are rendered to HTML with react-dom/server, which catches
// anything that throws and anything that prints as NaN, Infinity or undefined.
//
//   npm run check
import { build } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { featureChecks } from './checks-features.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
// Inside the project, so the bundle can still resolve react from node_modules.
const out = join(root, 'node_modules', '.dp-check')
mkdirSync(out, { recursive: true })

// --- the browser bits the pages touch while rendering ---
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

let fail = 0
const bad = (msg) => { fail++; console.error('  ✗ ' + msg) }
const ok = (msg) => console.log('  ✓ ' + msg)

// --- bundle the app for node so JSX can be imported ---
await build({
  entryPoints: [join(root, 'scripts', 'entry.jsx')],
  bundle: true, format: 'esm', platform: 'node', outfile: join(out, 'app.mjs'),
  external: ['react', 'react-dom', 'react-dom/server'], jsx: 'automatic', logLevel: 'error',
  loader: { '.png': 'dataurl' },   // the brand logo is imported by App.jsx
})
const app = await import('file://' + join(out, 'app.mjs').replace(/\\/g, '/'))
const { PAGES, Ctx, buildData, computePlan, DEFAULT_SETTINGS, weekView, whatIf, SYSTEMS, FLOW, fmtINR, sum } = app

const data = buildData()
const freshState = () => ({ settings: { ...DEFAULT_SETTINGS }, decisions: {}, approved: [], approvedIds: {}, rejected: {}, edits: {}, dismissed: {}, log: [], poSeq: 3400, sync: {} })

function render(page, id, state, plan) {
  const Page = PAGES[page]
  const ctx = {
    data, plan, state, route: { page, id },
    go() {}, notify() {}, openSettings() {},
    act: { approveBuy() {}, rejectBuy() {}, editQty() {}, decideChange() {}, approveDecision() {}, dismiss() {}, setting() {}, reset() {}, syncSystem() {}, syncAll() {} },
  }
  return renderToStaticMarkup(React.createElement(Ctx.Provider, { value: ctx }, React.createElement(Page, { id })))
}

// Text a person would actually read, with the markup and inline styles stripped out.
const visible = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ')

console.log('\n1. Every screen renders')
{
  const state = freshState()
  const plan = computePlan(data, state)
  const routes = [
    ...Object.keys(PAGES).map(p => [p, null]),
    ...plan.products.map(p => ['product', p.id]),
    ...plan.materials.map(m => ['material', m.id]),
    ...plan.changes.map(c => ['changes', c.id]),
    ...plan.products.slice(0, 6).map(p => ['simulate', p.id]),
    ['product', 'does-not-exist'], ['material', 'does-not-exist'], ['changes', 'nope'],
  ]
  let chars = 0
  for (const [page, id] of routes) {
    try {
      const html = render(page, id, state, plan)
      chars += html.length
      if (html.length < 400) bad(`${page}${id ? '/' + id : ''} rendered only ${html.length} chars`)
      const text = visible(html)
      for (const token of ['NaN', 'Infinity', 'undefined', '[object Object]']) {
        if (text.includes(token)) bad(`${page}${id ? '/' + id : ''} shows "${token}"`)
      }
    } catch (e) {
      bad(`${page}${id ? '/' + id : ''} threw: ${e.message}`)
    }
  }
  ok(`${routes.length} routes rendered, ${(chars / 1024).toFixed(0)} KB of HTML, no NaN / undefined on screen`)
}

console.log('\n2. Screens still render after decisions are taken')
{
  let state = freshState()
  let plan = computePlan(data, state)
  // accept one change as real, call one a one-off, approve every order, skip the overstock
  state.decisions[plan.changes[0].id] = 'real'
  if (plan.changes[1]) state.decisions[plan.changes[1].id] = 'oneoff'
  if (plan.oneOffs[0]) state.decisions[plan.oneOffs[0].id] = 'oneoff'
  plan = computePlan(data, state)
  let seq = 3400
  for (const b of plan.buys.filter(x => x.kind === 'buy')) {
    seq++
    state.approved.push({ id: `PO-26-${seq}`, mat: b.mat.id, qty: b.qty, placedDay: 0, dueDay: Math.max(1, b.arrivesDay), status: 'Placed', rush: b.late, cost: b.cost, approvedNow: true })
  }
  for (const b of plan.buys.filter(x => x.kind === 'cut')) state.approvedIds[b.id] = true
  for (const d of plan.decisions.filter(x => x.id.startsWith('MAKE:'))) state.approvedIds[d.id] = true
  state.log.push({ at: '10:00', text: 'check run' })
  plan = computePlan(data, state)
  for (const page of Object.keys(PAGES)) {
    try {
      const html = render(page, null, state, plan)
      if (visible(html).includes('NaN')) bad(`${page} shows NaN after decisions`)
    } catch (e) { bad(`${page} threw after decisions: ${e.message}`) }
  }
  ok(`all screens fine after ${state.approved.length} orders placed and ${Object.keys(state.decisions).length} changes decided`)
  if (plan.kpi.urgent > 0) bad(`${plan.kpi.urgent} urgent item(s) survive approving everything — the list cannot be cleared`)
  else ok('approving everything clears every urgent item')

  // and once the whole list is answered, the "all clear" screens must still draw
  for (const d of plan.decisions) state.dismissed[d.id] = true
  plan = computePlan(data, state)
  if (plan.decisions.length) bad(`${plan.decisions.length} decision(s) cannot be cleared at all`)
  for (const page of Object.keys(PAGES)) {
    try {
      const html = render(page, null, state, plan)
      if (visible(html).includes('NaN')) bad(`${page} shows NaN with an empty list`)
    } catch (e) { bad(`${page} threw with an empty decision list: ${e.message}`) }
  }
  ok('every screen draws with an empty decision list (the all-clear states)')
}

console.log('\n3. Screens render at every setting extreme')
{
  const extremes = [
    { serviceLevel: 80 }, { serviceLevel: 99 },
    { changeThreshold: 5 }, { changeThreshold: 40 },
    { rushPremium: 0 }, { rushPremium: 40 },
    { excessDays: 30 }, { excessDays: 150 },
  ]
  for (const patch of extremes) {
    const state = { ...freshState(), settings: { ...DEFAULT_SETTINGS, ...patch } }
    const plan = computePlan(data, state)
    const tag = Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(',')
    for (const page of Object.keys(PAGES)) {
      try {
        const html = render(page, null, state, plan)
        if (visible(html).includes('NaN')) bad(`${page} shows NaN at ${tag}`)
      } catch (e) { bad(`${page} threw at ${tag}: ${e.message}`) }
    }
  }
  ok(`${extremes.length} setting extremes × ${Object.keys(PAGES).length} screens all render`)
}

console.log('\n4. The numbers hold together')
{
  const state = freshState()
  const plan = computePlan(data, state)
  const near = (a, b, tol, what) => { if (Math.abs(a - b) > tol) bad(`${what}: ${a} vs ${b}`) }

  // the factory forecast must be the sum of its products
  for (let k = 0; k < 12; k++) {
    near(plan.factoryFc[k], plan.products.reduce((s, p) => s + p.fc[k], 0), 1e-6, `factory forecast week ${k}`)
  }
  near(plan.kpi.next12, plan.factoryFc.reduce((a, b) => a + b, 0), 1e-6, 'next12 vs weekly forecasts')
  ok('factory forecast equals the sum of all 36 products, week by week')

  // every product: the likely range must contain the forecast, and stock projection must add up
  for (const p of plan.products) {
    for (let k = 0; k < 12; k++) {
      if (!(p.lo[k] <= p.fc[k] + 1e-9 && p.fc[k] <= p.hi[k] + 1e-9)) bad(`${p.id} week ${k}: forecast outside its own likely range`)
      if (p.lo[k] < 0) bad(`${p.id} week ${k}: negative lower bound`)
    }
    if (p.rop < p.ss) bad(`${p.id}: reorder level below safety stock`)
    if (p.target < p.rop) bad(`${p.id}: target below reorder level`)
    let inv = p.onHand
    for (let w = 0; w < 12; w++) {
      inv += (w < p.L ? p.wip[w] : p.make[w - p.L]) - p.fc[w]
      near(p.proj[w].stock, inv, 1e-6, `${p.id} stock projection week ${w}`)
    }
  }
  ok('every product: forecast inside its range, safety ≤ reorder ≤ target, stock projection balances')

  // every material: the MRP worksheet must balance, and no order may be placed sooner than delivery allows
  for (const m of plan.materials) {
    for (const r of m.rows) near(r.end, r.start + r.receipts - r.gross + r.por, 1e-6, `${m.id} MRP week ${r.w}`)
    for (const pl of m.planned) {
      if (pl.w < m.reachW) bad(`${m.id}: order planned in week ${pl.w}, but delivery needs ${m.lead} days`)
      if (pl.qty % m.lot !== 0 && m.lot >= 1) bad(`${m.id}: order ${pl.qty} is not a multiple of the ${m.lot} lot size`)
      if (pl.orderByDay !== pl.needDay - m.lead) bad(`${m.id}: order-by date does not match need date minus delivery`)
    }
    if (m.rushDays > m.lead) bad(`${m.id}: rush delivery slower than normal delivery`)
  }
  ok('every material: MRP rows balance, lot sizes respected, no order earlier than its delivery time')

  // the ⓘ on a tile must repeat the number the tile shows
  for (const [k, e] of Object.entries(plan.explain)) {
    if (!e.title || !e.value || !e.means || !e.formula || !e.worked) bad(`explanation "${k}" is missing a part`)
    if (/NaN|Infinity|undefined/.test(e.worked + e.value)) bad(`explanation "${k}" works out to "${e.value}"`)
  }
  ok(`${Object.keys(plan.explain).length} headline explanations complete and finite`)

  // every decision must point at a screen that exists
  for (const d of plan.decisions) {
    if (!PAGES[d.link.page]) bad(`decision ${d.id} links to unknown screen "${d.link.page}"`)
    if (d.link.page === 'product' && !plan.prodById[d.link.id]) bad(`decision ${d.id} links to a missing product`)
    if (d.link.page === 'material' && !plan.matById[d.link.id]) bad(`decision ${d.id} links to a missing material`)
    if (!d.do || !d.why || !d.name) bad(`decision ${d.id} is missing its do/why text`)
  }
  ok(`${plan.decisions.length} decisions all link to a real screen and carry a reason`)

  // the week selector and the what-if must work for every week / every product
  for (let k = 0; k < 12; k++) {
    const v = weekView(plan, k)
    if (!Number.isFinite(v.total) || !Number.isFinite(v.change)) bad(`week view ${k} is not finite`)
  }
  for (const p of plan.products) for (const pct of [-50, -5, 0, 20, 100]) {
    const r = whatIf(plan, p.id, pct)
    if (!Number.isFinite(r.newWeekly) || !Number.isFinite(r.newDays) || !Number.isFinite(r.matCost)) bad(`what-if ${p.id} at ${pct}% is not finite`)
  }
  ok('all 12 weeks of the week selector and 36 products × 5 what-if steps are finite')

  // the planted changes must still be found
  const found = plan.changes.map(c => `${c.grade}|${c.region}`)
  for (const want of ['316L|South', '304|West', '201|North']) {
    if (!found.includes(want)) bad(`planted sales change ${want} was not found`)
  }
  if (plan.oneOffs.length !== 3) bad(`expected 3 one-off weeks, found ${plan.oneOffs.length}`)
  ok('all 3 planted sales changes and all 3 planted one-off weeks are found')
}

console.log('\n5. Speed')
{
  const state = freshState()
  computePlan(data, state)   // warm
  const t0 = performance.now()
  for (let i = 0; i < 20; i++) computePlan(data, { ...state, dismissed: { x: i } })
  const per = (performance.now() - t0) / 20
  ok(`recalculating the whole plan after a click: ${per.toFixed(1)} ms`)
  if (per > 40) bad(`that is slow enough to feel (${per.toFixed(0)} ms)`)

  const t1 = performance.now()
  const plan = computePlan(data, state)
  for (const page of Object.keys(PAGES)) render(page, null, state, plan)
  ok(`rendering all ${Object.keys(PAGES).length} screens once: ${(performance.now() - t1).toFixed(0)} ms`)
}

console.log()
console.log('6. Product names, profit and connected systems')
featureChecks({ data, computePlan, weekView, freshState, PAGES, SYSTEMS, FLOW, fmtINR, sum, render, visible, ok, bad })

rmSync(out, { recursive: true, force: true })
console.log(fail === 0 ? '\nAll checks passed.\n' : `\n${fail} check(s) failed.\n`)
process.exit(fail === 0 ? 0 : 1)
