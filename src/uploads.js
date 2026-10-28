import { useEffect, useState } from 'react'

// Files a planner drops in by hand, for data or documents that no connected system sends.
// Everything stays in this browser: the file itself goes into IndexedDB, and nothing is
// uploaded anywhere. There is no server in this demo.

export const MAX_BYTES = 50 * 1024 * 1024        // 50 MB per file

// ---------- what a file is ----------
const EXT = (name) => (name.split('.').pop() || '').toLowerCase()

const SHEET_EXT = ['csv', 'xlsx', 'xls', 'xlsm', 'tsv']
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic']
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v']
const DOC_EXT = ['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx']
const TEXT_EXT = ['txt', 'log', 'json', 'xml', 'md']

// One word for the shape of the file, which decides the preview it gets.
export function classify(name, mime = '') {
  const e = EXT(name)
  if (SHEET_EXT.includes(e) || mime.includes('spreadsheet') || mime === 'text/csv') return 'sheet'
  if (IMAGE_EXT.includes(e) || mime.startsWith('image/')) return 'image'
  if (VIDEO_EXT.includes(e) || mime.startsWith('video/')) return 'video'
  if (e === 'pdf' || mime === 'application/pdf') return 'pdf'
  if (DOC_EXT.includes(e) || mime.includes('word') || mime.includes('presentation')) return 'doc'
  if (TEXT_EXT.includes(e) || mime.startsWith('text/')) return 'text'
  return 'other'
}

const PLAIN = {
  csv: 'CSV spreadsheet', tsv: 'TSV spreadsheet', xlsx: 'Excel workbook', xlsm: 'Excel workbook', xls: 'Excel workbook (old format)',
  pdf: 'PDF document', doc: 'Word document', docx: 'Word document', odt: 'Word document', rtf: 'Word document',
  ppt: 'PowerPoint deck', pptx: 'PowerPoint deck',
  jpg: 'JPEG image', jpeg: 'JPEG image', png: 'PNG image', gif: 'GIF image', webp: 'WebP image', bmp: 'Bitmap image', svg: 'SVG image', heic: 'HEIC photo',
  mp4: 'MP4 video', mov: 'QuickTime video', webm: 'WebM video', avi: 'AVI video', mkv: 'Matroska video', m4v: 'MP4 video',
  txt: 'Text file', log: 'Log file', json: 'JSON file', xml: 'XML file', md: 'Markdown file', zip: 'Zip archive',
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// "PDF document, 1.2 MB"
export function describe(name, size, mime = '') {
  const e = EXT(name)
  const kind = PLAIN[e] || (mime ? mime.split('/').pop().toUpperCase() + ' file' : 'File')
  return `${kind}, ${fmtBytes(size)}`
}

// ---------- what the planner says the file is ----------
// `columns` are the ones a data file must contain; documents need none.
export const KINDS = [
  { id: 'sales', label: 'Sales history', data: true, columns: ['Product', 'Region', 'Week', 'Tonnes'],
    sample: [['Utensil Circles 304, 0.8 mm', 'North', '2026-10-19', '112.4']] },
  { id: 'stock', label: 'Stock on hand', data: true, columns: ['Product', 'Tonnes'],
    sample: [['Utensil Circles 304, 0.8 mm', '441.0']] },
  { id: 'orders', label: 'Customer orders', data: true, columns: ['Order', 'Customer', 'Product', 'Week', 'Tonnes'],
    sample: [['SO-10412', 'Kitchenware Maker (North)', 'Utensil Circles 304, 0.8 mm', '2026-11-02', '38.5']] },
  { id: 'po', label: 'Purchase orders', data: true, columns: ['Order', 'Material', 'Quantity', 'Due'],
    sample: [['PO-26-3311', 'Stainless steel scrap', '1300', '2026-11-01']] },
  { id: 'supplier', label: 'Supplier document', data: false, hint: 'invoice, delivery note, quality certificate' },
  { id: 'media', label: 'Plant photo or video', data: false },
  { id: 'other', label: 'Other', data: false },
]
export const kindOf = (id) => KINDS.find(k => k.id === id) || KINDS[KINDS.length - 1]

// A sensible first guess, so the planner usually just confirms it.
export function guessKind(name, mime = '') {
  const shape = classify(name, mime)
  const n = name.toLowerCase()
  if (shape === 'image' || shape === 'video') return 'media'
  if (shape === 'pdf' || shape === 'doc') return 'supplier'
  if (shape === 'sheet') {
    if (n.includes('stock') || n.includes('inventory')) return 'stock'
    if (n.includes('purchase') || n.startsWith('po')) return 'po'
    if (n.includes('order')) return 'orders'
    return 'sales'
  }
  return 'other'
}

// ---------- reading a spreadsheet ----------
// SheetJS is big, so it is only fetched the first time someone drops a spreadsheet in.
let _xlsx = null
async function sheetjs() {
  if (!_xlsx) _xlsx = await import('xlsx')
  return _xlsx
}

export async function readSheet(file) {
  const XLSX = await sheetjs()
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, sheetStubs: false })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [], rowCount: 0, sheetName: null, sheets: [] }
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: '' })
  const headers = (grid[0] || []).map(h => String(h ?? '').trim())
  const rows = grid.slice(1).filter(r => r.some(c => String(c ?? '').trim() !== ''))
  return {
    headers,
    rows: rows.map(r => headers.map((_, i) => fmtCell(r[i]))),
    rowCount: rows.length,
    sheetName,
    sheets: wb.SheetNames,
  }
}

const fmtCell = (v) => {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return String(v)
}

// ---------- checking a data file ----------
// Headers are matched loosely: case, spaces, underscores and a trailing unit are ignored,
// so "tonnes", "Tonnes (t)" and "TONNES" all count as the Tonnes column.
const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '')

export function checkColumns(kindId, headers) {
  const need = kindOf(kindId).columns || []
  const have = headers.map(norm)
  const found = [], missing = []
  for (const c of need) (have.includes(norm(c)) ? found : missing).push(c)
  return { need, found, missing, ok: missing.length === 0 }
}

// How many of the site's own products (or materials) the file actually mentions.
export function matchNames(headers, rows, products, materials) {
  const col = headers.findIndex(h => ['product', 'item', 'sku', 'material'].includes(norm(h)))
  if (col < 0) return null
  const isMaterial = norm(headers[col]) === 'material'
  const list = isMaterial ? materials : products
  const seen = new Map()   // lower-cased value -> the spelling used in the file
  for (const r of rows) {
    const raw = String(r[col] ?? '').trim()
    if (raw) seen.set(raw.toLowerCase(), raw)
  }
  let matched = 0
  const unmatched = []
  for (const x of list) {
    if (seen.has(x.name.toLowerCase()) || seen.has(String(x.id).toLowerCase())) matched++
  }
  for (const [lower, original] of seen) {
    if (!list.some(x => x.name.toLowerCase() === lower || String(x.id).toLowerCase() === lower)) unmatched.push(original)
  }
  return { matched, total: list.length, what: isMaterial ? 'materials' : 'products', unmatched: unmatched.slice(0, 5) }
}

// ---------- a downloadable template ----------
export function templateCsv(kindId) {
  const k = kindOf(kindId)
  if (!k.columns) return null
  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [k.columns.map(esc).join(',')]
  for (const row of k.sample || []) lines.push(row.map(esc).join(','))
  return lines.join('\r\n') + '\r\n'
}

// ---------- the problems a person can actually fix ----------
export function fileProblem(file) {
  if (file.size === 0) return `${file.name} is empty — there is nothing in the file to read.`
  if (file.size > MAX_BYTES) {
    return `${file.name} is ${fmtBytes(file.size)}. The limit is ${fmtBytes(MAX_BYTES)} per file — please split it or send a smaller export.`
  }
  return null
}

// =====================================================================
// Where the files live: IndexedDB, so they survive a refresh.
// =====================================================================
const DB_NAME = 'dp.uploads'
const STORE = 'files'
let _db = null

function db() {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _db
}

const tx = async (mode, fn) => {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const out = fn(store)
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
  })
}

export const listFiles = async () => {
  try {
    const all = await tx('readonly', (s) => s.getAll())
    return (all || []).sort((a, b) => b.at - a.at)
  } catch { return [] }
}
export const putFile = async (rec) => { try { await tx('readwrite', (s) => s.put(rec)); notify() } catch { /* storage blocked */ } }
export const deleteFile = async (id) => { try { await tx('readwrite', (s) => s.delete(id)); notify() } catch { /* storage blocked */ } }

// Pages that show files subscribe here, so the upload page, the product page and the
// material page never disagree about what has been uploaded.
const listeners = new Set()
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const notify = () => listeners.forEach(fn => { try { fn() } catch { /* ignore */ } })

// Object URLs are made once per file and reused, then released on request.
const urls = new Map()
export function urlFor(rec) {
  if (!rec?.blob) return null
  if (!urls.has(rec.id)) {
    try { urls.set(rec.id, URL.createObjectURL(rec.blob)) } catch { return null }
  }
  return urls.get(rec.id)
}
export function releaseUrl(id) {
  const u = urls.get(id)
  if (u) { try { URL.revokeObjectURL(u) } catch { /* ignore */ } urls.delete(id) }
}

export const newId = () => `UP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

// ---------- how many pages a PDF has ----------
// Read from the file's own page tree. Some PDFs compress that away, in which case
// nothing is shown rather than a guess.
export async function pdfPageCount(file) {
  try {
    const head = await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer()
    const text = new TextDecoder('latin1').decode(new Uint8Array(head))
    const byType = (text.match(/\/Type\s*\/Page[^s]/g) || []).length
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map(m => Number(m[1]))
    const n = Math.max(byType, counts.length ? Math.max(...counts) : 0)
    return n > 0 ? n : null
  } catch { return null }
}

// ---------- the list of uploaded files, shared by every page that shows them ----------

export function useFiles() {
  const [files, setFiles] = useState([])
  useEffect(() => {
    let alive = true
    const load = () => listFiles().then(f => { if (alive) setFiles(f) })
    load()
    return subscribe(load)
  }, [])
  return files
}

// the files pinned to one product or material
export const filesFor = (files, type, id) => files.filter(f => f.link && f.link.type === type && f.link.id === id)
