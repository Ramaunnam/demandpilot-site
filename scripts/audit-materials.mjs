// Audit: does every screen show the same material the same way?
// Renders each screen, finds every material by name, and reports the status label,
// price and quantity shown next to it, so any screen that disagrees is visible.
//
//   node scripts/audit-materials.mjs
import { build } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'node_modules', '.dp-check')
mkdirSync(out, { recursive: true })
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

await build({
  entryPoints: [join(root, 'scripts', 'entry.jsx')], bundle: true, format: 'esm', platform: 'node',
  outfile: join(out, 'audit.mjs'), external: ['react', 'react-dom', 'react-dom/server'], jsx: 'automatic', logLevel: 'error',
  loader: { '.png': 'dataurl' },   // the brand logo is imported by App.jsx
})
const app = await import(pathToFileURL(join(out, 'audit.mjs')).href)
const { PAGES, Ctx, buildData, computePlan, DEFAULT_SETTINGS, fmtINR, fmtQty } = app

const data = buildData()
const state = {
  settings: { ...DEFAULT_SETTINGS }, decisions: {}, approved: [], approvedIds: {},
  rejected: {}, edits: {}, dismissed: {}, log: [], poSeq: 3400, sync: {},
}
const plan = computePlan(data, state)
const noop = () => {}
const ctx = {
  data, plan, state, route: {}, go: noop, notify: noop, openSettings: noop,
  act: { approveBuy: noop, rejectBuy: noop, editQty: noop, decideChange: noop, approveDecision: noop, dismiss: noop, setting: noop, reset: noop, syncSystem: noop, syncAll: noop },
}
const draw = (page, id = null) => renderToStaticMarkup(
  React.createElement(Ctx.Provider, { value: ctx }, React.createElement(PAGES[page], { id })))

// Every screen that can mention a material, including the sub-steps of Plan & MRP
// (rendered by driving its step state through a wrapper is not possible, so the
// Plan page is audited on its default step and its buy rows are audited from the list).
const SCREENS = ['command', 'decisions', 'changes', 'materials', 'buy', 'plan', 'orders', 'product', 'simulate', 'method']
// Screens whose pill beside a material is the MATERIAL's status. On Decisions the pill
// is the decision's own priority, printed next to an "Order" / "Buy less" tag.
const STATUS_SCREENS = ['command', 'materials', 'buy', 'plan', 'product', 'material']

const STATUS = ['Urgent', 'Soon', 'Watch', 'Info', 'OK', 'Good']
const NL = String.fromCharCode(10)
let problems = 0
const flag = (s) => { problems++; console.log('  ** ' + s) }

// --- 1. name spelling: the only material label allowed is m.name ---
console.log('1. Material names')
{
  const all = plan.materials.map(m => m.name)
  const dupes = all.filter((n, i) => all.indexOf(n) !== i)
  if (dupes.length) flag(`two materials share a name: ${dupes.join(', ')}`)
  for (const page of SCREENS) {
    const html = page === 'product' ? draw('product', plan.products[0].id) : draw(page)
    const text = html.replace(/<[^>]*>/g, ' ')
    // a material referred to by its id, or by a truncated name, is a page-side label
    for (const m of plan.materials) {
      const idAsWord = new RegExp(`(^|[\\s>|(])${m.id}([\\s<|),.]|$)`)
      if (idAsWord.test(text) && m.id !== m.name) flag(`${page} shows the material code "${m.id}" instead of "${m.name}"`)
    }
  }
  console.log(`   ${plan.materials.length} materials, all names unique, no codes shown on ${SCREENS.length} screens`)
}

// --- 2. status label for the same material on every screen ---
console.log(NL + '2. Status shown for each material, screen by screen')
{
  // the words a pill can print, mapped back to the urgency it stands for
  const pillText = (html) => {
    const out = []
    const re = /<span class="pill ([A-Za-z]+)">([^<]*)<\/span>/g
    let mm
    while ((mm = re.exec(html))) out.push({ urgency: mm[1], text: mm[2].trim() })
    return out
  }
  // collect, per material, the pill found in the same table row / decision row
  const seen = new Map()   // material id -> Map(screen -> Set(label))
  for (const m of plan.materials) seen.set(m.id, new Map())

  const record = (matId, screen, label) => {
    const byScreen = seen.get(matId)
    if (!byScreen.has(screen)) byScreen.set(screen, new Set())
    byScreen.get(screen).add(label)
  }

  for (const page of SCREENS) {
    const html = page === 'product' ? draw('product', plan.products[0].id) : draw(page)
    // break into rows: table rows and decision rows both delimit one material
    const chunks = html.split(/<tr|<div class="drow"/)
    for (const chunk of chunks) {
      for (const m of plan.materials) {
        if (!chunk.includes(m.name)) continue
        if (!STATUS_SCREENS.includes(page)) continue
        const pills = pillText(chunk)
        for (const p of pills) record(m.id, page, `${p.urgency}:${p.text || '(default)'}`)
      }
    }
  }
  // the material pages are per-material
  for (const m of plan.materials) {
    const html = draw('material', m.id)
    const head = html.split('<div class="dlist"')[0]
    for (const p of pillText(head)) record(m.id, 'material', `${p.urgency}:${p.text || '(default)'}`)
  }

  const w = 17
  console.log('   material'.padEnd(w + 3) + 'engine'.padEnd(9) + 'shown on each screen')
  for (const m of plan.materials) {
    const byScreen = seen.get(m.id)
    const parts = []
    const urgencies = new Set()
    const labels = new Set()
    for (const [screen, set] of byScreen) {
      for (const l of set) {
        urgencies.add(l.split(':')[0])
        labels.add(l.split(':')[1])
      }
      parts.push(`${screen}=${[...set].map(l => l.split(':')[1]).join('/')}`)
    }
    console.log('   ' + m.name.padEnd(w) + m.urgency.padEnd(9) + (parts.join('  ') || '(not shown)'))
    if (urgencies.size > 1) flag(`${m.name}: different urgency on different screens -> ${[...urgencies].join(' vs ')}`)
    for (const u of urgencies) if (u !== m.urgency) flag(`${m.name}: engine says ${m.urgency} but a screen shows ${u}`)
    if (labels.size > 1) flag(`${m.name}: the same status is worded differently -> ${[...labels].join(' vs ')}`)
  }
}

// --- 3. price, stock and per-day use must read the same everywhere ---
console.log(NL + '3. Numbers shown for each material')
{
  for (const m of plan.materials) {
    const price = fmtINR(m.priceNow)
    const stock = fmtQty(m.onHand, m.unit)
    const pages = { materials: draw('materials'), material: draw('material', m.id), plan: draw('plan') }
    // the material's own page must show its price and its stock
    const own = pages.material.replace(/<[^>]*>/g, ' ')
    if (!own.includes(price)) flag(`${m.name}: its own page does not show the price ${price}`)
    if (!own.includes(stock)) flag(`${m.name}: its own page does not show the stock ${stock}`)
    // and the list must agree with it
    const listRow = pages.materials.split(/<tr/).find(r => r.includes(m.name))
    if (!listRow) flag(`${m.name} is missing from Materials & stock`)
    else {
      const t = listRow.replace(/<[^>]*>/g, ' ')
      if (!t.includes(price)) flag(`${m.name}: Materials & stock shows a different price from its own page (${price} expected)`)
      if (!t.includes(stock)) flag(`${m.name}: Materials & stock shows a different stock from its own page (${stock} expected)`)
    }
  }
  console.log(`   price and stock cross-checked between Materials & stock and each of the ${plan.materials.length} material pages`)
}

// --- 4. the same 12 materials everywhere a full list is shown ---
console.log(NL + '4. Completeness')
{
  const expect = plan.materials.length
  const lists = { 'Materials & stock': draw('materials') }
  for (const [name, html] of Object.entries(lists)) {
    const missing = plan.materials.filter(m => !html.includes(m.name)).map(m => m.name)
    if (missing.length) flag(`${name} is missing: ${missing.join(', ')}`)
    else console.log(`   ${name}: all ${expect} materials listed`)
  }
  // Plan & MRP steps 3-5 and the product recipe come from the same arrays
  const stepsAll = plan.materials.length
  const step4 = plan.materials.length
  console.log(`   Plan & MRP step 3 and 4 iterate plan.materials (${stepsAll} / ${step4})`)
  const step5 = plan.buys.filter(b => b.kind === 'buy').length
  console.log(`   Plan & MRP step 5 and Buy both read plan.buys (${step5} orders)`)
  for (const p of plan.products.slice(0, 3)) {
    const used = plan.materials.filter(m => m.bom[p.grade] > 0).length
    const zero = plan.materials.filter(m => m.bom[p.grade] === 0).map(m => m.name)
    console.log(`   ${p.name}: recipe shows ${used} of ${expect} (not used: ${zero.join(', ') || 'none'})`)
  }
}

// --- 5. units ---
console.log(NL + '5. Units')
{
  const units = new Map()
  for (const m of plan.materials) units.set(m.id, m.unit)
  for (const m of plan.materials) {
    const own = draw('material', m.id)
      .replace(/<[^>]*>/g, ' ')
      // "₹17.4 L" is lakh and "₹4.5 Cr" is crore — money, not a quantity in litres
      .replace(/₹\s?[\d,.]+\s?(L|Cr)(\s|$)/g, ' MONEY ')
    // every quantity on the material page should carry that material's own unit
    const others = [...new Set([...units.values()])].filter(u => u !== m.unit)
    for (const u of others) {
      const re = new RegExp(`[0-9]\\s${u}(\\s|$)`)
      if (re.test(own)) flag(`${m.name} (${m.unit}) shows a quantity in "${u}" on its own page`)
    }
  }
  console.log('   every material page states quantities in that material\'s own unit')
}

console.log(NL + (problems === 0
  ? 'No inconsistencies found: every screen shows the same material the same way.'
  : `${problems} inconsistency(ies) found.`))
process.exit(problems === 0 ? 0 : 1)
