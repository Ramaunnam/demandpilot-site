// Clicks every kind of action and follows it to the screen that should now show it.
//   node scripts/test-flow.mjs
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'node_modules', '.dp-check')
mkdirSync(out, { recursive: true })

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
const { window } = dom
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent',
  'getComputedStyle', 'location', 'history', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }) } catch { /* keep node's */ }
}
globalThis.ResizeObserver = window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
window.matchMedia = globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
window.scrollTo = globalThis.scrollTo = () => {}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

await build({
  entryPoints: [join(root, 'scripts', 'entry.jsx')], bundle: true, format: 'esm', platform: 'node',
  outfile: join(out, 'flow-app.mjs'), external: ['react', 'react-dom', 'react-dom/client', 'xlsx'],
  jsx: 'automatic', logLevel: 'error', loader: { '.png': 'dataurl' },
})
const { App } = await import(pathToFileURL(join(out, 'flow-app.mjs')).href)
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

let fail = 0
const bad = (m) => { fail++; console.log('   X ' + m) }
const ok = (m) => console.log('   . ' + m)
const info = (m) => console.log('     ' + m)

const errors = []
const realErr = console.error
console.error = (...a) => { const s = a.join(' '); if (!/not wrapped in act|useLayoutEffect|ReactDOMTestUtils/.test(s)) errors.push(s) }

const root$ = createRoot(document.getElementById('root'))
await act(async () => { root$.render(React.createElement(App)) })
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const title = () => $('.ph h1')?.textContent?.trim() ?? '(none)'
const txt = () => document.body.textContent
const click = async (el) => { if (!el) throw new Error('nothing to click'); await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }); await settle() }
const nav = (l) => $$('.nav button').find(b => b.textContent.trim().startsWith(l))
const btn = (label, scope = document) => [...scope.querySelectorAll('button')].find(b => b.textContent.trim() === label)
const rowFor = (type) => $$('.drow').find(r => r.querySelector('.tag')?.textContent.trim() === type)

console.log('\n1. Decide a sales change, right where you see it')
await click(nav('Decisions'))
const chgRow = rowFor('Sales change')
if (!chgRow) bad('no sales-change decision on the list')
else {
  const name = chgRow.querySelector('.link.name').textContent.trim()
  const labels = [...chgRow.querySelectorAll('.acts button')].map(b => b.textContent.trim())
  info(`"${name}"`)
  labels.join(',').includes('Plan for it') && labels.join(',').includes('Ignore')
    ? ok(`buttons are: ${labels.join(' / ')}`)
    : bad(`expected Plan for it / Ignore / See sales, got: ${labels.join(' / ')}`)
  await click(btn('Ignore', chgRow))
  ok('clicked "Ignore"')
  txt().includes('What you did') ? ok('it is recorded under "What you did"') : bad('nothing recorded')
  const act1 = $$('.tbl tbody tr').find(r => r.textContent.includes(name))
  act1 ? ok(`the trail shows: ${act1.querySelector('.tag').textContent.trim()} — ${name}`) : bad('the change is not in the trail')
}

console.log('\n2. Approve "Make more" -> a production order appears in Orders')
await click(nav('Decisions'))
const makeRow = rowFor('Make more')
if (!makeRow) bad('no "Make more" decision on the list')
else {
  const name = makeRow.querySelector('.link.name').textContent.trim()
  info(`"${name}"`)
  await click(btn('Approve', makeRow))
  const wo = (txt().match(/WO-26-\d+/) || [])[0]
  wo ? ok(`production order ${wo} raised`) : bad('no production order number appeared')
  await click(nav('Orders'))
  const woTab = $$('.seg button').find(b => b.textContent.includes('Production orders'))
  woTab ? ok(`Orders has a tab "${woTab.textContent.trim()}"`) : bad('Orders has no Production orders tab')
  await click(woTab)
  wo && txt().includes(wo) ? ok(`${wo} is listed in Orders`) : bad(`${wo} not found in Orders`)
  txt().includes(name.slice(0, 18)) ? ok('the product name is on the row') : bad('product name missing from the row')
}

console.log('\n3. Approve an order on Buy -> it reaches Orders')
await click(nav('Buy'))
const buyRow = $$('.drow')[0]
const matName = buyRow.querySelector('.link.name').textContent.trim()
await click(btn('Approve', buyRow))
const po = (txt().match(/PO-26-\d+/) || [])[0]
po ? ok(`purchase order ${po} placed for ${matName}`) : bad('no PO raised')
await click(nav('Orders'))
await click($$('.seg button').find(b => b.textContent.includes('Material orders')))
po && txt().includes(po) ? ok(`${po} is listed in Orders`) : bad(`${po} not in Orders`)

console.log('\n4. Reject an order -> it is kept under "Not ordered"')
await click(nav('Buy'))
const rejRow = $$('.drow')[0]
const rejName = rejRow.querySelector('.link.name').textContent.trim()
await click(btn('Reject', rejRow))
info(`rejected ${rejName}`)
txt().includes('Not ordered') ? ok('a "Not ordered" list appeared on Buy') : bad('rejected order vanished with no record')
btn('Put it back') ? ok('it offers "Put it back"') : bad('no way to undo a rejection')

console.log('\n5. Undo puts it back on the list')
const before = $$('.drow').length
await click(btn('Put it back'))
const after = $$('.drow').length
after > before ? ok(`the order is back on Buy (${before} -> ${after} rows)`) : bad(`undo did not restore it (${before} -> ${after})`)
txt().includes('Not ordered') ? bad('the "Not ordered" list still shows it') : ok('it left the "Not ordered" list')

console.log('\n6. Everything done is listed in one place, with a way back')
await click(nav('Decisions'))
const trail = $$('.tbl tbody tr').filter(r => r.querySelector('.tag'))
info(`"What you did" has ${trail.length} row(s):`)
for (const r of trail.slice(0, 6)) {
  const cells = [...r.querySelectorAll('td')].map(c => c.textContent.trim())
  info(`   ${cells[0]}  ${cells[1]}  —  ${cells[2].slice(0, 52)}`)
}
trail.length >= 3 ? ok('every action was recorded') : bad(`expected several actions, found ${trail.length}`)
const opens = trail.filter(r => [...r.querySelectorAll('button')].some(b => /See|Open/.test(b.textContent)))
opens.length === trail.length ? ok('every row links to the screen that now shows it') : bad(`${trail.length - opens.length} row(s) have no link`)
const undos = trail.filter(r => [...r.querySelectorAll('button')].some(b => b.textContent.trim() === 'Undo'))
undos.length === trail.length ? ok('every row can be undone') : bad(`${trail.length - undos.length} row(s) cannot be undone`)

console.log('\n7. No errors')
errors.length ? bad(`${errors.length} error(s): ${errors[0].slice(0, 150)}`) : ok('no React or runtime errors')
for (const t of ['NaN', 'Infinity', 'undefined']) if (txt().includes(t)) bad(`screen shows "${t}"`)
ok('no NaN / undefined on screen')

console.log(fail === 0 ? '\nAll flow checks passed.\n' : `\n${fail} issue(s) found.\n`)
process.exit(fail === 0 ? 0 : 1)
