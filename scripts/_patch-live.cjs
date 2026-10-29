// Live calendar + real dates on everything a person does.
// Run: node scripts/_patch-live.cjs
const fs = require('fs')
const CRLF = String.fromCharCode(13) + String.fromCharCode(10), LF = String.fromCharCode(10)
const memo = new Map()
const rd = (f) => { const r = fs.readFileSync(f, 'utf8'); memo.set(f, r.includes(CRLF)); return r.split(CRLF).join(LF) }
const wr = (f, s) => fs.writeFileSync(f, memo.get(f) ? s.split(LF).join(CRLF) : s)
const sub = (f, pairs) => {
  let s = rd(f)
  for (const [o, n] of pairs) {
    if (!s.includes(o)) { if (s.includes(n.slice(0, 50))) continue; throw new Error(`${f}: cannot find  ${o.slice(0, 80)}`) }
    s = s.replace(o, n)
  }
  wr(f, s)
}

// ===== 1. data.js — the planning week follows the real calendar =====
sub('src/data.js', [
  [`const DAY0 = Date.UTC(2026, 9, 26)      // Monday of this week (26 Oct 2026)`,
   `// This week, from the computer's own clock: the planning calendar moves with the
// real one, so week 0 is always the week you are actually in.
const _now = new Date()
const _dow = (_now.getDay() + 6) % 7                       // Monday = 0
const DAY0 = Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate() - _dow)`],

  [`export const dayLabel = (days) => { const d = new Date(DAY0 + 2 * 864e5 + days * 864e5); return \`\${d.getUTCDate()} \${MON[d.getUTCMonth()]}\` }
export const TODAY_OFFSET = 2           // today is Wednesday 28 Oct, 2 days into the week`,
   `export const TODAY_OFFSET = _dow        // how many days into the planning week today is
export const dayLabel = (days) => { const d = new Date(DAY0 + TODAY_OFFSET * 864e5 + days * 864e5); return \`\${d.getUTCDate()} \${MON[d.getUTCMonth()]}\` }

// Today, and the real clock time of something the planner did. These are the live
// dates — the ones that move on their own — as opposed to the planning weeks above.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const todayLabel = () => {
  const d = new Date()
  return \`\${DAYS[d.getDay()]} \${d.getDate()} \${MON[d.getMonth()]} \${d.getFullYear()}\`
}
export const fmtWhen = (ms) => {
  const d = new Date(ms)
  const t = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yday = new Date(today.getTime() - 864e5).toDateString() === d.toDateString()
  const day = sameDay ? 'Today' : yday ? 'Yesterday' : \`\${d.getDate()} \${MON[d.getMonth()]}\`
  return \`\${day}, \${t}\`
}
export const fmtDate = (ms) => { const d = new Date(ms); return \`\${d.getDate()} \${MON[d.getMonth()]} \${d.getFullYear()}\` }`],
])

// ===== 2. App.jsx — stamp what the planner does with the real clock =====
sub('src/App.jsx', [
  [`import { buildData, SITE, HIST, wkYear, SYSTEMS } from './data.js'`,
   `import { buildData, SITE, HIST, wkYear, SYSTEMS, todayLabel, fmtWhen } from './data.js'`],

  // the header shows today's real date
  [`<span className="site">{SITE.name}<small>{SITE.short} · {wkYear(HIST)} week</small></span>`,
   `<span className="site">{SITE.name}<small>{SITE.short} · {todayLabel()}</small></span>`],

  // a purchase order remembers when it was really placed
  [`            id: \`PO-26-\${seq}\`, mat: b.mat.id, qty: q2, placedDay: 0,`,
   `            id: \`PO-26-\${seq}\`, mat: b.mat.id, qty: q2, placedDay: 0, placedAt: Date.now(),`],

  // so does a production order
  [`              line: p?.cold ? 'Cold rolling' : 'Hot rolling', status: 'Planned', at: clockNow(),`,
   `              line: p?.cold ? 'Cold rolling' : 'Hot rolling', status: 'Planned',
              at: clockNow(), raisedAt: Date.now(), fromDecision: d.id,`],

  // and every activity row carries the real moment, not only a clock time
  [`    activity: [{ id: \`AC-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 6)}\`, at: clockNow(), ...e }, ...s.activity].slice(0, 80),`,
   `    activity: [{ id: \`AC-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 6)}\`, at: clockNow(), when: Date.now(), ...e }, ...s.activity].slice(0, 80),`],
])

// ===== 3. Orders.jsx — show when it was really placed =====
sub('src/pages/Orders.jsx', [
  [`import { HIST, wk, dayLabel, REGIONS } from '../data.js'`,
   `import { HIST, wk, dayLabel, REGIONS, fmtWhen } from '../data.js'`],

  // material orders: a "Placed" column for the ones raised here
  [`              <thead><tr><th scope="col">Order</th><th scope="col">Material</th><th scope="col">Supplier</th><th scope="col" className="r">Amount</th><th scope="col">Arrives</th><th scope="col">Status</th></tr></thead>`,
   `              <thead><tr><th scope="col">Order</th><th scope="col">Material</th><th scope="col">Supplier</th><th scope="col" className="r">Amount</th><th scope="col">Placed</th><th scope="col">Arrives</th><th scope="col">Status</th></tr></thead>`],

  [`<td className="r num">{fmtQty(p.qty, m.unit)}</td><td>{dayLabel(p.dueDay)}</td><td><span className="tag">{p.status}</span></td></tr> })}</tbody>`,
   `<td className="r num">{fmtQty(p.qty, m.unit)}</td><td className="num" style={{ whiteSpace: 'nowrap' }}>{p.placedAt ? fmtWhen(p.placedAt) : <span className="note">before today</span>}</td><td>{dayLabel(p.dueDay)}</td><td><span className="tag">{p.status}</span></td></tr> })}</tbody>`],

  // production orders: raised-at as a real date
  [`                    <td className="num">{w.at}</td>`,
   `                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{w.raisedAt ? fmtWhen(w.raisedAt) : w.at}</td>`],
  [`<th scope="col">Raised</th>`, `<th scope="col">Raised</th>`],
])

// ===== 4. Plan.jsx — what was sent to the plan, and when =====
sub('src/pages/Plan.jsx', [
  [`import { useApp, Head, Card, Pill, MatPill, useViewState } from '../ui.jsx'`,
   `import { useApp, Head, Card, Pill, MatPill, Empty, useViewState } from '../ui.jsx'`],
  [`import { HIST, AHEAD, wk, dayLabel } from '../data.js'`,
   `import { HIST, AHEAD, wk, dayLabel, fmtWhen } from '../data.js'`],
  [`  const { plan, go } = useApp()`, `  const { plan, go, state } = useApp()`],
])
{
  let s = rd('src/pages/Plan.jsx')
  const anchor = `      {step === 2 && <>`
  if (!s.includes(anchor)) throw new Error('Plan: step 2 not found')
  if (!s.includes('Sent to the plan')) {
    s = s.replace(anchor, `      {step === 2 && <>
        {(state.production ?? []).length > 0 && (
          <Card title="Sent to the plan" sub="Production you approved on the Decisions screen. Newest first." pad={false}>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr>
                <th scope="col">Order</th><th scope="col">Product</th><th scope="col">Line</th>
                <th scope="col" className="r">Extra tonnes</th><th scope="col">Spread over</th>
                <th scope="col">Approved</th><th scope="col">Status</th><th scope="col"></th>
              </tr></thead>
              <tbody>
                {state.production.map(w => (
                  <tr key={w.id} className="click" onClick={() => go('product', w.productId)}>
                    <td className="num">{w.id}</td>
                    <td className="nm">{w.name}</td>
                    <td>{w.line}</td>
                    <td className="r num">{fmtT(w.qty)}</td>
                    <td className="note">{w.weeks} weeks</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{w.raisedAt ? fmtWhen(w.raisedAt) : w.at}</td>
                    <td><span className="tag">{w.status}</span></td>
                    <td><button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); go('orders', 'wo') }}>In Orders</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="note" style={{ padding: '8px 14px' }}>
              Each of these adds its tonnes to the product's make plan over the weeks shown. The line
              load below already allows for the forecast; these are the top-ups you approved on top of it.
            </div>
          </Card>
        )}`)
    wr('src/pages/Plan.jsx', s)
  }
}

// ===== 5. Decisions "What you did" — real date, not just a clock time =====
sub('src/pages/Decisions.jsx', [
  [`                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{e.at}</td>`,
   `                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{e.when ? fmtWhen(e.when) : e.at}</td>`],
  [`import { fmtINR, sum } from '../engine.js'`,
   `import { fmtINR, sum } from '../engine.js'\nimport { fmtWhen } from '../data.js'`],
])

const out = {
  'src/data.js': ['live week', 'const _dow = (_now.getDay() + 6) % 7'],
  'src/data.js2': ['fmtWhen', 'export const fmtWhen'],
  'src/App.jsx': ['real placed time', 'placedAt: Date.now()'],
  'src/App.jsx2': ['header shows today', 'todayLabel()'],
  'src/pages/Orders.jsx': ['placed column', 'Placed</th>'],
  'src/pages/Plan.jsx': ['sent to the plan', 'Sent to the plan'],
  'src/pages/Decisions.jsx': ['date in the trail', 'e.when ? fmtWhen(e.when)'],
}
let bad = 0
for (const [k, [what, needle]] of Object.entries(out)) {
  const f = k.replace(/\d$/, '')
  if (!rd(f).includes(needle)) { bad++; console.log('  MISSING: ' + what + ' in ' + f) }
}
console.log(bad === 0 ? `all ${Object.keys(out).length} edits present on disk` : `${bad} missing`)
process.exit(bad === 0 ? 0 : 1)
