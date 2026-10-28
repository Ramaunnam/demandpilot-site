// The planning engine. One pass turns the site's data into everything the
// screens show: forecast → sales changes → product stock → production plan →
// factory load → materials (MRP) → what to buy → decisions. Every headline
// number also gets an explanation (the ⓘ) built from the same inputs.
import {
  HIST, AHEAD, GRADES, REGIONS, REGION_IDS, MATERIALS, LINES, SIGNALS, TODAY_OFFSET,
  wk, wkRange, dayLabel, matOf,
} from './data.js'

// ---------- small maths ----------
export const sum = (a) => a.reduce((s, x) => s + x, 0)
export const mean = (a) => (a.length ? sum(a) / a.length : 0)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0 }

export const fmtT = (x) => `${Math.abs(x) >= 100 ? Math.round(x).toLocaleString('en-IN') : (Math.round(x * 10) / 10).toLocaleString('en-IN')} t`
export const fmtNum = (x, dp = 0) => Number(x).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })
export const fmtQty = (x, unit) => unit === 't' ? fmtT(x) : `${fmtNum(unit === 'nos' ? Math.ceil(x) : Math.round(x))} ${unit}`
export const fmtPct = (x, dp = 0) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(dp)}%`
export const fmtINR = (n) => {
  const a = Math.abs(n), s = a >= 1e7 ? `₹${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `₹${(a / 1e5).toFixed(1)} L` : `₹${Math.round(a).toLocaleString('en-IN')}`
  return n < 0 ? `−${s}` : s
}
export const daysText = (d) => d <= 0 ? 'now' : `${Math.round(d)} day${Math.round(d) === 1 ? '' : 's'}`

// ---------- forecasting: Holt-Winters with a 52-week season ----------
export function hw(y, h, clip = 0) {
  const m = 52, n = y.length, a = 0.3, b = 0.02, g = 0.06
  const m2 = Math.min(n, 2 * m)
  const s1 = mean(y.slice(0, m)), s2 = mean(y.slice(m, m2))
  let T = (s2 - s1) / ((m2 - m) / 2 + m / 2), L = s1 - (m / 2) * T
  let S = y.slice(0, m).map((v, i) => (i + m < n ? (v / s1 + y[i + m] / s2) / 2 : v / s1))
  S = S.map((_, i) => { let x = 0; for (let k = -2; k <= 2; k++) x += S[(i + k + m) % m]; return x / 5 })
  const ms = mean(S); S = S.map(x => x / ms)
  const fitted = new Array(n).fill(null)
  let clipped = false
  for (let t = 0; t < n; t++) {
    const si = S[t % m], f = (L + T) * si
    if (t >= m) fitted[t] = f
    let v = y[t]
    if (clip && t >= m && Math.abs(v / f - 1) > clip && !clipped) { v = f; clipped = true } else clipped = false
    const Lp = L
    L = a * (v / si) + (1 - a) * (L + T)
    T = b * (L - Lp) + (1 - b) * T
    S[t % m] = g * (v / L) + (1 - g) * si
  }
  const fc = []
  for (let k = 1; k <= h; k++) fc.push(Math.max(0, (L + k * T) * S[(n + k - 1) % m]))
  return { fitted, fc, season: S[n % m], trendPerYear: (T * 52) / Math.max(0.01, L) }
}
function robustSigma(y, f, s) {
  const r = []
  for (let t = s; t < y.length; t++) if (f[t]) r.push((y[t] - f[t]) / f[t])
  const med = median(r)
  return Math.max(0.03, median(r.map(x => Math.abs(x - med))) * 1.4826)
}
// z for a service level (normal distribution)
export function zFor(pct) {
  const p = clamp(pct / 100, 0.5, 0.9999), q = p - 0.5
  if (p > 0.97575) { const t = Math.sqrt(-2 * Math.log(1 - p)); return -(((((-0.007784894002430293 * t - 0.3223964580411365) * t - 2.400758277161838) * t - 2.549732539343734) * t + 4.374664141464968) * t + 2.938163982698783) / ((((0.007784695709041462 * t + 0.3224671290700398) * t + 2.445134137142996) * t + 3.754408661907416) * t + 1) }
  const r = q * q
  return (((((-39.69683028665376 * r + 220.9460984245205) * r - 275.9285104469687) * r + 138.357751867269) * r - 30.66479806614716) * r + 2.506628277459239) * q / (((((-54.47609879822406 * r + 161.5858368580409) * r - 155.6989798598866) * r + 66.80131188771972) * r - 13.28068155288572) * r + 1)
}

// ---------- the ⓘ ----------
// An explanation carries the shown value itself, so the popup can never disagree with the screen.
function ex(o) { return { ...o, inputs: o.inputs ?? [] } }

export const DEFAULT_SETTINGS = { serviceLevel: 95, changeThreshold: 15, rushPremium: 10, excessDays: 90 }

const hashN = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000; return h / 1000 }
// =====================================================================
// Pass A — the baseline. Reads only the site's sales, so it is worked out
// once and reused: finding the changes is two-thirds of the whole
// calculation, and nothing a planner decides can alter what the raw sales
// already did. Only the change threshold can, so it keys the cache.
// =====================================================================
let _baseCache = null

function baseline(data, threshold) {
  if (_baseCache && _baseCache.data === data && _baseCache.threshold === threshold) return _baseCache

  const P = data.products
  const pById = Object.fromEntries(P.map(p => [p.id, p]))

  // ---------- 1. sales changes, found on raw sales ----------
  const series = {}
  const changesRaw = []   // per product-region shift
  const oneOffs = []      // single unusual weeks
  for (const p of P) for (const reg of REGION_IDS) {
    const key = `${p.id}|${reg}`
    const raw = data.sales[key]
    const det = hw(raw, 1, 0.25)
    const sr = robustSigma(raw, det.fitted, 52)
    // one-off weeks in the last 10 weeks
    const points = []
    for (let t = HIST - 10; t < HIST; t++) {
      const zf = ((raw[t] - det.fitted[t]) / det.fitted[t]) / sr
      if (Math.abs(zf) >= 4 && det.fitted[t] >= 1) points.push({ t, actual: raw[t], expected: det.fitted[t], z: zf })
    }
    // shift: the last 6 weeks vs what the model expected 6 weeks ago.
    // Isolated weeks before the window are cleaned first so they don't move the baseline.
    const clean = raw.slice()
    for (const pt of points) if (pt.t < HIST - 6) clean[pt.t] = pt.expected
    const baseFc = hw(clean.slice(0, HIST - 6), 6).fc
    const recent = raw.slice(HIST - 6)
    const ratio = sum(recent) / sum(baseFc)
    const dir = ratio > 1 ? 1 : -1
    const sameWay = recent.filter((v, k) => (v / baseFc[k] - 1) * dir >= 0.1).length
    let shift = null
    // a shift = 4+ of the last 6 weeks clearly off in the same direction, and the total off by the threshold
    if (sameWay >= 4 && Math.abs(ratio - 1) * 100 >= threshold && mean(recent) >= 1.5) {
      let start = HIST - 6
      for (let k = 0; k < 6; k++) if ((recent[k] / baseFc[k] - 1) * dir >= 0.1 && (k === 5 || (recent[k + 1] / baseFc[k + 1] - 1) * dir >= 0.1)) { start = HIST - 6 + k; break }
      shift = { key, productId: p.id, region: reg, ratio, dir, start, beforeWk: mean(baseFc), nowWk: mean(recent.slice(-4)), extraWk: mean(recent.slice(-4)) - mean(baseFc.slice(-4)), baseFc }
      changesRaw.push(shift)
    }
    for (const pt of points) {
      if (shift && pt.t >= HIST - 6) continue
      oneOffs.push({ id: `OO:${key}|${pt.t}`, productId: p.id, region: reg, ...pt })
    }
    series[key] = { raw, det, sr, shift, points: points.filter(pt => !(shift && pt.t >= HIST - 6)) }
  }

  // group shifts that moved together (same grade, region, direction)
  const groupMap = new Map()
  for (const c of changesRaw) {
    const p = pById[c.productId]
    const gid = `SH:${p.grade}|${c.region}|${c.dir > 0 ? 'up' : 'down'}`
    if (!groupMap.has(gid)) groupMap.set(gid, [])
    groupMap.get(gid).push(c)
  }
  const pastOrders = data.orders.filter(o => o.week < HIST)
  const groups = [...groupMap.entries()].map(([id, items]) => {
    const p0 = pById[items[0].productId]
    const dir = items[0].dir
    const region = items[0].region
    const start = Math.min(...items.map(i => i.start))
    items.sort((a, b) => Math.abs(b.extraWk) - Math.abs(a.extraWk))
    const extraWk = sum(items.map(i => i.extraWk))
    const beforeWk = sum(items.map(i => i.beforeWk)), nowWk = sum(items.map(i => i.nowWk))
    const pct = beforeWk > 0 ? (nowWk / beforeWk - 1) * 100 : 0
    const forms = [...new Set(items.map(i => pById[i.productId].formName))]
    const families = [...new Set(items.map(i => pById[i.productId].family))]
    const sig = SIGNALS.find(s => s.grades && s.grades.includes(p0.grade) && (s.regions.length === 0 || s.regions.includes(region)) &&
      Math.sign(s.effect) === dir && s.week <= start + 1 && s.week >= start - 10)
    const sig2 = SIGNALS.filter(s => s.grades && s.grades.includes(p0.grade) && (s.regions.length === 0 || s.regions.includes(region)) && Math.sign(s.effect) === dir && s.week <= HIST && s.week >= start - 10)
    // order book evidence
    const ids = new Set(items.map(i => i.productId))
    const os = pastOrders.filter(o => o.region === region && ids.has(o.productId))
    const firstW = HIST - 8
    const before = os.filter(o => o.week < start), during = os.filter(o => o.week >= start)
    const bW = Math.max(1, start - firstW), dW = Math.max(1, HIST - start)
    const byC = {}
    for (const o of during) byC[o.customer] = (byC[o.customer] ?? 0) + o.qty
    const top = Object.entries(byC).sort((a, b) => b[1] - a[1])[0]
    const ordersEv = start - firstW >= 2 ? {
      before: sum(before.map(o => o.qty)) / bW, during: sum(during.map(o => o.qty)) / dW,
      customers: Object.keys(byC).length, top: top?.[0] ?? null, topShare: top ? top[1] / Math.max(0.1, sum(during.map(o => o.qty))) * 100 : 0,
    } : null
    const ordersAgree = ordersEv && (ordersEv.during - ordersEv.before) * dir > 0
    const conf = Math.round(clamp(55 + items.length * 4 + (HIST - start) * 3 + (sig ? 15 : 0) + (ordersAgree ? 6 : 0), 50, sig ? 95 : 82))
    return {
      id, kind: 'shift', grade: p0.grade, region, dir, start, items, extraWk, beforeWk, nowWk, pct, forms, signal: sig ?? null, signals: sig2,
      orders: ordersEv, ordersAgree, conf,
      title: `${families.length === 1 ? families[0] : p0.grade + ' stainless steel'} — ${region} customers`,
      headline: `Sales ${dir > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(0)}% across ${items.length} product${items.length > 1 ? 's' : ''}`,
      why: sig ? sig.title : 'No known reason yet. Check with the sales team.',
    }
  }).sort((a, b) => Math.abs(b.extraWk) - Math.abs(a.extraWk))

  const oneOffList = oneOffs.map(o => {
    const p = pById[o.productId]
    const os = data.orders.filter(x => x.productId === o.productId && x.region === o.region && x.week === o.t)
    const big = os.sort((a, b) => b.qty - a.qty)[0]
    return {
      ...o, kind: 'oneoff', product: p,
      pct: (o.actual / o.expected - 1) * 100,
      why: o.actual > o.expected
        ? (big ? `One large order: ${big.customer} ordered ${fmtT(big.qty)} that week.` : 'One unusually large week.')
        : 'One unusually small week, likely a customer pausing orders.',
    }
  })

  _baseCache = { data, threshold, pById, series, groups, oneOffs: oneOffList, fc: new Map() }
  return _baseCache
}

// =====================================================================
// Pass B — everything that follows from the planner's decisions.
// =====================================================================
export function computePlan(data, state) {
  const settings = state.settings
  const P = data.products
  const z = zFor(settings.serviceLevel)

  const base = baseline(data, settings.changeThreshold)
  const { pById, series } = base
  // The planner's decision is the only thing the baseline leaves open.
  const changes = base.groups.map(g => ({ ...g, status: state.decisions[g.id] ?? 'open' }))
  const oneOffList = base.oneOffs.map(o => ({ ...o, status: state.decisions[o.id] ?? 'open' }))
  // ---------- 2. forecast per product × region, with the planner's decisions applied ----------
  const decidedShift = new Map()
  for (const c of changes) if (c.status === 'real' || c.status === 'oneoff') for (const i of c.items) decidedShift.set(i.key, { ...i, status: c.status })
  const fcByKey = {}
  for (const p of P) for (const reg of REGION_IDS) {
    const key = `${p.id}|${reg}`
    const s = series[key]
    const dec = decidedShift.get(key)
    // Everything a decision can change about this one product-region, as a short
    // string. Same string → same forecast, so the Holt-Winters pass is kept and
    // only the few keys a decision actually touched are worked out again.
    let sig = dec ? dec.status : '-'
    for (const pt of s.points) if ((state.decisions[`OO:${key}|${pt.t}`] ?? 'open') === 'oneoff') sig += `,o${pt.t}`
    const cached = base.fc.get(`${key}|${sig}`)
    if (cached) { fcByKey[key] = cached; continue }

    const hist = s.raw.slice()
    for (const pt of s.points) if ((state.decisions[`OO:${key}|${pt.t}`] ?? 'open') === 'oneoff') hist[pt.t] = pt.expected
    if (dec?.status === 'oneoff') for (let t = HIST - 6; t < HIST; t++) hist[t] = dec.baseFc[t - (HIST - 6)]
    const m = hw(hist, AHEAD)
    let fc = m.fc
    // market news not yet seen in sales: a gentle lift, phased in
    let news = 0
    const newsIds = []
    for (const sg of SIGNALS) {
      if (!sg.grades || !sg.grades.includes(p.grade) || (sg.regions.length && !sg.regions.includes(reg))) continue
      if (sg.week < HIST - 10) continue
      if (s.shift && Math.sign(sg.effect) === s.shift.dir) continue
      news += sg.effect * sg.conf * 0.4
      newsIds.push(sg.id)
    }
    fc = fc.map((v, k) => v * (1 + (news / 100) * Math.min(1, (k + 1) / 4)))
    if (dec?.status === 'real') {
      const now = mean(fc.slice(0, 4)), target = dec.nowWk
      if ((target - now) * dec.dir > 0 && now > 0) { const f = clamp(target / now, 0.5, 2); fc = fc.map(v => v * f) }
    }
    // accuracy: last 12 weeks, one-step-ahead, vs the old 12-week-average method
    let err = 0, errOld = 0, tot = 0, se = 0, cnt = 0
    for (let t = HIST - 12; t < HIST; t++) {
      if (!m.fitted[t]) continue
      err += Math.abs(s.raw[t] - m.fitted[t]); errOld += Math.abs(s.raw[t] - mean(s.raw.slice(t - 12, t))); tot += s.raw[t]
    }
    for (let t = HIST - 26; t < HIST; t++) if (m.fitted[t]) { const e = (hist[t] - m.fitted[t]) / m.fitted[t]; se += e * e; cnt++ }
    const rel = Math.sqrt(se / Math.max(1, cnt))
    fcByKey[key] = { fc, lo: fc.map((v, k) => Math.max(0, v * (1 - 1.28 * rel * Math.sqrt(1 + 0.1 * k)))), hi: fc.map((v, k) => v * (1 + 1.28 * rel * Math.sqrt(1 + 0.1 * k))), err, errOld, tot, rel, season: m.season - 1, trend: m.trendPerYear, news, newsIds }
    base.fc.set(`${key}|${sig}`, fcByKey[key])
  }

  // ---------- today's material prices, and the material cost of one tonne of each grade ----------
  const priceIdx = {}
  for (const k of Object.keys(data.prices)) { const sr = data.prices[k]; priceIdx[k] = sr[sr.length - 1].v / 100 }
  const matPriceNow = Object.fromEntries(MATERIALS.map(m => [m.id, m.index ? m.price * priceIdx[m.index] : m.price]))
  const matCostByGrade = Object.fromEntries(GRADES.map(g => [g.id, sum(MATERIALS.map(m => m.bom[g.id] * matPriceNow[m.id]))]))

  // ---------- 3. per product: total forecast, stock, production plan ----------
  const products = P.map(p => {
    const regs = REGION_IDS.map(r => fcByKey[`${p.id}|${r}`])
    const fc = new Array(AHEAD).fill(0).map((_, k) => sum(regs.map(x => x.fc[k])))
    const lo = new Array(AHEAD).fill(0).map((_, k) => sum(regs.map(x => x.lo[k])))
    const hi = new Array(AHEAD).fill(0).map((_, k) => sum(regs.map(x => x.hi[k])))
    const hist = new Array(HIST).fill(0).map((_, t) => sum(REGION_IDS.map(r => data.sales[`${p.id}|${r}`][t])))
    const byRegionFc = Object.fromEntries(REGION_IDS.map(r => [r, fcByKey[`${p.id}|${r}`].fc]))
    const byRegionHist = Object.fromEntries(REGION_IDS.map(r => [r, data.sales[`${p.id}|${r}`]]))
    const err = sum(regs.map(x => x.err)), errOld = sum(regs.map(x => x.errOld)), tot = sum(regs.map(x => x.tot))
    const matCost = matCostByGrade[p.grade]        // raw materials in one tonne, at today's prices
    const marginPerT = p.price - matCost               // what a tonne earns before wages, power and the rest
    const recent4 = mean(hist.slice(HIST - 4))
    const weekly = mean(fc.slice(0, 4))
    const rel = Math.sqrt(mean(regs.map(x => x.rel ** 2)))
    const L = p.makeWeeks
    // starting stock: weeks of cover set per product (316L is thin after the surge)
    const coverW = p.grade === '316L' ? (p.tier === 1 ? 0.9 : 1.6 + hashN(p.id) * 0.5) : 2 + hashN(p.id) * 2
    const onHand = Math.round(recent4 * coverW * 10) / 10
    const wip = new Array(L).fill(Math.round(recent4 * 10) / 10)   // already being made, arrives weeks 0..L-1
    const sigma = rel * weekly
    const ss = z * sigma * Math.sqrt(L + 1)
    const demandL = sum(fc.slice(0, L + 1))
    const rop = demandL + ss
    const target = rop + sum(fc.slice(L + 1, L + 3))
    const position = onHand + sum(wip)
    const topUp = Math.max(0, target - position)
    const make = fc.map((v, w) => Math.max(0, v + (w < 6 ? topUp / 6 : 0)))
    // stock projection: production started in week w is ready in week w+L
    const proj = []
    let inv = onHand, runOutDay = null
    for (let w = 0; w < AHEAD; w++) {
      const arrive = (w < L ? wip[w] : make[w - L])
      inv += arrive
      const after = inv - fc[w]
      if (after < 0 && runOutDay === null) runOutDay = Math.max(0, w * 7 + (inv / Math.max(0.01, fc[w])) * 7 - TODAY_OFFSET)
      inv = after
      proj.push({ w, stock: inv, arrive, demand: fc[w] })
    }
    const daysLeft = onHand / Math.max(0.01, weekly / 7)
    const urgency = runOutDay !== null && runOutDay < L * 7 ? 'Urgent' : position <= rop ? 'Soon' : 'OK'
    const change = changes.find(c => c.items.some(i => i.productId === p.id))
    return {
      ...p, hist, fc, lo, hi, byRegionFc, byRegionHist, weekly, recent4, onHand, wip, L, sigma, ss, rop, target, position, demandL,
      matCost, marginPerT,
      make, proj, runOutDay, daysLeft, urgency, change: change ?? null,
      acc: tot ? 1 - err / tot : 0, accOld: tot ? 1 - errOld / tot : 0, err, errOld, tot,
      drivers: { season: mean(regs.map(x => x.season)), trend: mean(regs.map(x => x.trend)), news: mean(regs.map(x => x.news)), newsIds: [...new Set(regs.flatMap(x => x.newsIds))] },
      next12: sum(fc), value12: sum(fc) * p.price,
    }
  })
  const prodById = Object.fromEntries(products.map(p => [p.id, p]))

  // ---------- 4. factory load per line, per week ----------
  const totalMake = new Array(AHEAD).fill(0).map((_, w) => sum(products.map(p => p.make[w])))
  const coldMake = new Array(AHEAD).fill(0).map((_, w) => sum(products.filter(p => p.cold).map(p => p.make[w])))
  const lines = LINES.map(l => {
    const weeks = new Array(AHEAD).fill(0).map((_, w) => {
      const cap = l.maintenance && l.maintenance.week === HIST + w ? l.cap * l.maintenance.pct / 100 : l.cap
      const load = l.all ? totalMake[w] : coldMake[w]
      return { w, cap, load, pct: load / cap * 100, over: Math.max(0, load - cap) }
    })
    return { ...l, weeks }
  })
  const overloads = []
  for (const l of lines) for (const x of l.weeks) if (x.over > 0) overloads.push({ line: l, ...x })

  // ---------- 5. materials (MRP) ----------
  const allPos = [...data.pos, ...state.approved.map(a => ({ ...a }))]
  const materials = MATERIALS.map(m => {
    const priceNow = matPriceNow[m.id]
    const histUse = mean(new Array(8).fill(0).map((_, i) => sum(products.map(p => p.hist[HIST - 8 + i] * m.bom[p.grade])))) / 7
    const onHand = Math.round(histUse * m.cover * 10) / 10
    const gross = new Array(AHEAD).fill(0).map((_, w) => sum(products.map(p => p.make[w] * m.bom[p.grade])))
    const daily = mean(gross.slice(0, 4)) / 7
    const safety = daily * m.safetyDays
    const myPos = allPos.filter(x => x.mat === m.id && x.status !== 'Received')
    const rows = []
    let poh = onHand, noBuy = onHand, runOutDay = null
    const planned = []
    // One order covers the whole delivery window, not one week. Ordering week by week
    // would mean a 42-day-lead material needs six orders all placed today — approving
    // one would just raise the next. Covering the window is what a buyer actually does.
    const coverW = clamp(Math.ceil(m.lead / 7), 1, AHEAD)
    // An order placed today cannot land before the delivery time is up, so no new order
    // is planned in the weeks before that. Whatever is short by then is carried forward
    // and bought in the first week an order can actually arrive.
    const reachW = Math.min(AHEAD - 1, Math.floor((m.lead + TODAY_OFFSET) / 7))
    let nextOrderW = reachW
    for (let w = 0; w < AHEAD; w++) {
      const receipts = sum(myPos.filter(x => Math.floor((x.dueDay + TODAY_OFFSET) / 7) === w).map(x => x.qty))
      const start = poh
      poh = poh + receipts - gross[w]
      noBuy = noBuy + receipts - gross[w]
      if (noBuy < 0 && runOutDay === null) runOutDay = Math.max(0, w * 7 - TODAY_OFFSET + 7 * ((noBuy + gross[w]) / Math.max(0.0001, gross[w])))
      const needDay = w * 7 - TODAY_OFFSET
      let por = 0
      if (poh < safety && w >= nextOrderW) {
        if (needDay - m.lead < 0) {
          // The order date has already gone, so this one has to be rushed. A rush order
          // only has to bridge the gap until a normally-placed order can arrive: the
          // delivery time, the safety days and a fortnight of slack, less what is already
          // in stock or on the water. It is not asked to cover the whole catch-up.
          const onOrder = sum(myPos.map(x => x.qty))
          const bridge = (m.lead + m.safetyDays + 14) * daily
          por = Math.ceil(Math.max(0, bridge - onHand - onOrder) / m.lot) * m.lot
        } else {
          const window = sum(gross.slice(w + 1, w + coverW))   // what the next weeks also need
          por = Math.ceil(Math.max(0, window + safety - poh) / m.lot) * m.lot
        }
        poh += por
        nextOrderW = w + coverW
      }
      if (por > 0) planned.push({ w, qty: por, needDay, orderByDay: needDay - m.lead, coversWeeks: Math.min(coverW, AHEAD - w) })
      rows.push({ w, start, gross: gross[w], receipts, por, end: poh, below: start + receipts - gross[w] < safety, reachable: w >= reachW })
    }
    const daysLeft = onHand / Math.max(0.0001, daily)
    const first = planned[0]
    // Too much stock: it lasts past the limit and nothing needs ordering inside that window.
    const excess = daysLeft > settings.excessDays && (!first || first.needDay > settings.excessDays)
    const urgency = runOutDay !== null && runOutDay < m.lead ? 'Urgent'
      : first && first.orderByDay < 0 ? 'Urgent'
        : first && first.orderByDay <= 7 ? 'Soon' : excess ? 'Info' : 'OK'
    // A rush order cannot beat physics, but the supplier can cut the normal lead time.
    const rushDays = clamp(Math.round(m.lead / 3), 2, m.lead)
    return { ...m, priceNow, onHand, daily, gross, safety, rows, planned, runOutDay, daysLeft, urgency, excess, rushDays, coverW, reachW, pos: myPos, value: onHand * priceNow, reorderPoint: daily * m.lead + safety }
  })
  const matById = Object.fromEntries(materials.map(m => [m.id, m]))

  // ---------- 6. what to buy ----------
  const buys = []
  for (const m of materials) {
    const p0 = m.planned[0]
    if (p0 && p0.orderByDay <= 21) {
      const id = `BUY:${m.id}`
      if (state.rejected[id]) continue
      const late = p0.orderByDay < 0
      const qty = state.edits[id] ?? p0.qty
      const cost = qty * m.priceNow * (late ? 1 + settings.rushPremium / 100 : 1)
      const arrivesDay = late ? m.rushDays : m.lead
      buys.push({
        id, kind: 'buy', mat: m, qty, cost, late, orderByDay: p0.orderByDay, needDay: p0.needDay, supplier: m.supplier,
        covers: p0.coversWeeks, arrivesDay,
        urgency: late || m.urgency === 'Urgent' ? 'Urgent' : p0.orderByDay <= 7 ? 'Soon' : 'Watch',
        why: late
          ? `Stock lasts ${daysText(m.runOutDay ?? m.daysLeft)}, but normal delivery takes ${m.lead} days — the order date (${dayLabel(p0.orderByDay)}) has already passed. Rush delivery cuts it to about ${m.rushDays} days, arriving ${dayLabel(m.rushDays)}.`
          : `Stock falls below the safety level in the week of ${wk(HIST + p0.w)}. Delivery takes ${m.lead} days, so order by ${dayLabel(p0.orderByDay)}. This one order covers ${p0.coversWeeks} week${p0.coversWeeks === 1 ? '' : 's'} of use.`,
      })
    }
    if (m.excess) {
      const id = `CUT:${m.id}`
      if (!state.rejected[id]) {
        const keep = m.daily * 45
        const freed = Math.max(0, m.onHand - keep) * m.priceNow
        buys.push({ id, kind: 'cut', mat: m, qty: 0, cost: -freed, late: false, orderByDay: 30, supplier: m.supplier, urgency: 'Info',
          why: `Stock lasts ${Math.round(m.daysLeft)} days, far above the ${settings.excessDays}-day limit. Skip the next order; about ${fmtINR(freed)} of cash stays free.` })
      }
    }
  }
  const rank = { Urgent: 0, Soon: 1, Watch: 2, Info: 3, OK: 4 }
  buys.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.orderByDay - b.orderByDay)
  // One buy list, shared. Every screen that shows an order to place reads this row.
  for (const m of materials) { m.buy = null; m.cut = null }
  for (const b of buys) { if (b.kind === 'buy') b.mat.buy = b; else b.mat.cut = b }

  // ---------- 7. decisions waiting (one list, most urgent first) ----------
  const decisions = []
  for (const b of buys) {
    if ((b.kind === 'cut' && state.approvedIds[b.id]) || b.urgency === 'Watch') continue
    decisions.push({
      id: b.id, type: b.kind === 'buy' ? 'Order' : 'Buy less', urgency: b.urgency,
      name: b.mat.name, sub: b.mat.what,
      do: b.kind === 'buy' ? `Order ${fmtQty(b.qty, b.mat.unit)} from ${b.supplier}${b.late ? ' (rush delivery)' : ''}` : 'Skip the next order',
      why: b.why, deadlineDay: b.orderByDay, money: Math.abs(b.cost), sure: b.kind === 'buy' ? (b.late ? 92 : 85) : 75,
      link: { page: 'material', id: b.mat.id }, action: b.kind === 'buy' ? 'approve' : 'approve',
    })
  }
  for (const p of products) {
    if (p.urgency === 'OK') continue
    if (state.approvedIds[`MAKE:${p.id}`]) continue
    const extra = Math.max(0, p.target - p.position)
    decisions.push({
      id: `MAKE:${p.id}`, type: 'Make more', urgency: p.urgency,
      name: p.name, sub: p.use,
      do: `Plan ${fmtT(extra)} extra production over the next 6 weeks`,
      why: p.urgency === 'Urgent'
        ? `Stock lasts ${daysText(p.runOutDay)}, but making more takes ${p.L * 7} days. Customers may wait unless production is moved up.`
        : `Stock plus what is being made (${fmtT(p.position)}) is at or below the reorder level (${fmtT(p.rop)}).`,
      deadlineDay: p.urgency === 'Urgent' ? 0 : 7, money: extra * p.price, sure: Math.round(clamp(100 - p.sigma / Math.max(1, p.weekly) * 100, 60, 95)),
      link: { page: 'product', id: p.id }, action: 'approve',
    })
  }
  for (const c of changes) {
    if (c.status !== 'open') continue
    decisions.push({
      id: c.id, type: 'Sales change', urgency: 'Watch',
      name: c.title, sub: c.headline,
      do: c.dir > 0 ? 'Decide: real change (plan for it) or one-off' : 'Decide: real drop (buy less) or one-off',
      why: `${c.headline} since ${wk(c.start)}: ${fmtPct(c.extraWk / Math.max(1, c.beforeWk) * 100)} ≈ ${c.extraWk > 0 ? '+' : '−'}${fmtT(Math.abs(c.extraWk))} a week. ${c.signal ? `Likely reason: ${c.signal.title}.` : 'No known reason yet.'}`,
      deadlineDay: 7, money: Math.abs(c.extraWk) * mean(c.items.map(i => pById[i.productId].price)) * 4, sure: c.conf,
      link: { page: 'changes', id: c.id }, action: 'decide',
    })
  }
  for (const o of overloads) {
    decisions.push({
      id: `CAP:${o.line.id}:${o.w}`, type: 'Factory too busy', urgency: o.w <= 3 ? 'Soon' : 'Watch',
      name: `${o.line.name}, week of ${wk(HIST + o.w)}`, sub: o.line.maintenance && o.line.maintenance.week === HIST + o.w ? `Planned maintenance: line at ${o.line.maintenance.pct}% that week` : 'Line fully booked',
      do: `Move ${fmtT(o.over)} to the weeks before and after, or add a weekend shift`,
      why: `Planned ${fmtT(o.load)} but the line can do ${fmtT(o.cap)} that week.`,
      deadlineDay: Math.max(0, o.w * 7 - 7 - TODAY_OFFSET), money: 0, sure: 90,
      link: { page: 'plan' }, action: 'ack',
    })
  }
  for (const id of Object.keys(state.dismissed)) { const i = decisions.findIndex(d => d.id === id); if (i >= 0) decisions.splice(i, 1) }
  decisions.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.deadlineDay - b.deadlineDay || b.money - a.money)

  // ---------- 8. factory totals & KPIs ----------
  const factoryFc = new Array(AHEAD).fill(0).map((_, k) => sum(products.map(p => p.fc[k])))
  const factoryHist = new Array(HIST).fill(0).map((_, t) => sum(products.map(p => p.hist[t])))
  const err = sum(products.map(p => p.err)), errOld = sum(products.map(p => p.errOld)), tot = sum(products.map(p => p.tot))
  const acc = 1 - err / tot, accOld = 1 - errOld / tot
  const matsAtRisk = materials.filter(m => m.urgency === 'Urgent')
  const prodsAtRisk = products.filter(p => p.urgency === 'Urgent')
  const toSpend = sum(buys.filter(b => b.kind === 'buy' && b.urgency !== 'Watch').map(b => b.cost))
  const toFree = -sum(buys.filter(b => b.kind === 'cut' && !state.approvedIds[b.id]).map(b => b.cost))
  const stockValue = sum(materials.map(m => m.value))
  const fgValue = sum(products.map(p => p.onHand * p.price))

  const kpi = {
    thisWeek: factoryFc[0], lastWeek: factoryHist[HIST - 1], next12: sum(factoryFc), last12: sum(factoryHist.slice(HIST - 12)),
    acc, accOld, matsAtRisk: matsAtRisk.length, prodsAtRisk: prodsAtRisk.length, overWeeks: new Set(overloads.map(o => o.w)).size,
    toSpend, toFree, stockValue, fgValue, waiting: decisions.length,
    urgent: decisions.filter(d => d.urgency === 'Urgent').length, soon: decisions.filter(d => d.urgency === 'Soon').length,
    openChanges: changes.filter(c => c.status === 'open').length,
  }

  // ---------- 9. explanations for the ⓘ ----------
  const explain = {
    thisWeek: ex({ title: 'Expected sales this week', value: fmtT(kpi.thisWeek), means: 'How much steel customers are expected to buy from the factory this week, all products together.',
      formula: 'Sum of the forecast for every product, in every customer region', worked: `${products.length} products × 4 regions, added up = ${fmtT(kpi.thisWeek)}`,
      inputs: [{ k: 'Products', v: `${products.length}` }, { k: 'Last week (actual)', v: fmtT(kpi.lastWeek) }, { k: 'Method', v: 'Learns level, trend and season from 2 years of sales, plus market news' }] }),
    next12: ex({ title: 'Expected sales, next 12 weeks', value: fmtT(kpi.next12), means: 'Total steel customers are expected to buy over the next 12 weeks.',
      formula: 'Sum of the 12 weekly factory forecasts', worked: `${factoryFc.map(v => Math.round(v)).join(' + ')} = ${fmtT(kpi.next12)}`,
      inputs: [{ k: 'Last 12 weeks (actual)', v: fmtT(kpi.last12) }, { k: 'Change', v: fmtPct((kpi.next12 / kpi.last12 - 1) * 100, 1) }] }),
    accuracy: ex({ title: 'Forecast accuracy', value: `${(acc * 100).toFixed(1)}%`, means: 'How close the forecast was to real sales over the last 12 weeks.',
      formula: '100% − (total miss ÷ total sales)', worked: `100% − (${fmtT(err)} ÷ ${fmtT(tot)}) = ${(acc * 100).toFixed(1)}%`,
      inputs: [{ k: 'Total miss', v: fmtT(err) }, { k: 'Total sales', v: fmtT(tot) }, { k: 'Old way (12-week average)', v: `${(accOld * 100).toFixed(1)}%` }] }),
    matsAtRisk: ex({ title: 'Materials that will run out', value: `${matsAtRisk.length}`, means: 'Raw materials that will run out before a normal new order could arrive.',
      formula: 'Count of materials where: days until stock runs out < supplier delivery days', worked: matsAtRisk.length ? matsAtRisk.map(m => `${m.name}: ${Math.round(m.runOutDay)} d < ${m.lead} d`).join('; ') + ` → ${matsAtRisk.length}` : `None → 0`,
      inputs: materials.filter(m => m.urgency === 'Urgent' || m.urgency === 'Soon').map(m => ({ k: m.name, v: `lasts ${daysText(m.runOutDay ?? m.daysLeft)}, delivery ${m.lead} days` })) }),
    overWeeks: ex({ title: 'Weeks the factory is too busy', value: `${kpi.overWeeks}`, means: 'Weeks where planned production is more than a line can make.',
      formula: 'Count of weeks where planned tonnes > line capacity', worked: overloads.length ? overloads.map(o => `${o.line.name}, ${wk(HIST + o.w)}: ${fmtT(o.load)} > ${fmtT(o.cap)}`).join('; ') + ` → ${kpi.overWeeks}` : 'None → 0' }),
    toSpend: ex({ title: 'Money needed to buy', value: fmtINR(toSpend), means: 'Cost of the material orders due in the next week, waiting for approval.',
      formula: 'Sum of (quantity × today\'s price), +rush charge if late', worked: (buys.filter(b => b.kind === 'buy' && b.urgency !== 'Watch').map(b => `${b.mat.name} ${fmtINR(b.cost)}`).join(' + ') || 'Nothing waiting') + ` = ${fmtINR(toSpend)}` }),
    toFree: ex({ title: 'Cash that can be freed', value: fmtINR(toFree), means: 'Money tied up in materials we hold far too much of.',
      formula: '(stock − 45 days of use) × price, for materials above the limit', worked: (buys.filter(b => b.kind === 'cut' && !state.approvedIds[b.id]).map(b => `${b.mat.name} ${fmtINR(-b.cost)}`).join(' + ') || 'None') + ` = ${fmtINR(toFree)}` }),
    stockValue: ex({ title: 'Value of raw material stock', value: fmtINR(stockValue), means: 'Money sitting in the raw material store at current prices.',
      formula: 'Sum of (amount in stock × current price) for all 12 materials',
      worked: [...materials].sort((x, y) => y.value - x.value).slice(0, 4).map(m => `${m.name} ${fmtINR(m.value)}`).join(' + ') + ` + ${materials.length - 4} more = ${fmtINR(stockValue)}`,
      inputs: [{ k: 'Finished steel in stock', v: fmtINR(fgValue) }, { k: 'Both together', v: fmtINR(stockValue + fgValue) }] }),
    fgValue: ex({ title: 'Value of finished steel stock', value: fmtINR(fgValue), means: 'Money sitting in finished coil and sheet, at selling price.',
      formula: 'Sum of (tonnes in stock × price per tonne) for all 36 products',
      worked: `${fmtT(sum(products.map(p => p.onHand)))} across ${products.length} products = ${fmtINR(fgValue)}`,
      inputs: [{ k: 'Raw material stock', v: fmtINR(stockValue) }] }),
    waiting: ex({ title: 'Decisions waiting', value: `${decisions.length}`, means: 'Everything that needs a person to decide, now.',
      formula: 'Orders to place + products to make more of + sales changes + busy factory weeks + materials to buy less of',
      worked: ['Order', 'Make more', 'Sales change', 'Factory too busy', 'Buy less'].map(t => `${t} ${decisions.filter(x => x.type === t).length}`).join(' + ') + ` = ${decisions.length}`,
      inputs: [{ k: 'Urgent', v: `${kpi.urgent}` }, { k: 'Soon', v: `${kpi.soon}` }] }),
  }

  // ---------- 10. material prices ----------
  const priceWatch = materials.filter(m => m.index).map(m => {
    const s = data.prices[m.index], v = s.map(x => x.v), at = (k) => v[v.length - 1 - k]
    const c4 = (at(0) / at(4) - 1) * 100, c12 = (at(0) / at(12) - 1) * 100
    const notice = SIGNALS.find(x => x.materials && x.materials.includes(m.id) && x.kind === 'Price' && x.week >= HIST - 10)
    const move = notice && (notice.week >= HIST - 4 || Math.sign(notice.effect) === Math.sign(c12)) ? notice.effect * notice.conf : c4
    const dir = move >= 2 ? 'Rising' : move <= -2 ? 'Falling' : 'Steady'
    const perWeek = m.daily * 7 * m.priceNow * move / 100
    const grades = GRADES.filter(g => m.bom[g.id] > 0).map(g => ({ grade: g.id, perT: m.bom[g.id] * m.priceNow * move / 100 }))
    const advice = dir === 'Rising'
      ? (m.urgency === 'Urgent' || m.daysLeft < m.lead + 14 ? 'Rising, and stock is low. Order now at today\'s price.' : m.excess ? 'Rising, but you hold plenty. Don\'t buy extra.' : 'Rising. Fix the price for the next order with the supplier.')
      : dir === 'Falling' ? 'Falling. Buy only what is needed now; wait for a lower price.' : 'Steady. No change needed.'
    return { m, series: s, c4, c12, notice, move, dir, perWeek, grades, advice }
  }).sort((a, b) => (a.dir === 'Rising' ? 0 : 1) - (b.dir === 'Rising' ? 0 : 1) || b.perWeek - a.perWeek)

  return { products, prodById, materials, matById, changes, oneOffs: oneOffList, lines, overloads, buys, decisions, factoryFc, factoryHist, kpi, explain, priceWatch, z, allPos }
}

// ---------- a single week, for the Command Centre's week selector ----------
export function weekView(plan, k) {
  const total = plan.factoryFc[k]
  const prev = k === 0 ? plan.factoryHist[HIST - 1] : plan.factoryFc[k - 1]

  // Profit: what the steel sells for, less the raw materials in it at today's prices.
  // Week 0 is compared with what last week actually sold; later weeks with the week before.
  const sales = sum(plan.products.map(p => p.fc[k] * p.price))
  const matCost = sum(plan.products.map(p => p.fc[k] * p.matCost))
  const profit = sales - matCost
  const prevProfit = k === 0
    ? sum(plan.products.map(p => p.hist[HIST - 1] * p.marginPerT))
    : sum(plan.products.map(p => p.fc[k - 1] * p.marginPerT))
  const profitDelta = profit - prevProfit
  const profitPct = prevProfit ? (profitDelta / prevProfit) * 100 : 0
  const profitEx = {
    title: k === 0 ? 'Profit this week' : `Profit, week of ${wkRange(HIST + k)}`,
    value: fmtINR(profit),
    means: 'The money left after paying for the raw materials in the steel, before wages, power and other costs.',
    formula: 'For every product: forecast tonnes × (price per tonne − material cost per tonne), all added up',
    worked: `Sales ${fmtINR(sales)} − material cost ${fmtINR(matCost)} = ${fmtINR(profit)}`,
    inputs: [
      { k: k === 0 ? 'Last week (actual sales)' : 'The week before', v: fmtINR(prevProfit) },
      { k: 'Difference', v: `${profitDelta >= 0 ? '+' : '−'}${fmtINR(Math.abs(profitDelta))} (${fmtPct(profitPct, 1)})` },
      { k: 'Profit per tonne', v: `${fmtINR(profit / Math.max(0.01, total))} on ${fmtT(total)}` },
    ],
  }
  const top = [...plan.products].sort((a, b) => b.fc[k] - a.fc[k]).slice(0, 5)
  // compared with the same week last year, so the normal seasonal swing doesn't read as a change
  const movers = plan.products.filter(p => p.recent4 >= 2).map(p => { const ly = p.hist[HIST + k - 52]; return { p, ly, delta: p.fc[k] - ly, pct: (p.fc[k] / ly - 1) * 100 } })
  const up = movers.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4)
  const down = movers.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4)
  const from = k * 7 - TODAY_OFFSET, to = from + 6
  const mustOrder = plan.buys.filter(b => b.kind === 'buy' && (k === 0 ? b.orderByDay <= to : b.orderByDay >= from && b.orderByDay <= to))
  const ex = { title: `Expected sales, week of ${wkRange(HIST + k)}`, value: fmtT(total), means: 'Forecast sales for every product that week, added up.',
    formula: 'Sum of every product\'s forecast for the week', worked: `${plan.products.length} products added = ${fmtT(total)}; ${k === 0 ? 'last week actual' : 'week before'} ${fmtT(prev)} → ${fmtPct((total / prev - 1) * 100, 1)}`, inputs: [] }
  return { k, total, prev, change: (total / prev - 1) * 100, top, up, down, mustOrder, ex,
    profit, prevProfit, profitDelta, profitPct, profitEx, sales, profitMatCost: matCost }
}

// ---------- what-if for one product ----------
export function whatIf(plan, productId, pct) {
  const p = plan.prodById[productId]
  const extraWk = p.weekly * pct / 100
  const newWeekly = p.weekly + extraWk
  const newDays = p.onHand / Math.max(0.01, newWeekly / 7)
  const mats = plan.materials.filter(m => m.bom[p.grade] > 0).map(m => {
    const extra = extraWk * m.bom[p.grade]
    const daily = m.daily + extra / 7
    const days = m.onHand / Math.max(0.0001, daily)
    return { m, extra, cost: extra * m.priceNow, daysBefore: m.daysLeft, daysAfter: days, runsOutBeforeDelivery: days < m.lead }
  }).sort((a, b) => b.cost - a.cost)
  const coldLine = plan.lines.find(l => l.id === 'COLD')
  const maxCold = Math.max(...coldLine.weeks.map(w => w.pct + (p.cold ? extraWk / w.cap * 100 : 0)))
  return {
    p, pct, extraWk, newWeekly, newDays, daysBefore: p.daysLeft, mats, sales: extraWk * p.price, matCost: sum(mats.map(x => x.cost)),
    stockUrgent: newDays < p.L * 7, coldPeak: maxCold,
  }
}
