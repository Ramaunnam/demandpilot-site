import React, { useEffect, useRef, useState } from 'react'
import { SYSTEMS, FLOW, HIST } from '../data.js'
import { fmtNum } from '../engine.js'
import { useApp, Head, Card, Tile, Pill, Icon, Empty } from '../ui.jsx'
import {
  KINDS, kindOf, MAX_BYTES, classify, describe, fmtBytes, guessKind, readSheet, checkColumns,
  matchNames, templateCsv, fileProblem, pdfPageCount, putFile, deleteFile, urlFor, releaseUrl,
  newId, useFiles,
} from '../uploads.js'

// Each system's last sync is a clock time today, unless it has been synced in this session.
const todayAt = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return d.getTime()
}
const clock = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const ago = (ms) => {
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60), r = mins % 60
  if (h < 24) return r ? `${h} h ${r} min ago` : `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

const download = (name, text, mime = 'text/csv;charset=utf-8') => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }))
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  } catch { /* download blocked */ }
}

// ---------- the preview that suits each kind of file ----------
function Preview({ item, onZoom }) {
  const shape = item.shape
  const url = item.url

  if (shape === 'sheet') {
    if (item.readError) return <div className="up-note bad">This spreadsheet could not be read: {item.readError}</div>
    if (!item.sheet) return <div className="up-note">Reading the spreadsheet…</div>
    const { headers, rows, rowCount } = item.sheet
    return (
      <div>
        <div className="up-rowline">
          <b>{fmtNum(rowCount)}</b> row{rowCount === 1 ? '' : 's'} · {headers.length} column{headers.length === 1 ? '' : 's'}
          {item.sheet.sheetName && <> · sheet “{item.sheet.sheetName}”</>}
        </div>
        <div className="tbl-wrap up-peek">
          <table className="tbl">
            <thead><tr>{headers.map((h, i) => <th scope="col" key={i}>{h || `Column ${i + 1}`}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => <tr key={i}>{headers.map((_, c) => <td key={c}>{r[c]}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        {rowCount > 5 && <div className="note" style={{ marginTop: 4 }}>First 5 rows of {fmtNum(rowCount)}.</div>}
      </div>
    )
  }

  if (shape === 'image') {
    return url
      ? <button className="up-thumb" onClick={onZoom} title="Click to view full size">
        <img src={url} alt={item.name} /><span className="up-zoom">Click to view full size</span>
      </button>
      : <div className="up-note">Preview not available.</div>
  }

  if (shape === 'video') {
    return url
      ? <video className="up-video" src={url} controls preload="metadata" />
      : <div className="up-note">Preview not available.</div>
  }

  if (shape === 'pdf') {
    return (
      <div>
        {item.pages != null && <div className="up-rowline"><b>{item.pages}</b> page{item.pages === 1 ? '' : 's'}</div>}
        {url
          ? <object className="up-pdf" data={url} type="application/pdf" aria-label={`First page of ${item.name}`}>
            <div className="up-note">Your browser cannot show PDFs inline. <a href={url} target="_blank" rel="noreferrer">Open it in a new tab</a>.</div>
          </object>
          : <div className="up-note">Preview not available.</div>}
      </div>
    )
  }

  return (
    <div className="up-generic">
      <span className="up-ico"><Icon name="file" size={22} /></span>
      <div>
        <b>{item.name}</b>
        <div className="note">{describe(item.name, item.size, item.mime)}</div>
      </div>
    </div>
  )
}

// ---------- one file waiting to be accepted ----------
function StagedFile({ item, products, materials, onKind, onLink, onUse, onDrop, onZoom }) {
  const k = kindOf(item.kind)
  const checks = k.data && item.sheet ? checkColumns(item.kind, item.sheet.headers) : null
  const match = k.data && item.sheet ? matchNames(item.sheet.headers, item.sheet.rows, products, materials) : null
  const blocked = !!(k.data && (item.readError || (checks && !checks.ok) || (item.sheet && item.sheet.rowCount === 0)))

  return (
    <div className="up-card">
      <div className="up-head">
        <div className="up-id">
          <b>{item.name}</b>
          <div className="note">{describe(item.name, item.size, item.mime)}</div>
        </div>
        <div className="row">
          <label className="sr" htmlFor={`k-${item.id}`}>What this file is</label>
          <select id={`k-${item.id}`} className="sel" value={item.kind} onChange={(e) => onKind(item.id, e.target.value)}>
            {KINDS.map(x => <option key={x.id} value={x.id}>{x.label}{x.hint ? ` (${x.hint})` : ''}</option>)}
          </select>
        </div>
      </div>

      <div className="up-body"><Preview item={item} onZoom={() => onZoom(item)} /></div>

      {k.data && (
        <div className="up-checks">
          {item.sheet && checks && (
            <>
              <div className="up-cols">
                {checks.need.map(c => (
                  <span key={c} className={checks.found.includes(c) ? 'ok' : 'bad'}>
                    {checks.found.includes(c) ? '✓' : '✗'} {c}
                  </span>
                ))}
              </div>
              {!checks.ok && (
                <div className="up-note bad">
                  This file is missing {checks.missing.length === 1 ? 'a column' : 'columns'}: <b>{checks.missing.join(', ')}</b>.
                  Add {checks.missing.length === 1 ? 'it' : 'them'} to the first row and upload again, or start from the template.
                </div>
              )}
              {checks.ok && item.sheet.rowCount === 0 && (
                <div className="up-note bad">The columns are right but there are no rows under them.</div>
              )}
              {checks.ok && match && (
                <div className={`up-note ${match.matched === 0 ? 'bad' : ''}`}>
                  <b>{match.matched} of {match.total} {match.what} matched</b> by name.
                  {match.unmatched.length > 0 && <> Not recognised: {match.unmatched.map(u => `“${u}”`).join(', ')}
                    {match.unmatched.length === 5 ? ' and others.' : '.'}</>}
                </div>
              )}
            </>
          )}
          <button className="link" onClick={() => download(`demandpilot-${item.kind}-template.csv`, templateCsv(item.kind))}>
            Download template for {k.label.toLowerCase()}
          </button>
        </div>
      )}

      {!k.data && (
        <div className="up-link">
          <label htmlFor={`l-${item.id}`}>Linked to</label>
          <select id={`l-${item.id}`} className="sel" value={item.link ? `${item.link.type}:${item.link.id}` : ''}
            onChange={(e) => onLink(item.id, e.target.value)}>
            <option value="">Nothing in particular</option>
            <optgroup label="Product">{products.map(p => <option key={p.id} value={`product:${p.id}`}>{p.name}</option>)}</optgroup>
            <optgroup label="Material">{materials.map(m => <option key={m.id} value={`material:${m.id}`}>{m.name}</option>)}</optgroup>
            <optgroup label="Supplier">{[...new Set(materials.map(m => m.supplier))].map(s => <option key={s} value={`supplier:${s}`}>{s}</option>)}</optgroup>
          </select>
        </div>
      )}

      <div className="up-acts">
        <button className="btn sm pri" disabled={blocked} onClick={() => onUse(item)}>Use this file</button>
        <button className="btn sm ghost" onClick={() => onDrop(item.id)}>Remove</button>
        {blocked && <span className="note">Fix the problem above to use this file.</span>}
      </div>
    </div>
  )
}

export default function Systems() {
  const { state, act, go, plan, notify } = useApp()
  const [, tick] = useState(0)
  const [staged, setStaged] = useState([])
  const [errors, setErrors] = useState([])
  const [over, setOver] = useState(false)
  const [zoom, setZoom] = useState(null)
  const input = useRef(null)
  const files = useFiles()

  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  // let go of the preview URLs this page made when it closes
  useEffect(() => () => staged.forEach(s => s.url && URL.revokeObjectURL(s.url)), [staged])

  const products = plan.products, materials = plan.materials

  // ---------- taking files in ----------
  const accept = async (list) => {
    const incoming = Array.from(list || [])
    if (!incoming.length) return
    const bad = [], good = []
    for (const f of incoming) {
      const problem = fileProblem(f)
      if (problem) bad.push(problem); else good.push(f)
    }
    setErrors(bad)

    const items = good.map(f => ({
      id: newId(), file: f, name: f.name, size: f.size, mime: f.type || '',
      shape: classify(f.name, f.type), kind: guessKind(f.name, f.type),
      url: (() => { try { return URL.createObjectURL(f) } catch { return null } })(),
      sheet: null, readError: null, pages: null, link: null,
    }))
    setStaged(s => [...items, ...s])

    // read the things that need reading, without blocking the list appearing
    for (const it of items) {
      if (it.shape === 'sheet') {
        try {
          const sheet = await readSheet(it.file)
          setStaged(s => s.map(x => x.id === it.id ? { ...x, sheet } : x))
        } catch (e) {
          setStaged(s => s.map(x => x.id === it.id ? { ...x, readError: e.message || 'unreadable' } : x))
        }
      } else if (it.shape === 'pdf') {
        const pages = await pdfPageCount(it.file)
        setStaged(s => s.map(x => x.id === it.id ? { ...x, pages } : x))
      }
    }
  }

  const onDrop = (e) => { e.preventDefault(); setOver(false); accept(e.dataTransfer?.files) }

  // ---------- accepting one ----------
  const use = async (item) => {
    const k = kindOf(item.kind)
    const rec = {
      id: item.id, name: item.name, size: item.size, mime: item.mime, shape: item.shape,
      kind: item.kind, kindLabel: k.label, data: !!k.data, link: item.link,
      at: Date.now(), by: 'You',
      rowCount: item.sheet?.rowCount ?? null,
      headers: item.sheet?.headers ?? null,
      sample: item.sheet?.rows.slice(0, 5) ?? null,
      pages: item.pages ?? null,
      blob: item.file,
    }
    await putFile(rec)
    setStaged(s => s.filter(x => x.id !== item.id))
    if (item.url) URL.revokeObjectURL(item.url)
    notify(`Uploaded ${item.name} (demo)`)
  }

  const drop = (id) => {
    setStaged(s => {
      const it = s.find(x => x.id === id)
      if (it?.url) URL.revokeObjectURL(it.url)
      return s.filter(x => x.id !== id)
    })
  }

  const remove = async (rec) => { releaseUrl(rec.id); await deleteFile(rec.id); notify(`Removed ${rec.name}`) }

  const setKind = (id, kind) => setStaged(s => s.map(x => x.id === id ? { ...x, kind, link: kindOf(kind).data ? null : x.link } : x))
  const setLink = (id, v) => setStaged(s => s.map(x => {
    if (x.id !== id) return x
    if (!v) return { ...x, link: null }
    const [type, ...rest] = v.split(':')
    return { ...x, link: { type, id: rest.join(':') } }
  }))

  const linkLabel = (link) => {
    if (!link) return '—'
    if (link.type === 'product') return plan.prodById[link.id]?.name ?? link.id
    if (link.type === 'material') return plan.matById[link.id]?.name ?? link.id
    return link.id
  }

  // ---------- the systems table, plus anything uploaded by hand ----------
  const sync = state.sync ?? {}
  const uploads = files.filter(f => f.data)
  const docs = files.filter(f => !f.data)
  const rows = [
    ...SYSTEMS.map(s => {
      const o = sync[s.id]
      return { ...s, manual: false, lastSync: o?.at ?? todayAt(s.at), status: o?.status ?? s.status, records: s.records }
    }),
    ...uploads.map(f => ({
      id: f.id, name: `Manual upload — ${f.name}`, kind: f.kindLabel, gives: `${f.kindLabel} read from a file you uploaded`,
      uses: [[f.kind === 'po' ? 'buy' : f.kind === 'orders' ? 'orders' : f.kind === 'stock' ? 'materials' : 'forecast',
        f.kind === 'po' ? 'Buy' : f.kind === 'orders' ? 'Orders' : f.kind === 'stock' ? 'Materials & stock' : 'Forecast']],
      every: 'When you upload', lastSync: f.at, records: f.rowCount ?? 0, status: 'Live', manual: true,
      open: f.kind === 'po' ? 'buy' : f.kind === 'orders' ? 'orders' : f.kind === 'stock' ? 'materials' : 'forecast',
    })),
  ]
  const live = rows.filter(r => r.status === 'Live').length
  const recovered = rows.filter(r => r.status === 'Recovered').length
  const lastFull = rows.length ? Math.max(...rows.map(r => r.lastSync)) : Date.now()
  const records = rows.reduce((a, r) => a + (r.records || 0), 0)

  return (
    <>
      <Head title="Connected systems"
        sub="Where every number in DemandPilot comes from — the systems it reads, and anything you add by hand."
        right={<button className="btn pri" onClick={() => act.syncAll()}><Icon name="undo" size={13} />Sync all now</button>} />

      <div className="grid g3">
        <Tile k="Systems connected" v={`${rows.length}`}
          d={recovered ? `${live} live · ${recovered} recovered after a retry` : `all ${live} live`}
          tone={recovered ? 'amber' : 'green'} />
        <Tile k="Sales history" v="2 years" small="weekly"
          d={`${HIST} weeks for every product and region`} onClick={() => go('forecast')} />
        <Tile k="Last full refresh" v={clock(lastFull)}
          d={`${ago(lastFull)} · ${fmtNum(records)} records in total`} />
      </div>

      {/* ---------- upload ---------- */}
      <Card title="Upload files" sub="For data or documents that do not come from a connected system."
        right={<span className="badge-mock">Demo: files stay on this computer</span>}>
        <div
          className={`dropzone ${over ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <Icon name="layers" size={22} />
          <div>
            <b>Drag files here</b>
            <div className="note">
              Spreadsheets, PDFs, Word files, photos, videos — any type, several at once, up to {fmtBytes(MAX_BYTES)} each.
            </div>
          </div>
          <button className="btn pri" onClick={() => input.current?.click()}>Choose files</button>
          <input ref={input} type="file" multiple className="sr" aria-label="Choose files to upload"
            onChange={(e) => { accept(e.target.files); e.target.value = '' }} />
        </div>

        {errors.length > 0 && (
          <div className="up-errors">
            {errors.map((e, i) => <div key={i} className="up-note bad">{e}</div>)}
            <button className="btn sm ghost" onClick={() => setErrors([])}>Dismiss</button>
          </div>
        )}

        {staged.length > 0 && (
          <div className="up-list">
            <div className="note" style={{ margin: '12px 0 6px' }}>
              {staged.length} file{staged.length === 1 ? '' : 's'} ready — check {staged.length === 1 ? 'it' : 'them'} and choose what to keep.
            </div>
            {staged.map(item => (
              <StagedFile key={item.id} item={item} products={products} materials={materials}
                onKind={setKind} onLink={setLink} onUse={use} onDrop={drop} onZoom={setZoom} />
            ))}
          </div>
        )}
      </Card>

      {/* ---------- systems ---------- */}
      <Card pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr>
            <th scope="col">System</th>
            <th scope="col">What it gives us</th>
            <th scope="col">Used on</th>
            <th scope="col">How often</th>
            <th scope="col">Last sync</th>
            <th scope="col" className="r">Records</th>
            <th scope="col">Status</th>
            <th scope="col"></th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="nm">{r.name}<small>{r.kind}</small></td>
                <td style={{ minWidth: 190 }}>{r.gives}
                  {r.note && <div className="note" style={{ marginTop: 4 }}>{r.note}</div>}
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {r.uses.map(([page, lbl]) => (
                      <button key={page} className="tag" style={{ border: 0, cursor: 'pointer' }}
                        title={`Open ${lbl}`} onClick={() => go(page)}>{lbl}</button>
                    ))}
                  </div>
                </td>
                <td className="note" style={{ whiteSpace: 'nowrap' }}>{r.every}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{clock(r.lastSync)}<div className="note">{ago(r.lastSync)}</div></td>
                <td className="r num">{fmtNum(r.records)}</td>
                <td><Pill u={r.status === 'Live' ? 'Good' : 'Soon'}>{r.status}</Pill></td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    {!r.manual && <button className="btn sm" onClick={() => act.syncSystem(r)}>Sync now</button>}
                    <button className="btn sm ghost" onClick={() => go(r.open)}>Open</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>

      {/* ---------- documents ---------- */}
      {docs.length > 0 && (
        <Card title="Documents & media" sub="Files kept against a product, a material or a supplier." pad={false}>
          <div className="doc-grid">
            {docs.map(f => (
              <div key={f.id} className="doc">
                <div className="doc-pic">
                  {f.shape === 'image' && urlFor(f)
                    ? <button className="up-thumb sm" onClick={() => setZoom({ ...f, url: urlFor(f) })}><img src={urlFor(f)} alt={f.name} /></button>
                    : f.shape === 'video' && urlFor(f)
                      ? <video src={urlFor(f)} controls preload="metadata" />
                      : <span className="up-ico"><Icon name="file" size={20} /></span>}
                </div>
                <div className="doc-txt">
                  <b>{f.name}</b>
                  <div className="note">{describe(f.name, f.size, f.mime)}{f.pages != null && ` · ${f.pages} pages`}</div>
                  <div className="note">{f.kindLabel} · linked to {linkLabel(f.link)}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {urlFor(f) && <a className="btn sm" href={urlFor(f)} target="_blank" rel="noreferrer">View</a>}
                  <button className="btn sm ghost" onClick={() => remove(f)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---------- history ---------- */}
      <Card title="Upload history" sub={files.length ? `${files.length} file${files.length === 1 ? '' : 's'} on this computer` : undefined} pad={false}>
        {files.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>
              <th scope="col">File</th><th scope="col">What it is</th><th scope="col" className="r">Size</th>
              <th scope="col">Linked to</th><th scope="col">Uploaded</th><th scope="col">By</th><th scope="col"></th>
            </tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td className="nm">{f.name}<small>{describe(f.name, f.size, f.mime)}</small></td>
                  <td>{f.kindLabel}{f.rowCount != null && <div className="note">{fmtNum(f.rowCount)} rows</div>}</td>
                  <td className="r num">{fmtBytes(f.size)}</td>
                  <td>{linkLabel(f.link)}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{clock(f.at)}<div className="note">{ago(f.at)}</div></td>
                  <td>{f.by}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      {urlFor(f) && <a className="btn sm" href={urlFor(f)} target="_blank" rel="noreferrer">View</a>}
                      <button className="btn sm ghost" onClick={() => remove(f)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <Empty>Nothing uploaded yet. Drop a file above to try it.</Empty>}
      </Card>

      <Card title="How the data flows" sub="From a system reading to a decision on a planner's screen" pad={false}>
        <div className="steps">
          {FLOW.map((f, i) => (
            <div className="step" key={f.t}>
              <div className="no">{i + 1}</div>
              <b>{f.t}</b>
              <div className="s">{f.s}</div>
            </div>
          ))}
        </div>
      </Card>

      <p className="note">
        This is a demo: the systems above are not really connected, and uploaded files never leave this
        computer — they are held in the browser’s own storage and are gone if you clear site data.
        “Sync now” only moves the last-sync time so the screen can be seen working.
      </p>

      {zoom && (
        <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && setZoom(null)}>
          <div className="lightbox" role="dialog" aria-label={zoom.name}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <b>{zoom.name}</b>
              <button className="btn ghost sm" onClick={() => setZoom(null)} aria-label="Close"><Icon name="x" size={15} /></button>
            </div>
            <img src={zoom.url} alt={zoom.name} />
          </div>
        </div>
      )}
    </>
  )
}
