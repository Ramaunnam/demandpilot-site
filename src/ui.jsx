import React, { createContext, memo, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dayLabel } from './data.js'
import { fmtINR } from './engine.js'

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// Measuring needs to happen before paint in a browser, and cannot happen at all without one.
const useIsoLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect


const PATHS = {
  home: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>,
  trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  factory: <><path d="M2 20h20V9l-6 4V9l-6 4V4H2z" /></>,
  cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="19" cy="20" r="1.4" /><path d="M1 2h4l2.7 12.4a2 2 0 0 0 2 1.6h9.6a2 2 0 0 0 2-1.6L23 6H6" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  sun: <><circle cx="12" cy="12" r="4.5" /><path d="M12 1.5v2M12 20.5v2M3.6 3.6l1.4 1.4M19 19l1.4 1.4M1.5 12h2M20.5 12h2M3.6 20.4 5 19M19 5l1.4-1.4" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  undo: <><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.6-8.5L3 7" /></>,
  plug: <><path d="M9 2v6M15 2v6" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></>,
}
export function Icon({ name, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>{PATHS[name]}</svg>
}

// The ⓘ: click to see how the number was worked out.
export function Info({ e, right }) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(right ? 'right' : '')
  const ref = useRef(null)
  const pop = useRef(null)
  const btn = useRef(null)

  useEffect(() => {
    if (!open) return
    const off = (ev) => { if (ref.current && !ref.current.contains(ev.target)) setOpen(false) }
    const esc = (ev) => { if (ev.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open])

  // Keep the panel on screen: if it would run off an edge, pin it to the other side.
  useIsoLayout(() => {
    if (!open || !pop.current) return
    const r = pop.current.getBoundingClientRect()
    if (r.right > window.innerWidth - 8) setFlip('right')
    else if (r.left < 8) setFlip('')
  }, [open])

  if (!e) return null
  return (
    <span className="info-wrap" ref={ref} onClick={(ev) => ev.stopPropagation()}>
      <button type="button" ref={btn} className="info-btn" aria-expanded={open}
        aria-label={`How ${e.title} is worked out`} onClick={() => setOpen(o => !o)}>i</button>
      {open && (
        <div className={`pop ${flip}`} ref={pop} role="dialog" aria-label={`How ${e.title} is worked out`}>
          <h4>{e.title}</h4>
          <div className="val num">{e.value}</div>
          <p className="means">{e.means}</p>
          <div className="box"><div className="lbl">How it is worked out</div>{e.formula}</div>
          <div className="box"><div className="lbl">With today's numbers</div><div className="worked">{e.worked}</div></div>
          <div className="box res"><span>Result</span><span className="num">{e.value} <span className="ok">✓ matches the screen</span></span></div>
          {e.inputs?.length > 0 && (
            <table><tbody>{e.inputs.map(i => <tr key={i.k}><td>{i.k}</td><td>{i.v}</td></tr>)}</tbody></table>
          )}
        </div>
      )}
    </span>
  )
}

// A headline number. It stays a <div> even when it is clickable, because the ⓘ inside it
// is a button of its own and a button inside a button is not valid HTML.
export function Tile({ k, v, small, d, e, tone, onClick, light, title }) {
  const act = onClick ? { role: 'button', tabIndex: 0, onClick, title, onKeyDown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onClick() } } } : {}
  return (
    <div className={`card tile ${tone ? `s-${tone}` : ''} ${onClick ? 'act' : ''}`} {...act}>
      <div className="k">{light && <span className="light" style={{ background: `var(--${light})` }} />}{k}{e && <Info e={e} />}</div>
      <div className="v">{v}{small && <small>{small}</small>}</div>
      {d && <div className="d">{d}</div>}
    </div>
  )
}

// A screen is rebuilt from scratch each time it is opened, so the choices a person made
// on it — a tab, a filter, the week they were looking at — are kept here and put back
// when they come back to it.
const viewMemory = new Map()
export function useViewState(key, initial) {
  const [v, setV] = useState(() => (viewMemory.has(key) ? viewMemory.get(key) : initial))
  useEffect(() => { viewMemory.set(key, v) }, [key, v])
  return [v, setV]
}

// "← Back to Decisions", above the title of a screen that was opened from elsewhere.
export function BackLink() {
  const { back, canBack, backLabel } = useApp()
  if (!canBack) return null
  return <button className="backlink" onClick={back}><Icon name="back" size={13} />Back to {backLabel}</button>
}

export const Pill = ({ u, children }) => <span className={`pill ${u}`}>{children ?? (u === 'OK' ? 'All good' : u)}</span>

// A material's status. Every screen that shows one uses this, so the same material
// never reads "Too much" on one page and "Info" on another.
export const MatPill = ({ m }) => <Pill u={m.urgency}>{m.urgency === 'Info' ? 'Too much stock' : undefined}</Pill>

export function Card({ title, sub, right, children, pad = true, style, className = '' }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right) && <div className="card-h"><div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>{right && <div className="row">{right}</div>}</div>}
      {pad ? <div className="card-b">{children}</div> : children}
    </section>
  )
}

export function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => {
        const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o
        return <button key={v} type="button" aria-pressed={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}{typeof o === 'object' && o.c != null && <span className="c">{o.c}</span>}</button>
      })}
    </div>
  )
}

export function Head({ title, sub, crumb, right, backLink }) {
  const { go } = useApp()
  return (
    <div className="ph">
      <div>
        {backLink && <BackLink />}
        {crumb && !backLink && <div className="crumb"><button onClick={() => go(crumb.page)}>{crumb.label}</button><span>›</span></div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="ph-r">{right}</div>}
    </div>
  )
}

export function Fact({ k, v, s, e, color }) {
  return <div className="fact"><span className="k">{k}{e && <Info e={e} />}</span><span className="v" style={color ? { color } : undefined}>{v}</span>{s && <span className="s">{s}</span>}</div>
}

export const URG_COLOR = { Urgent: 'var(--urgent)', Soon: 'var(--soon)', Watch: 'var(--watch)', Info: 'var(--info)', OK: 'var(--info)' }

export function deadlineText(day) {
  if (day < 0) return { t: 'Overdue · order today', late: true }
  if (day < 1) return { t: 'Today', late: true }
  return { t: `By ${dayLabel(day)}`, late: false }
}

// One decision, used on the Command Centre and the Decisions page.
export const DecisionRow = memo(function DecisionRow({ d, compact }) {
  const { act, go, plan } = useApp()
  const dl = deadlineText(d.deadlineDay)
  // a sales change is answered here rather than on another screen
  const change = d.action === 'decide' ? plan.changes.find(c => c.id === d.id) : null
  return (
    <div className="drow">
      <span className="bar" style={{ background: URG_COLOR[d.urgency] }} />
      <div className="main-c">
        <div className="t1">
          <Pill u={d.urgency} />
          <span className="tag">{d.type}</span>
          <button className="link name" onClick={() => go(d.link.page, d.link.id)}>{d.name}</button>
          {!compact && <span className="what">{d.sub}</span>}
        </div>
        <div className="do"><b>Do:</b> {d.do}</div>
        <div className="why"><b>Why:</b> {d.why}</div>
      </div>
      <div className="side-c">
        <span className={`when ${dl.late ? 'late' : ''}`}>{dl.t}</span>
        {!compact && d.money > 0 && <span className="note num">{fmtINR(d.money)} · {d.sure}% sure</span>}
        <div className="acts">
          {d.action === 'decide' && change
            ? <>
              <button className="btn sm pri" title="Plan for it: the forecast follows the new level"
                onClick={() => act.decideChange(change, 'real')}>Plan for it</button>
              <button className="btn sm" title="Treat it as a one-off and leave the forecast alone"
                onClick={() => act.decideChange(change, 'oneoff')}>Ignore</button>
              {!compact && <button className="btn sm ghost" onClick={() => go(d.link.page, d.link.id)}>See sales</button>}
            </>
            : <button className="btn sm pri" onClick={() => act.approveDecision(d)}><Icon name="check" size={13} />{d.action === 'ack' ? 'Noted' : 'Approve'}</button>}
          {!compact && <button className="btn sm ghost" aria-label={`Dismiss: ${d.name}`} title="Dismiss" onClick={() => act.dismiss(d)}><Icon name="x" size={13} /></button>}
        </div>
      </div>
    </div>
  )
})

export const Empty = ({ children }) => <div className="empty">{children}</div>

// A side panel. Used for Settings; closes on Escape or a click outside.
export function Drawer({ title, sub, onClose, children }) {
  const panel = useRef(null)
  useEffect(() => {
    const esc = (ev) => ev.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    panel.current?.querySelector('input, button, select')?.focus()
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <aside className="drawer" ref={panel} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h">
          <div><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close"><Icon name="x" size={15} /></button>
        </div>
        <div className="drawer-b">{children}</div>
      </aside>
    </div>
  )
}

// A setting the planner can move, with the effect spelled out underneath.
export function Knob({ label, help, value, min, max, step, unit, onChange }) {
  const id = `knob-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="knob">
      <div className="row between">
        <label htmlFor={id}><b>{label}</b></label>
        <output htmlFor={id} className="num knob-v">{value}{unit}</output>
      </div>
      <input id={id} className="slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <div className="note">{help}</div>
    </div>
  )
}

// If one screen throws, keep the rest of the app usable instead of showing a blank page.
export class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 6px' }}>This screen could not be drawn</h3>
        <p className="note" style={{ margin: '0 0 10px' }}>{String(this.state.err.message || this.state.err)}</p>
        <button className="btn pri" onClick={() => { this.setState({ err: null }); this.props.onHome?.() }}>Back to the Command Centre</button>
      </div>
    )
  }
}
