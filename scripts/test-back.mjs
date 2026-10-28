// Clicks the real app through Command Centre -> Act now item -> Product -> Material
// and back again, in a DOM, checking the top-bar Back button, the "Back to X" link,
// the browser's own Back button, and that filters survive the round trip.
//
//   node scripts/test-back.mjs
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'node_modules', '.dp-check')
mkdirSync(out, { recursive: true })

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
})
const { window } = dom
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLSelectElement', 'Node', 'Event', 'MouseEvent',
  'getComputedStyle', 'location', 'history', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  // node 24 defines some of these as getter-only, so define rather than assign
  try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }) } catch { /* keep node's */ }
}
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = globalThis.ResizeObserver
window.matchMedia = globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
window.scrollTo = globalThis.scrollTo = () => {}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

await build({
  entryPoints: [join(root, 'scripts', 'entry.jsx')], bundle: true, format: 'esm', platform: 'node',
  outfile: join(out, 'back-app.mjs'), external: ['react', 'react-dom', 'react-dom/client', 'xlsx'],
  jsx: 'automatic', logLevel: 'error', loader: { '.png': 'dataurl' },
})
const { App } = await import(pathToFileURL(join(out, 'back-app.mjs')).href)
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

let fail = 0
const bad = (m) => { fail++; console.log('   ✗ ' + m) }
const ok = (m) => console.log('   ✓ ' + m)

const errors = []
const realError = console.error
console.error = (...a) => { const s = a.join(' '); if (!/not wrapped in act|useLayoutEffect|ReactDOMTestUtils/.test(s)) errors.push(s); realError.apply(console, a) }

const root$ = createRoot(document.getElementById('root'))
await act(async () => { root$.render(React.createElement(App)) })
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const title = () => $('.ph h1')?.textContent?.trim() ?? '(none)'
const backBtn = () => $('.back-btn')
const backLink = () => $('.backlink')
const click = async (el) => {
  if (!el) throw new Error('nothing to click')
  await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  await settle()
}
const browserBack = async () => {
  await act(async () => { window.history.back(); await new Promise(r => setTimeout(r, 20)) })
  await settle()
}

console.log('\n1. Command Centre: nothing to go back to')
console.log(`      on screen: "${title()}"   hash: ${window.location.hash || '(none)'}`)
backBtn() ? bad('the Back button is showing with nowhere to go') : ok('Back button is hidden on the Command Centre')

console.log('\n2. Command Centre -> Act now item -> Product -> Material')
const trail = []
// the first decision in "Act now" links to a product or material
const actNow = $$('.drow .link.name')[0]
await click(actNow)
trail.push(title())
console.log(`      clicked the first "Act now" item  ->  "${title()}"  ${window.location.hash}`)
backBtn() ? ok(`Back button appeared, pointing at "${backBtn().getAttribute('title')}"`) : bad('no Back button after navigating')
backLink() ? ok(`detail page shows "${backLink().textContent.trim()}"`) : bad('detail page has no "Back to ..." link')

// from there, open a material from the recipe table (product) or a product (material)
const row = $$('.tbl tbody tr.click')[0]
await click(row)
trail.push(title())
console.log(`      opened a linked row               ->  "${title()}"  ${window.location.hash}`)
backLink() ? ok(`now shows "${backLink().textContent.trim()}"`) : bad('no "Back to ..." link on the second detail page')

console.log('\n3. Back, Back, Back returns the same way')
await click(backBtn())
console.log(`      Back ->  "${title()}"`)
title() === trail[0] ? ok(`returned to "${trail[0]}"`) : bad(`expected "${trail[0]}", got "${title()}"`)

await click(backBtn())
console.log(`      Back ->  "${title()}"`)
title() === 'Command Centre' ? ok('returned to the Command Centre') : bad(`expected Command Centre, got "${title()}"`)

backBtn() ? bad('Back is still showing at the start of the trail') : ok('Back button hidden again at the start')

console.log('\n4. The browser\'s own Back button')
await click($$('.nav button')[3] || $$('.nav button')[1])      // jump to another screen from the rail
const away = title()
console.log(`      navigated to "${away}" from the side rail`)
await browserBack()
console.log(`      browser Back ->  "${title()}"`)
title() === 'Command Centre' ? ok('the browser Back button works too') : bad(`browser Back gave "${title()}"`)

console.log('\n5. A filter survives leaving the page and coming back')
{
  const nav = $$('.nav button').find(b => b.textContent.includes('Products'))
  await click(nav)
  const sel = $('select')
  const group = sel?.options?.[2]?.value
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sel, group)
    sel.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await settle()
  console.log(`      set the product group filter to "${group}"`)
  await click($$('.tbl tbody tr.click')[0])
  console.log(`      opened "${title()}"`)
  await click(backBtn())
  const back = $('select')?.value
  console.log(`      Back -> "${title()}", filter is "${back}"`)
  back === group ? ok('the filter was restored') : bad(`filter came back as "${back}", expected "${group}"`)
}

console.log('\n6. No errors along the way')
errors.length ? bad(`${errors.length} console error(s): ${errors[0].slice(0, 160)}`) : ok('no React or runtime errors')
const body = document.body.textContent
for (const t of ['NaN', 'Infinity', 'undefined']) {
  body.includes(t) ? bad(`the page shows "${t}"`) : null
}
ok('no NaN / undefined on screen')

console.log(fail === 0 ? '\nAll back-navigation checks passed.\n' : `\n${fail} check(s) failed.\n`)
process.exit(fail === 0 ? 0 : 1)
