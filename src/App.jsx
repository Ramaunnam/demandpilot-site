import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildData, SITE, HIST, wkYear, SYSTEMS, todayLabel, fmtWhen } from './data.js'
import { computePlan, DEFAULT_SETTINGS, fmtQty, fmtINR, fmtT } from './engine.js'
import { Ctx, Icon, Drawer, Knob, Boundary } from './ui.jsx'
import logo from './assets/j2w-logo.png'
import Command from './pages/Command.jsx'
import Decisions from './pages/Decisions.jsx'
import Changes from './pages/Changes.jsx'
import Forecast from './pages/Forecast.jsx'
import Products from './pages/Products.jsx'
import Product from './pages/Product.jsx'
import Materials from './pages/Materials.jsx'
import Material from './pages/Material.jsx'
import Plan from './pages/Plan.jsx'
import Buy from './pages/Buy.jsx'
import Orders from './pages/Orders.jsx'
import Simulate from './pages/Simulate.jsx'
import Method from './pages/Method.jsx'
import Systems from './pages/Systems.jsx'

const data = buildData()

const PAGES = {
  command: Command, decisions: Decisions, changes: Changes, forecast: Forecast, products: Products, product: Product,
  materials: Materials, material: Material, plan: Plan, buy: Buy, orders: Orders, simulate: Simulate, method: Method,
  systems: Systems,
}
const TITLES = {
  command: 'Command Centre', decisions: 'Decisions', changes: 'What changed', forecast: 'Forecast', products: 'Products',
  product: 'Product', materials: 'Materials & stock', material: 'Material', plan: 'Plan & MRP', buy: 'Buy',
  orders: 'Orders', simulate: 'What if', method: 'How it works', systems: 'Connected systems',
}
const NAV = [
  { h: 'Overview', items: [{ id: 'command', label: 'Command Centre', icon: 'home' }] },
  { h: 'Decide', items: [{ id: 'decisions', label: 'Decisions', icon: 'list', count: 'waiting' }, { id: 'changes', label: 'What changed', icon: 'bolt', count: 'changes' }] },
  { h: 'Demand', items: [{ id: 'forecast', label: 'Forecast', icon: 'trend' }, { id: 'products', label: 'Products', icon: 'box' }] },
  { h: 'Supply', items: [{ id: 'materials', label: 'Materials & stock', icon: 'layers', count: 'mats' }, { id: 'plan', label: 'Plan & MRP', icon: 'factory' }] },
  { h: 'Buy', items: [{ id: 'buy', label: 'Buy', icon: 'cart', count: 'buy' }, { id: 'orders', label: 'Orders', icon: 'file' }] },
  { h: 'Data', items: [{ id: 'systems', label: 'Connected systems', icon: 'plug' }] },
  { h: 'Learn', items: [{ id: 'simulate', label: 'What if', icon: 'sliders' }, { id: 'method', label: 'How it works', icon: 'book' }] },
]
const PARENT = { product: 'products', material: 'materials' }
const SAVE_KEY = 'dp.state.v2'

function readHash() {
  try {
    const [page, id] = decodeURIComponent((window.location.hash || '').slice(1)).split('/')
    return PAGES[page] ? { page, id: id || null } : { page: 'command', id: null }
  } catch { return { page: 'command', id: null } }
}

const fresh = () => ({
  settings: { ...DEFAULT_SETTINGS }, decisions: {}, approved: [], approvedIds: {}, rejected: {},
  edits: {}, dismissed: {}, log: [], poSeq: 3400, sync: {},
  production: [], activity: [], woSeq: 900,
})

// Decisions taken in the session survive a reload, so the demo can be picked up again.
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return fresh()
    const s = JSON.parse(raw)
    return { ...fresh(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } }
  } catch { return fresh() }
}

function readTheme() {
  try {
    const saved = localStorage.getItem('dp.theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* storage blocked */ }
  // nothing saved yet: open in whatever the device is set to
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' } catch { return 'light' }
}

export default function App() {
  const [state, setState] = useState(load)
  const [route, setRoute] = useState(readHash)
  const [toast, setToast] = useState(null)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const timer = useRef(null)
  const searchBox = useRef(null)

  const plan = useMemo(() => computePlan(data, state),
    [state.settings, state.decisions, state.approved, state.approvedIds, state.rejected, state.edits, state.dismissed])

  // ---- routing ----
  // The depth of our own history is carried on each entry, so Back can be shown only
  // when there is somewhere to go back to, and stays right through the browser's own
  // Back and Forward buttons.
  // Every history entry carries the screen it came from. That is the app's own history
  // list, and because it rides on the browser's own entries, the browser's Back button,
  // the mouse's back button and the one in the top bar all do the same thing.
  const [prev, setPrev] = useState(null)
  const routeRef = useRef(route)
  useEffect(() => { routeRef.current = route })

  useEffect(() => {
    try {
      if (window.history.state?.dp == null) window.history.replaceState({ dp: 0, from: null }, '')
      else setPrev(window.history.state.from ?? null)
    } catch { /* sandbox */ }
    const onPop = (ev) => { setPrev(ev.state?.from ?? null); setRoute(readHash()) }
    const onHash = () => setRoute(readHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onHash) }
  }, [])

  const go = useCallback((page, id = null) => {
    const from = { page: routeRef.current.page, id: routeRef.current.id ?? null }
    if (from.page === page && from.id === (id ?? null)) return      // already on it
    setRoute({ page, id })
    setPrev(from)
    try {
      const dp = (window.history.state?.dp ?? 0) + 1
      window.history.pushState({ dp, from }, '', `#${page}${id ? '/' + encodeURIComponent(id) : ''}`)
    } catch { /* sandbox */ }
    try { window.scrollTo({ top: 0 }) } catch { /* ignore */ }
    setQ(''); setHi(0)
  }, [])

  // Back is for coming out of something you opened, so it appears only on the screens
  // that show one particular thing — a product, a material, a sales change, a what-if.
  // On the Command Centre or any list reached from the side rail there is nothing to
  // come out of, so no button is shown.
  const DETAIL_HOME = { product: 'products', material: 'materials', changes: 'changes', simulate: 'simulate' }
  const inDetail = !!(route.id && DETAIL_HOME[route.page])
  const parentOf = (page) => DETAIL_HOME[page] ?? null
  const backTo = !inDetail ? null : (prev ?? { page: DETAIL_HOME[route.page], id: null })
  const canBack = !!backTo
  const backLabel = !backTo ? null
    : backTo.page === 'product' ? (plan.prodById[backTo.id]?.name ?? 'Products')
      : backTo.page === 'material' ? (plan.matById[backTo.id]?.name ?? 'Materials & stock')
        : (TITLES[backTo.page] ?? 'Command Centre')

  const back = useCallback(() => {
    if (prev) { try { window.history.back(); return } catch { /* sandbox */ } }
    const p = routeRef.current.id ? parentOf(routeRef.current.page) : null
    if (p) go(p)
  }, [prev, go])

  useEffect(() => { document.title = `${TITLES[route.page] ?? 'DemandPilot'} · DemandPilot` }, [route.page])

  // ---- theme: light or dark, nothing else ----
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('dp.theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  // ---- save ----
  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch { /* storage full or blocked */ }
  }, [state])

  const notify = useCallback((msg) => {
    setToast(msg); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), 3600)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const clockNow = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const log = (s, text) => ({ ...s, log: [{ at: clockNow(), text }, ...s.log].slice(0, 60) })

  // One row per thing the planner did: what it was, the screen that now shows it, and
  // what to put back if they change their mind.
  const record = (s, e) => ({
    ...log(s, e.text),
    activity: [{ id: `AC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: clockNow(), when: Date.now(), ...e }, ...s.activity].slice(0, 80),
  })

  const act = useMemo(() => {
    const a = {
      approveBuy(b, qty) {
        const q2 = qty ?? b.qty
        setState(s => {
          const seq = s.poSeq + 1
          const po = {
            id: `PO-26-${seq}`, mat: b.mat.id, qty: q2, placedDay: 0, placedAt: Date.now(),
            dueDay: Math.max(1, b.arrivesDay ?? b.mat.lead), status: 'Placed', rush: b.late,
            cost: q2 * b.mat.priceNow * (b.late ? 1 + s.settings.rushPremium / 100 : 1), approvedNow: true,
          }
          const edits = { ...s.edits }; delete edits[b.id]
          return record({ ...s, poSeq: seq, approved: [...s.approved, po], edits }, {
            kind: 'Order placed', what: `${po.id} · ${fmtQty(q2, b.mat.unit)} ${b.mat.name}`,
            text: `Order placed: ${po.id}, ${fmtQty(q2, b.mat.unit)} ${b.mat.name} from ${b.supplier}${b.late ? ' (rush)' : ''}`,
            link: { page: 'orders', id: 'po' }, linkLabel: 'See it in Orders',
            undo: { type: 'order', id: po.id },
          })
        })
        notify(`Order placed: ${fmtQty(q2, b.mat.unit)} ${b.mat.name}. Arrives in about ${b.arrivesDay ?? b.mat.lead} days (demo).`)
      },
      rejectBuy(b) {
        setState(s => record({ ...s, rejected: { ...s.rejected, [b.id]: true } }, {
          kind: 'Not ordered', what: `${b.mat.name} — ${b.kind === 'cut' ? 'kept buying as normal' : 'order turned down'}`,
          text: `Not ordered: ${b.mat.name}`,
          matName: b.mat.name, matId: b.mat.id, qty: b.kind === 'cut' ? null : b.qty, unit: b.mat.unit,
          cost: b.kind === 'cut' ? null : b.cost,
          link: { page: 'orders', id: 'no' }, linkLabel: 'See it in Orders',
          undo: { type: 'reject', id: b.id },
        }))
        notify(`${b.mat.name} not ordered. It is listed under "Not ordered" on the Buy screen.`)
      },
      editQty(id, qty) { setState(s => ({ ...s, edits: { ...s.edits, [id]: qty } })) },
      decideChange(c, status) {
        const label = { real: 'Real change', oneoff: 'One-off', check: 'Check with sales', open: 'Reopened' }[status]
        setState(s => record({ ...s, decisions: { ...s.decisions, [c.id]: status } }, {
          kind: label, what: c.title, text: `${label}: ${c.title}`,
          link: { page: 'changes', id: c.id }, linkLabel: 'See the sales',
          undo: status === 'open' ? null : { type: 'change', id: c.id },
        }))
        notify(status === 'real' ? `${c.title}: accepted as a real change. Forecast, production and buying updated.`
          : status === 'oneoff' ? `${c.title}: treated as one-off. The forecast ignores those weeks.`
            : status === 'check' ? `${c.title}: sent to the sales team to check (demo).` : 'Reopened.')
      },
      approveDecision(d) {
        if (d.id.startsWith('BUY:')) { const b = plan.buys.find(x => x.id === d.id); if (b) a.approveBuy(b); return }
        if (d.id.startsWith('CUT:')) {
          setState(s => record({ ...s, approvedIds: { ...s.approvedIds, [d.id]: true } }, {
            kind: 'Buying less', what: `${d.name} — next order skipped`,
            text: `Next order skipped: ${d.name}`,
            link: { page: 'material', id: d.link.id }, linkLabel: 'Open the material',
            undo: { type: 'approvedId', id: d.id },
          }))
          notify(`${d.name}: next order skipped. Cash stays free.`); return
        }
        if (d.id.startsWith('MAKE:')) {
          const p = plan.prodById[d.link.id]
          setState(s => {
            const seq = s.woSeq + 1
            const wo = {
              id: `WO-26-${seq}`, productId: d.link.id, name: p?.name ?? d.name,
              qty: Math.max(0, (p?.target ?? 0) - (p?.position ?? 0)), weeks: 6,
              line: p?.cold ? 'Cold rolling' : 'Hot rolling', status: 'Planned',
              at: clockNow(), raisedAt: Date.now(), fromDecision: d.id,
            }
            return record({ ...s, woSeq: seq, production: [wo, ...s.production], approvedIds: { ...s.approvedIds, [d.id]: true } }, {
              kind: 'Production planned', what: `${wo.id} · ${fmtT(wo.qty)} of ${wo.name}`,
              text: `Production planned: ${wo.id}, ${fmtT(wo.qty)} of ${wo.name} over 6 weeks`,
              link: { page: 'orders', id: 'wo' }, linkLabel: 'See it in Orders',
              undo: { type: 'make', id: wo.id, decisionId: d.id },
            })
          })
          notify(`Production order raised for ${d.name}. It is in Orders under Production orders.`); return
        }
        setState(s => record({ ...s, dismissed: { ...s.dismissed, [d.id]: true } }, {
          kind: 'Noted', what: d.name, text: `Noted: ${d.name}`,
          link: d.link, linkLabel: 'Open it', undo: { type: 'dismiss', id: d.id },
        }))
        notify('Noted and taken off the list. It is under "What you did" on Decisions.')
      },
      dismiss(d) {
        setState(s => record({ ...s, dismissed: { ...s.dismissed, [d.id]: true } }, {
          kind: 'Set aside', what: d.name, text: `Set aside: ${d.name}`,
          link: d.link, linkLabel: 'Open it', undo: { type: 'dismiss', id: d.id },
        }))
        notify(`"${d.name}" set aside. Undo it under "What you did" on Decisions.`)
      },
      syncSystem(sys) {
        const at = Date.now()
        setState(s => log({ ...s, sync: { ...s.sync, [sys.id]: { at, status: 'Live' } } }, `Synced ${sys.name}`))
        notify(`${sys.name} synced just now. ${sys.records.toLocaleString('en-IN')} records read (demo).`)
      },
      syncAll() {
        const at = Date.now()
        setState(s => log({ ...s, sync: Object.fromEntries(SYSTEMS.map(x => [x.id, { at, status: 'Live' }])) }, 'Synced all systems'))
        notify(`All ${SYSTEMS.length} systems synced just now (demo).`)
      },
      undo(entry) {
        if (!entry?.undo) return
        const u = entry.undo
        setState(s => {
          const n = { ...s }
          if (u.type === 'order') n.approved = s.approved.filter(p => p.id !== u.id)
          if (u.type === 'reject') { const r = { ...s.rejected }; delete r[u.id]; n.rejected = r }
          if (u.type === 'approvedId') { const a = { ...s.approvedIds }; delete a[u.id]; n.approvedIds = a }
          if (u.type === 'make') {
            n.production = s.production.filter(w => w.id !== u.id)
            const a = { ...s.approvedIds }; delete a[u.decisionId]; n.approvedIds = a
          }
          if (u.type === 'dismiss') { const d = { ...s.dismissed }; delete d[u.id]; n.dismissed = d }
          if (u.type === 'change') { const d = { ...s.decisions }; delete d[u.id]; n.decisions = d }
          n.activity = s.activity.filter(x => x.id !== entry.id)
          return log(n, `Undone: ${entry.text}`)
        })
        notify(`Undone: ${entry.what}. It is back on the list.`)
      },
      setting(patch) { setState(s => ({ ...s, settings: { ...s.settings, ...patch } })) },
      reset() { setState(fresh()); notify('Demo reset. Every decision cleared.') },
    }
    return a
  }, [plan, notify])

  // ---- search ----
  const counts = {
    waiting: plan.decisions.length, changes: plan.kpi.openChanges, mats: plan.kpi.matsAtRisk,
    buy: plan.buys.filter(b => b.kind === 'buy' && b.urgency !== 'Watch').length,
  }
  const term = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (term.length < 2) return []
    const out = [
      ...plan.products.filter(p => p.name.toLowerCase().includes(term) || p.family.toLowerCase().includes(term) || p.use.toLowerCase().includes(term))
        .slice(0, 6).map(p => ({ k: `p${p.id}`, t: p.name, s: `Product · ${p.use}`, page: 'product', id: p.id })),
      ...plan.materials.filter(m => m.name.toLowerCase().includes(term) || m.what.toLowerCase().includes(term))
        .slice(0, 4).map(m => ({ k: `m${m.id}`, t: m.name, s: `Material · ${m.what}`, page: 'material', id: m.id })),
      ...Object.entries(TITLES).filter(([, t]) => t.toLowerCase().includes(term))
        .slice(0, 3).map(([page, t]) => ({ k: `g${page}`, t, s: 'Screen', page, id: null })),
    ]
    return out.slice(0, 10)
  }, [term, plan])

  useEffect(() => { setHi(0) }, [term])

  // "/" or Ctrl-K jumps to the search box from anywhere.
  useEffect(() => {
    const on = (ev) => {
      const tag = (ev.target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'select' || tag === 'textarea'
      if ((ev.key === '/' && !typing) || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k')) {
        ev.preventDefault(); searchBox.current?.focus(); searchBox.current?.select()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const onSearchKey = (ev) => {
    if (ev.key === 'Escape') { setQ(''); ev.currentTarget.blur(); return }
    if (!hits.length) return
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setHi(h => (h + 1) % hits.length) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setHi(h => (h - 1 + hits.length) % hits.length) }
    else if (ev.key === 'Enter') { ev.preventDefault(); const h = hits[hi] ?? hits[0]; go(h.page, h.id) }
  }

  const Page = PAGES[route.page]
  const active = PARENT[route.page] ?? route.page
  const ctx = useMemo(() => ({ data, plan, state, go, back, canBack, backLabel, act, route, notify, openSettings: () => setShowSettings(true) }), [plan, state, go, back, canBack, backLabel, act, route, notify])

  return (
    <Ctx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to the page</a>
      <div className="app">
        <aside className="side">
          <button className="brand" onClick={() => go('command')} aria-label="DemandPilot by JoulesToWatts — home">
            <img className="brand-logo" src={logo} alt="JoulesToWatts" width="400" height="194" />
            <span className="brand-name"><b>DemandPilot</b><span>Demand-driven planning</span></span>
          </button>
          <nav className="nav" aria-label="Main">
            {NAV.map(g => (
              <React.Fragment key={g.h}>
                <div className="nav-h">{g.h}</div>
                {g.items.map(it => (
                  <button key={it.id} className={active === it.id ? 'on' : ''} aria-current={active === it.id ? 'page' : undefined} onClick={() => go(it.id)}>
                    <Icon name={it.icon} />{it.label}
                    {it.count && counts[it.count] > 0 && (
                      <span className={`n ${it.count === 'waiting' || it.count === 'mats' ? '' : 'plain'}`}>
                        {counts[it.count]}<span className="sr">{it.count === 'mats' ? ' materials at risk' : ' waiting'}</span>
                      </span>
                    )}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>
          <div className="side-foot">{SITE.name} · {SITE.what}<br />{plan.products.length} products · {plan.materials.length} materials</div>
        </aside>
        <div className="main">
          <header className="top">
            {canBack && (
              <button className="btn ghost back-btn" onClick={back}
                title={`Back to ${backLabel}`} aria-label={`Back to ${backLabel}`}>
                <Icon name="back" />
                <span className="back-word">Back</span>
              </button>
            )}
            <span className="site">{SITE.name}<small>{SITE.short} · {todayLabel()}</small></span>
            <span className="badge-mock" title="Every number here is worked out from generated sample data">Mock data</span>
            <div className="top-r">
              <div className="search">
                <Icon name="search" />
                <input ref={searchBox} id="global-search" placeholder="Find a product or material" value={q}
                  onChange={e => setQ(e.target.value)} onKeyDown={onSearchKey} autoComplete="off"
                  role="combobox" aria-expanded={hits.length > 0} aria-controls="search-res" aria-label="Search products, materials and screens" />
                <kbd className="kbd">/</kbd>
                {hits.length > 0 && (
                  <div className="search-res" id="search-res" role="listbox">
                    {hits.map((h, i) => (
                      <button key={h.k} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''}
                        onMouseEnter={() => setHi(i)} onClick={() => go(h.page, h.id)}>{h.t}<small>{h.s}</small></button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn ghost" title="Planning settings" aria-label="Planning settings" onClick={() => setShowSettings(true)}><Icon name="gear" /></button>
              <button className="btn ghost" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>
            </div>
          </header>
          <main className="page" id="main" key={route.page + (route.id ?? '')}>
            <Boundary resetKey={route.page + (route.id ?? '')} onHome={() => go('command')}>
              <Page id={route.id} />
            </Boundary>
          </main>
        </div>
      </div>

      {showSettings && (
        <Drawer title="Planning settings" sub="Change a rule and every screen follows it straight away." onClose={() => setShowSettings(false)}>
          <Knob label="Service level" value={state.settings.serviceLevel} min={80} max={99} step={1} unit="%"
            help={`How often finished stock should cover demand. Higher means more safety stock: z = ${plan.z.toFixed(2)} today.`}
            onChange={(v) => act.setting({ serviceLevel: v })} />
          <Knob label="Sales-change threshold" value={state.settings.changeThreshold} min={5} max={40} step={1} unit="%"
            help={`How far sales must move from the forecast before it is reported as a change. Finding ${plan.changes.length} right now.`}
            onChange={(v) => act.setting({ changeThreshold: v })} />
          <Knob label="Rush delivery charge" value={state.settings.rushPremium} min={0} max={40} step={1} unit="%"
            help="Extra paid when an order has to be rushed because the normal order date has passed."
            onChange={(v) => act.setting({ rushPremium: v })} />
          <Knob label="Too-much-stock limit" value={state.settings.excessDays} min={30} max={150} step={5} unit=" days"
            help={`Hold more than this and the material is flagged so cash can be freed. ${plan.materials.filter(m => m.excess).length} flagged now.`}
            onChange={(v) => act.setting({ excessDays: v })} />
          <div className="knob">
            <div className="row between"><b>Appearance</b></div>
            <div style={{ marginTop: 6 }}>
              <div className="seg" role="group" aria-label="Theme">
                {['light', 'dark'].map(t => (
                  <button key={t} type="button" aria-pressed={theme === t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="drawer-foot">
            <div className="note" style={{ marginBottom: 8 }}>
              {state.log.length} decision{state.log.length === 1 ? '' : 's'} taken · {state.approved.length} order{state.approved.length === 1 ? '' : 's'} placed.
              Saved in this browser only.
            </div>
            <div className="row">
              <button className="btn" onClick={() => { act.setting({ ...DEFAULT_SETTINGS }); notify('Settings back to normal.') }}><Icon name="undo" size={13} />Default settings</button>
              <button className="btn" onClick={() => { act.reset(); setShowSettings(false) }}>Reset the whole demo</button>
            </div>
          </div>
        </Drawer>
      )}

      <div className="toast-live" role="status" aria-live="polite">{toast && <div className="toast">{toast}</div>}</div>
    </Ctx.Provider>
  )
}
