// Approves a real order on the Buy screen, then follows it to the Orders screen,
// to see exactly what a person does and does not see afterwards.
//
//   node scripts/test-order.mjs
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
  outfile: join(out, 'ord-app.mjs'), external: ['react', 'react-dom', 'react-dom/client', 'xlsx'],
  jsx: 'automatic', logLevel: 'error', loader: { '.png': 'dataurl' },
})
const { App } = await import(pathToFileURL(join(out, 'ord-app.mjs')).href)
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

let fail = 0
const bad = (m) => { fail++; console.log('   ✗ ' + m) }
const ok = (m) => console.log('   ✓ ' + m)
const info = (m) => console.log('     ' + m)

const root$ = createRoot(document.getElementById('root'))
await act(async () => { root$.render(React.createElement(App)) })
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]
const title = () => $('.ph h1')?.textContent?.trim() ?? '(none)'
const click = async (el) => { if (!el) throw new Error('nothing to click'); await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) }); await settle() }
const nav = (label) => $$('.nav button').find(b => b.textContent.trim().startsWith(label))
const text = () => document.body.textContent

console.log('\n1. Approve an order on the Buy screen')
await click(nav('Buy'))
info(`on "${title()}"`)
const firstRow = $$('.drow')[0]
const matName = firstRow?.querySelector('.link.name')?.textContent?.trim()
const approve = [...firstRow.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve')
info(`approving the first order: ${matName}`)
await click(approve)
const toast = $('.toast')?.textContent?.trim()
toast ? ok(`toast said: "${toast}"`) : bad('no toast after approving')

console.log('\n2. Does the Buy screen show it?')
const placedCard = text().includes('Orders placed this session')
placedCard ? ok('Buy shows an "Orders placed this session" table') : bad('Buy does not show what was just placed')
const poOnBuy = (text().match(/PO-26-\d+/g) || [])[0]
poOnBuy ? ok(`the new purchase order number is ${poOnBuy}`) : bad('no PO number shown on Buy')

console.log('\n3. Go to Orders — what does a person actually see?')
await click(nav('Orders'))
info(`on "${title()}"`)
const tabs = $$('.seg button').map(b => `${b.textContent.trim()}${b.className.includes('on') ? '  <= showing' : ''}`)
info('tabs: ' + tabs.join('   |   '))
const visible = text()
if (poOnBuy && visible.includes(poOnBuy)) {
  ok(`the new order ${poOnBuy} is listed on the tab that opens`)
} else {
  // a purchase order belongs with the material orders, so the page must say so
  const banner = [...document.querySelectorAll(".alert")].map(a => a.textContent).join(" ")
  const hasBanner = new RegExp("placed this session").test(banner)
  hasBanner ? ok("a banner explains where the new order went: \"" + banner.replace(/s+/g, " ").trim().slice(0, 110) + "...\"")
    : bad("nothing tells a person the order moved to the Material orders tab")
  const showBtn = [...document.querySelectorAll(".alert button")].find(b => b.textContent.includes("Show"))
  if (showBtn) {
    await click(showBtn)
    text().includes(poOnBuy) ? ok("its \"Show\" button reveals " + poOnBuy) : bad("the Show button did not reveal the order")
  } else bad("no one-click way to reach it")
}

