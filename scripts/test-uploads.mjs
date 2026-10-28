// Drives the upload logic with a real CSV, Excel workbook, JPEG, PDF and MP4 —
// the same functions the page calls when you drop a file on it.
//
//   node scripts/test-uploads.mjs
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'node_modules', '.dp-check')
mkdirSync(out, { recursive: true })

await build({
  entryPoints: [join(root, 'src', 'uploads.js')], bundle: true, format: 'esm', platform: 'node',
  outfile: join(out, 'uploads.mjs'), external: ['react', 'xlsx'], logLevel: 'error',
})
const U = await import(pathToFileURL(join(out, 'uploads.mjs')).href)

await build({
  entryPoints: [join(root, 'scripts', 'entry.jsx')], bundle: true, format: 'esm', platform: 'node',
  outfile: join(out, 'up-entry.mjs'), external: ['react', 'react-dom', 'react-dom/server', 'xlsx'],
  jsx: 'automatic', logLevel: 'error', loader: { '.png': 'dataurl' },
})
const App = await import(pathToFileURL(join(out, 'up-entry.mjs')).href)
const plan = App.computePlan(App.buildData(), {
  settings: { ...App.DEFAULT_SETTINGS }, decisions: {}, approved: [], approvedIds: {},
  rejected: {}, edits: {}, dismissed: {}, log: [], poSeq: 3400, sync: {},
})

let fail = 0
const bad = (m) => { fail++; console.log('   ✗ ' + m) }
const ok = (m) => console.log('   ✓ ' + m)
const is = (got, want, what) => (got === want ? ok(`${what}: ${got}`) : bad(`${what}: got ${got}, expected ${want}`))

// ---------- build the five files ----------
const products = plan.products, materials = plan.materials

// 1. CSV — sales history, 34 of the 36 real products plus two that do not exist
const named = products.slice(0, 34)
const csvRows = [['Product', 'Region', 'Week', 'Tonnes']]
named.forEach((p, i) => csvRows.push([p.name, ['North', 'South', 'East', 'West'][i % 4], '2026-10-19', (80 + i).toFixed(1)]))
csvRows.push(['Widget That We Do Not Make', 'North', '2026-10-19', '5.0'])
csvRows.push(['Another Unknown Item', 'South', '2026-10-19', '7.5'])
const csv = csvRows.map(r => r.map(v => (/[",\n]/.test(v) ? `"${v}"` : v)).join(',')).join('\r\n')
const csvFile = new File([csv], 'sales-history-oct.csv', { type: 'text/csv' })

// 2. Excel — stock on hand
const wsData = [['Product', 'Tonnes (t)'], ...products.slice(0, 10).map(p => [p.name, Math.round(p.onHand)])]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Stock')
const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
const xlsxFile = new File([xlsxBuf], 'stock-on-hand.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

// 3. JPEG — smallest valid baseline JPEG
const jpg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')
const jpgFile = new File([jpg], 'cold-mill-line.jpg', { type: 'image/jpeg' })

// 4. PDF — a real two-page document
const pdf = Buffer.from(`%PDF-1.4
1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<</Type /Pages /Kids[3 0 R 4 0 R] /Count 2>>endobj
3 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 595 842]>>endobj
4 0 obj<</Type /Page /Parent 2 0 R /MediaBox[0 0 595 842]>>endobj
trailer<</Root 1 0 R>>
%%EOF`, 'latin1')
const pdfFile = new File([pdf], 'supplier-invoice-4471.pdf', { type: 'application/pdf' })

// 5. MP4 — a real ftyp/moov container header
const mp4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom', 'latin1'),
  Buffer.from([0, 0, 2, 0]), Buffer.from('isomiso2', 'latin1'),
  Buffer.from([0, 0, 0, 8]), Buffer.from('free', 'latin1'),
])
const mp4File = new File([mp4], 'furnace-tapping.mp4', { type: 'video/mp4' })

const FILES = [csvFile, xlsxFile, jpgFile, pdfFile, mp4File]

console.log('\n1. Recognising each file')
const EXPECT = {
  'sales-history-oct.csv': ['sheet', 'sales', 'CSV spreadsheet'],
  'stock-on-hand.xlsx': ['sheet', 'stock', 'Excel workbook'],
  'cold-mill-line.jpg': ['image', 'media', 'JPEG image'],
  'supplier-invoice-4471.pdf': ['pdf', 'supplier', 'PDF document'],
  'furnace-tapping.mp4': ['video', 'media', 'MP4 video'],
}
for (const f of FILES) {
  const [shape, kind, plain] = EXPECT[f.name]
  const gotShape = U.classify(f.name, f.type)
  const gotKind = U.guessKind(f.name, f.type)
  const gotDesc = U.describe(f.name, f.size, f.type)
  const good = gotShape === shape && gotKind === kind && gotDesc.startsWith(plain)
  const line = `${f.name.padEnd(27)} ${gotShape.padEnd(6)} ${U.kindOf(gotKind).label.padEnd(18)} "${gotDesc}"`
  good ? ok(line) : bad(`${line}  (expected ${shape}/${kind}/${plain})`)
}

console.log('\n2. Reading the spreadsheets')
{
  const sheet = await U.readSheet(csvFile)
  is(sheet.rowCount, 36, 'CSV rows')
  is(sheet.headers.join(','), 'Product,Region,Week,Tonnes', 'CSV columns')
  const checks = U.checkColumns('sales', sheet.headers)
  is(checks.ok, true, 'CSV required columns all present')
  const m = U.matchNames(sheet.headers, sheet.rows, products, materials)
  is(`${m.matched} of ${m.total} ${m.what} matched`, '34 of 36 products matched', 'name matching')
  is(m.unmatched.length, 2, 'unrecognised names reported')
  ok(`unrecognised: ${m.unmatched.map(u => `"${u}"`).join(', ')}`)
  is(sheet.rows.slice(0, 5).length, 5, 'first 5 rows available for the preview')
  console.log('      preview row 1: ' + sheet.rows[0].join(' | '))
}
{
  const sheet = await U.readSheet(xlsxFile)
  is(sheet.rowCount, 10, 'Excel rows')
  is(sheet.sheetName, 'Stock', 'Excel sheet name')
  // "Tonnes (t)" must still count as the Tonnes column
  const checks = U.checkColumns('stock', sheet.headers)
  is(checks.ok, true, 'Excel required columns all present (unit suffix ignored)')
  const m = U.matchNames(sheet.headers, sheet.rows, products, materials)
  is(`${m.matched} of ${m.total}`, '10 of 36', 'Excel name matching')
  console.log('      preview row 1: ' + sheet.rows[0].join(' | '))
}

console.log('\n3. PDF page count')
is(await U.pdfPageCount(pdfFile), 2, 'pages found in the PDF')

console.log('\n4. Problems a person can fix')
{
  const empty = new File([], 'nothing.csv', { type: 'text/csv' })
  const p1 = U.fileProblem(empty)
  p1 && p1.includes('empty') ? ok(`empty file: "${p1}"`) : bad('an empty file was not rejected')

  const huge = { name: 'huge-export.xlsx', size: 64 * 1024 * 1024, type: '' }
  const p2 = U.fileProblem(huge)
  p2 && p2.includes('limit') ? ok(`oversized file: "${p2}"`) : bad('a 64 MB file was not rejected')

  is(U.fileProblem(csvFile), null, 'a good file has no problem')

  const wrong = new File(['Item,Qty\r\nA,1\r\n'], 'wrong-columns.csv', { type: 'text/csv' })
  const s = await U.readSheet(wrong)
  const c = U.checkColumns('sales', s.headers)
  c.ok === false && c.missing.length === 4
    ? ok(`missing columns named: ${c.missing.join(', ')}`)
    : bad(`missing-column check wrong: ${JSON.stringify(c)}`)
}

console.log('\n5. Templates')
for (const k of U.KINDS.filter(x => x.data)) {
  const t = U.templateCsv(k.id)
  const head = t.split('\r\n')[0]
  head === k.columns.join(',') ? ok(`${k.label}: ${head}`) : bad(`${k.label} template header is ${head}`)
}
U.templateCsv('media') === null ? ok('documents correctly have no template') : bad('a document offered a template')

console.log('\n6. The page renders with uploaded files on it')
{
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  globalThis.indexedDB = undefined          // storage unavailable: must still render
  const noop = () => {}
  const ctx = {
    data: App.buildData(), plan, state: { sync: {} }, route: {}, go: noop, notify: noop, openSettings: noop,
    act: { syncSystem: noop, syncAll: noop, approveBuy: noop, rejectBuy: noop, editQty: noop, decideChange: noop, approveDecision: noop, dismiss: noop, setting: noop, reset: noop },
  }
  const html = renderToStaticMarkup(React.createElement(App.Ctx.Provider, { value: ctx }, React.createElement(App.PAGES.systems)))
  const text = html.replace(/<[^>]*>/g, ' ')
  for (const want of ['Upload files', 'Drag files here', 'Choose files', 'Upload history', 'Demo: files stay on this computer']) {
    text.includes(want) ? ok(`shows "${want}"`) : bad(`"${want}" is missing from the page`)
  }
  for (const token of ['NaN', 'undefined', 'Infinity']) {
    text.includes(token) ? bad(`page shows "${token}"`) : null
  }
  ok('no NaN / undefined on the page, and it renders without IndexedDB')
}

// keep the five files so they can be dropped on the real page by hand
const dir = join(root, 'sample-files')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'sales-history-oct.csv'), csv)
writeFileSync(join(dir, 'stock-on-hand.xlsx'), Buffer.from(xlsxBuf))
writeFileSync(join(dir, 'cold-mill-line.jpg'), jpg)
writeFileSync(join(dir, 'supplier-invoice-4471.pdf'), pdf)
writeFileSync(join(dir, 'furnace-tapping.mp4'), mp4)
console.log(`\nSample files written to sample-files/ so they can be dropped on the real page.`)
console.log(fail === 0 ? '\nAll upload checks passed.\n' : `\n${fail} upload check(s) failed.\n`)
process.exit(fail === 0 ? 0 : 1)
