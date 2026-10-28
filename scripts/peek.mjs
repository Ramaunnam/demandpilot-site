// Print one screen as plain text, the way a reader would see it. No browser needed.
//
//   node scripts/peek.mjs command
//   node scripts/peek.mjs systems
//   node scripts/peek.mjs product 316L-CR-1
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
  entryPoints: [join(root, 'scripts', 'entry.jsx')],
  bundle: true, format: 'esm', platform: 'node', outfile: join(out, 'peek.mjs'),
  external: ['react', 'react-dom', 'react-dom/server'], jsx: 'automatic', logLevel: 'error',
})
const app = await import(pathToFileURL(join(out, 'peek.mjs')).href)
const { PAGES, Ctx, buildData, computePlan, DEFAULT_SETTINGS } = app

const data = buildData()
const state = {
  settings: { ...DEFAULT_SETTINGS }, decisions: {}, approved: [], approvedIds: {},
  rejected: {}, edits: {}, dismissed: {}, log: [], poSeq: 3400, sync: {},
}
const plan = computePlan(data, state)
const noop = () => {}
const ctx = {
  data, plan, state, route: {}, go: noop, notify: noop, openSettings: noop,
  act: {
    approveBuy: noop, rejectBuy: noop, editQty: noop, decideChange: noop, approveDecision: noop,
    dismiss: noop, setting: noop, reset: noop, syncSystem: noop, syncAll: noop,
  },
}

const page = process.argv[2] || 'command'
const id = process.argv[3] || null
if (!PAGES[page]) {
  console.error(`No such screen: ${page}. Try one of: ${Object.keys(PAGES).join(', ')}`)
  process.exit(1)
}

const NL = String.fromCharCode(10)
const html = renderToStaticMarkup(React.createElement(Ctx.Provider, { value: ctx }, React.createElement(PAGES[page], { id })))
const text = html
  .replace(/<[/](tr|div|section|h1|h2|h3|p|li|table)>/g, NL)
  .replace(/<[/](td|th|span|b|button|small|output)>/g, ' | ')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&')
  .replace(/&#x27;/g, String.fromCharCode(39))
  .replace(/&quot;/g, String.fromCharCode(34))
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&nbsp;/g, ' ')
  .split(NL)
  .map(l => l.replace(/[ ]*[|][ ]*$/, '').replace(/[ ][ ]+/g, ' ').trim())
  .filter(Boolean)
  .join(NL)

console.log(text)
