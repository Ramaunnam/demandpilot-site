// One factory site: its products, raw materials, production lines, customers,
// market news and two years of weekly sales. Mock data, generated the same way
// every time (fixed seed), so every number in the app is repeatable.

export const SITE = { name: 'Integrated Steelworks', short: 'Site 1', what: 'Stainless steel coil and sheet' }

export const HIST = 104                 // weeks of sales history; index 104 = this week
export const AHEAD = 12                 // weeks we plan ahead
const DAY0 = Date.UTC(2026, 9, 26)      // Monday of this week (26 Oct 2026)
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const dateOf = (w) => new Date(DAY0 + (w - HIST) * 7 * 864e5)
export const wk = (w) => { const d = dateOf(w); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` }
export const wkYear = (w) => { const d = dateOf(w); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
export const wkRange = (w) => {
  const a = dateOf(w), b = new Date(a.getTime() + 6 * 864e5)
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MON[b.getUTCMonth()]}`
    : `${a.getUTCDate()} ${MON[a.getUTCMonth()]} – ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`
}
export const dayLabel = (days) => { const d = new Date(DAY0 + 2 * 864e5 + days * 864e5); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` }
export const TODAY_OFFSET = 2           // today is Wednesday 28 Oct, 2 days into the week

// price is per tonne of hot-rolled coil, the base every other form is priced up from.
export const GRADES = [
  { id: '304', what: 'The general-purpose stainless steel', price: 340000, w: 0.42, trend: 0.04, amp: 0.10, phase: 0.3 },
  { id: '316L', what: 'Acid-proof, for pharma and food plants', price: 460000, w: 0.22, trend: 0.06, amp: 0.08, phase: 1.5 },
  { id: '430', what: 'No nickel, for home appliances', price: 190000, w: 0.20, trend: 0.01, amp: 0.15, phase: 2.6 },
  { id: '201', what: 'Lower cost, for furniture and coaches', price: 260000, w: 0.16, trend: 0.03, amp: 0.10, phase: 3.9 },
]
// adj is the price premium over the hot-rolled base: cold rolling and polishing are
// both extra passes through the mill, so they sell for more per tonne.
export const FORMS = [
  { id: 'CR', name: 'Cold-Rolled Coil', w: 0.50, adj: 1.12, makeWeeks: 2, cold: true },
  { id: 'HR', name: 'Hot-Rolled Coil', w: 0.30, adj: 1.00, makeWeeks: 1, cold: false },
  { id: 'SH', name: 'Polished Sheet', w: 0.20, adj: 1.22, makeWeeks: 2, cold: true },
]
// Three gauge tiers. `id` keeps the value it always had, so no product id ever changes;
// the millimetres shown come from the group below. Thinner gauge costs more to roll.
const THICK = [{ id: 0.5, w: 0.30, adj: 1.06 }, { id: 1, w: 0.42, adj: 1.00 }, { id: 2, w: 0.28, adj: 0.97 }]

// The 12 product groups this site sells — one per grade and form, and the single place
// a product's name, the gauges it is made in, and what customers use it for are written.
// Every screen reads the name from here, through the product list.
const GROUPS = {
  '304-CR': { name: 'Utensil Circles 304', sizes: ['0.5', '0.8', '1.0'], use: 'Pressure cookers, plates, bowls' },
  '304-HR': { name: 'Chequered Floor Plate 304', sizes: ['3', '5', '8'], use: 'Factory floors, ramps, stairs' },
  '304-SH': { name: 'Hairline Elevator Sheet 304', sizes: ['0.8', '1.2', '1.5'], use: 'Lift and escalator panels' },
  '316L-CR': { name: 'Pharma Tank Coil 316L', sizes: ['1.0', '2.0', '3.0'], use: 'Pharma and food-processing tanks' },
  '316L-HR': { name: 'Chemical Process Plate 316L', sizes: ['5', '8', '12'], use: 'Chemical reactors and vessels' },
  '316L-SH': { name: 'Mirror-Finish Dairy Sheet 316L', sizes: ['0.8', '1.2', '1.5'], use: 'Dairy and food plant equipment' },
  '430-CR': { name: 'Fridge Door Strip 430', sizes: ['0.4', '0.5', '0.6'], use: 'Fridge and washing-machine panels' },
  '430-HR': { name: 'Exhaust Tube Strip 430', sizes: ['1.0', '1.5', '2.0'], use: 'Car and bike exhaust pipes' },
  '430-SH': { name: 'Washing Machine Drum Sheet 430', sizes: ['0.5', '0.6', '0.8'], use: 'Washing-machine drums, gas stoves' },
  '201-CR': { name: 'Pipe & Tube Strip 201', sizes: ['0.8', '1.2', '1.6'], use: 'Furniture tubes, gates, handrails' },
  '201-HR': { name: 'Railway Wagon Plate 201', sizes: ['3', '4', '6'], use: 'Railway coach and wagon bodies' },
  '201-SH': { name: 'Perforated Decor Sheet 201', sizes: ['0.6', '0.8', '1.0'], use: 'Railings, ceilings, shop fronts' },
}
export const GROUP_NAMES = Object.values(GROUPS).map(g => g.name)
export const REGIONS = [
  { id: 'North', w: 0.28 }, { id: 'South', w: 0.24 }, { id: 'East', w: 0.18 }, { id: 'West', w: 0.30 },
]
export const REGION_IDS = REGIONS.map(r => r.id)
const WEEKLY_TONNES = 4500

// Raw materials: per tonne of finished steel, by grade.
export const MATERIALS = [
  { id: 'SCR', name: 'Stainless steel scrap', what: 'Main metal input, melted first', unit: 't', price: 142000, lead: 9, supplier: 'Metro Scrap Traders', lot: 50, safetyDays: 7, cover: 35, bom: { '304': 0.72, '316L': 0.66, '430': 0.80, '201': 0.75 } },
  { id: 'FECR', name: 'Ferrochrome', what: 'Adds chromium, makes steel rust-proof', unit: 't', price: 118000, lead: 21, supplier: 'Eastern Alloys', lot: 25, safetyDays: 10, cover: 65, index: 'ferrochrome', bom: { '304': 0.30, '316L': 0.28, '430': 0.27, '201': 0.25 } },
  { id: 'NI', name: 'Nickel', what: 'Makes steel tough and shiny (304, 316L, 201)', unit: 't', price: 1680000, lead: 35, supplier: 'Global Nickel Imports', lot: 2, safetyDays: 14, cover: 70, index: 'nickel', bom: { '304': 0.085, '316L': 0.105, '430': 0, '201': 0.045 } },
  { id: 'MO', name: 'Ferromolybdenum', what: 'Makes 316L acid-proof; only 316L uses it', unit: 't', price: 2450000, lead: 42, supplier: 'Specialty Alloys Ltd', lot: 1, safetyDays: 14, cover: 21, index: 'moly', bom: { '304': 0, '316L': 0.028, '430': 0, '201': 0 } },
  { id: 'MN', name: 'Ferromanganese', what: 'Replaces some nickel in 201', unit: 't', price: 96000, lead: 18, supplier: 'Eastern Alloys', lot: 10, safetyDays: 10, cover: 133, bom: { '304': 0.012, '316L': 0.012, '430': 0.010, '201': 0.065 } },
  { id: 'LIME', name: 'Burnt lime', what: 'Cleans impurities in the furnace', unit: 't', price: 9800, lead: 7, supplier: 'Deccan Minerals', lot: 20, safetyDays: 5, cover: 30, bom: { '304': 0.055, '316L': 0.055, '430': 0.05, '201': 0.055 } },
  { id: 'AR', name: 'Argon gas', what: 'Protects molten steel from air', unit: 'm³', price: 38, lead: 3, supplier: 'City Industrial Gases', lot: 5000, safetyDays: 3, cover: 14, bom: { '304': 12, '316L': 12, '430': 11, '201': 12 } },
  { id: 'HNO3', name: 'Nitric acid', what: 'Cleans the steel surface (pickling)', unit: 'L', price: 42, lead: 10, supplier: 'Chem Supplies Co', lot: 5000, safetyDays: 7, cover: 40, bom: { '304': 8, '316L': 9, '430': 7, '201': 8 } },
  { id: 'HF', name: 'Hydrofluoric acid', what: 'Strong cleaning acid (pickling)', unit: 'L', price: 96, lead: 14, supplier: 'Chem Supplies Co', lot: 2000, safetyDays: 7, cover: 45, bom: { '304': 3.5, '316L': 4, '430': 3, '201': 3.5 } },
  { id: 'OIL', name: 'Rolling oil', what: 'Lubricates the cold-rolling mill', unit: 'L', price: 185, lead: 12, supplier: 'Lubetech', lot: 1000, safetyDays: 7, cover: 50, bom: { '304': 2.4, '316L': 2.4, '430': 2.4, '201': 2.4 } },
  { id: 'SKID', name: 'Wooden skids', what: 'Pallets each coil is shipped on', unit: 'nos', price: 720, lead: 10, supplier: 'Packaging & Timber Co', lot: 200, safetyDays: 5, cover: 6, bom: { '304': 0.12, '316L': 0.12, '430': 0.12, '201': 0.12 } },
  { id: 'STRAP', name: 'Steel strapping', what: 'Holds coils on the skid', unit: 'kg', price: 108, lead: 7, supplier: 'Packaging & Timber Co', lot: 500, safetyDays: 5, cover: 35, bom: { '304': 2.2, '316L': 2.2, '430': 2.2, '201': 2.2 } },
]
export const matOf = (id) => MATERIALS.find(m => m.id === id)

// Production lines, in the order steel moves through the works.
export const LINES = [
  { id: 'MELT', name: 'Melting & casting', cap: 6200, all: true },
  { id: 'HOT', name: 'Hot rolling', cap: 6100, all: true },
  { id: 'COLD', name: 'Cold rolling', cap: 4500, all: false, maintenance: { week: HIST + 3, pct: 75 } },
  { id: 'ANNEAL', name: 'Annealing & pickling', cap: 4700, all: false },
  { id: 'FINISH', name: 'Finishing & packing', cap: 6100, all: true },
]

const CUSTOMER_TYPES = [
  { name: 'Pharma Plant Builder', grades: ['316L', '304'] },
  { name: 'Dairy Equipment Maker', grades: ['316L', '304'] },
  { name: 'Kitchenware Maker', grades: ['304', '201'] },
  { name: 'Building Contractor', grades: ['304', '201'] },
  { name: 'Appliance Maker', grades: ['430', '304'] },
  { name: 'Auto Parts Maker', grades: ['430', '304'] },
  { name: 'Railway Coach Builder', grades: ['201', '304'] },
  { name: 'Furniture Maker', grades: ['201', '430'] },
  { name: 'Chemical Tank Maker', grades: ['316L', '304'] },
]

// Market news the planner sees. week = when it was published.
export const SIGNALS = [
  { id: 'N1', week: HIST - 7, kind: 'Industry news', title: 'New pharma and food-processing plants announced in the South', grades: ['316L'], regions: ['South'], effect: 30, conf: 0.9 },
  { id: 'N2', week: HIST - 6, kind: 'Customer notice', title: 'Two South pharma customers raised their 3-month order outlook', grades: ['316L'], regions: ['South'], effect: 20, conf: 0.85 },
  { id: 'N3', week: HIST - 6, kind: 'Industry news', title: 'A competitor opened a steel service centre in the West', grades: ['304'], regions: ['West'], effect: -15, conf: 0.8 },
  { id: 'N4', week: HIST - 10, kind: 'Industry news', title: 'Appliance makers expect a strong festive season', grades: ['430'], regions: [], effect: 8, conf: 0.7 },
  { id: 'N5', week: HIST - 3, kind: 'Industry news', title: 'Railway coach orders expected in the East', grades: ['201'], regions: ['East'], effect: 10, conf: 0.65 },
  { id: 'P1', week: HIST - 9, kind: 'Price', title: 'Nickel price up 6% in a month', materials: ['NI'], effect: 6, conf: 0.93 },
  { id: 'P2', week: HIST - 1, kind: 'Price', title: 'Molybdenum price up 9% in six weeks', materials: ['MO'], effect: 9, conf: 0.95 },
  { id: 'P3', week: HIST - 8, kind: 'Price', title: 'Ferrochrome price down 5% on weak demand', materials: ['FECR'], effect: -5, conf: 0.9 },
  { id: 'S1', week: HIST - 4, kind: 'Supplier notice', title: 'Imported alloy shipments delayed about 2 weeks at the port', materials: ['MO', 'NI'], effect: 0, conf: 0.8 },
  { id: 'S2', week: HIST - 5, kind: 'Supplier notice', title: 'Timber supplier warns of monsoon delays on wooden skids', materials: ['SKID'], effect: 0, conf: 0.75 },
]

// Planted changes in sales (what the app should find).
const SHIFTS = [
  { grade: '316L', region: 'South', from: HIST - 6, x: 1.40 },             // explained by N1, N2
  { grade: '304', form: 'SH', region: 'West', from: HIST - 5, x: 0.70 },    // explained by N3
  { grade: '201', form: 'HR', region: 'North', from: HIST - 4, x: 1.35 },   // no known reason
]
const ONE_OFFS = [
  { sku: '430-CR-1', region: 'East', week: HIST - 3, x: 2.0 },   // one big order
  { sku: '304-CR-2', region: 'North', week: HIST - 8, x: 1.9 },
  { sku: '201-SH-1', region: 'South', week: HIST - 2, x: 0.4 },  // customer paused
]

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export function buildData() {
  const r = rng(20261026)
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

  const products = []
  for (const g of GRADES) for (const f of FORMS) for (const [tier, th] of THICK.entries()) {
    const grp = GROUPS[`${g.id}-${f.id}`]
    const size = grp.sizes[tier]
    products.push({
      id: `${g.id}-${f.id}-${th.id}`,
      name: `${grp.name}, ${size} mm`,        // the one product name every screen shows
      family: grp.name, familyId: `${g.id}-${f.id}`,
      grade: g.id, form: f.id, formName: f.name, tier, size, thickness: Number(size),
      use: grp.use,
      price: Math.round(g.price * f.adj * th.adj / 100) * 100,
      makeWeeks: f.makeWeeks, cold: f.cold, share: g.w * f.w * th.w,
    })
  }

  // weekly sales by product × region
  const sales = {}
  for (const p of products) {
    const g = GRADES.find(x => x.id === p.grade)
    for (const reg of REGIONS) {
      const base = WEEKLY_TONNES * p.share * reg.w
      const phase = g.phase + (r() - 0.5) * 0.4
      const y = new Array(HIST)
      for (let t = 0; t < HIST; t++) {
        let v = base * (1 + g.trend * t / 52) * (1 + g.amp * Math.sin(2 * Math.PI * t / 52 + phase))
        for (const s of SHIFTS) {
          if (s.grade === p.grade && s.region === reg.id && (!s.form || s.form === p.form) && t >= s.from) {
            v *= t === s.from ? 1 + (s.x - 1) / 2 : s.x
          }
        }
        v *= 1 + 0.06 * gauss()
        y[t] = Math.max(0.1, Math.round(v * 10) / 10)
      }
      for (const o of ONE_OFFS) if (o.sku === p.id && o.region === reg.id) y[o.week] = Math.round(y[o.week] * o.x * 10) / 10
      sales[`${p.id}|${reg.id}`] = y
    }
  }

  // customers: each region has a mix of buyers
  const customers = []
  let ci = 0
  for (const reg of REGIONS) for (const ct of CUSTOMER_TYPES) {
    if (r() < 0.25) continue
    ci++
    customers.push({ id: `C${ci}`, name: `${ct.name} (${reg.id})`, type: ct.name, region: reg.id, grades: ct.grades })
  }

  // customer orders: past 8 weeks (from actual sales) and the next 4 weeks (booked part of the forecast)
  const orders = []
  let oi = 0
  const oneOffKey = new Set(ONE_OFFS.map(o => `${o.sku}|${o.region}|${o.week}`))
  for (const p of products) for (const reg of REGIONS) {
    const y = sales[`${p.id}|${reg.id}`]
    const buyers = customers.filter(c => c.region === reg.id && c.grades.includes(p.grade))
    if (!buyers.length) continue
    for (let w = HIST - 8; w < HIST + 4; w++) {
      const recent = (y[HIST - 1] + y[HIST - 2] + y[HIST - 3] + y[HIST - 4]) / 4
      const qty = w < HIST ? y[w] : recent * [0.85, 0.6, 0.35, 0.15][w - HIST]
      if (qty < 0.3) continue
      const big = oneOffKey.has(`${p.id}|${reg.id}|${w}`)
      const parts = big ? [1] : qty > 6 ? [0.55, 0.45] : [1]
      parts.forEach((share, k) => {
        const c = big ? buyers[0] : buyers[Math.floor(r() * buyers.length)]
        const q = Math.round(qty * share * 10) / 10
        oi++
        orders.push({
          id: `SO-${10400 + oi}`, customerId: c.id, customer: c.name, productId: p.id, region: reg.id,
          qty: q, price: p.price, value: Math.round(q * p.price), week: w,
          status: w < HIST - 2 ? 'Delivered' : w < HIST ? 'Dispatched' : w === HIST ? 'In production' : 'Confirmed',
        })
      })
    }
  }

  // material price indices, weekly, last 26 weeks (100 = 26 weeks ago)
  const prices = { nickel: [], moly: [], ferrochrome: [] }
  for (let i = 0; i < 26; i++) {
    const w = HIST - 26 + i
    prices.nickel.push({ week: w, v: +(100 + (i > 10 ? (i - 10) * 0.55 : 0) + Math.sin(i) * 0.4).toFixed(1) })
    prices.moly.push({ week: w, v: +(100 + Math.sin(i / 2) * 0.8 + (i >= 20 ? (i - 19) * 1.5 : 0)).toFixed(1) })
    prices.ferrochrome.push({ week: w, v: +(100 - (i > 14 ? (i - 14) * 0.45 : 0) + Math.cos(i) * 0.3).toFixed(1) })
  }

  // purchase orders already placed
  const pos = [
    { id: 'PO-26-3311', mat: 'SCR', qty: 1300, placedDay: -12, dueDay: 4, status: 'In transit' },
    { id: 'PO-26-3315', mat: 'NI', qty: 40, placedDay: -20, dueDay: 18, status: 'Confirmed' },
    { id: 'PO-26-3320', mat: 'LIME', qty: 260, placedDay: -4, dueDay: 3, status: 'In transit' },
    { id: 'PO-26-3322', mat: 'AR', qty: 160000, placedDay: -2, dueDay: 1, status: 'In transit' },
    { id: 'PO-26-3324', mat: 'OIL', qty: 8000, placedDay: -6, dueDay: 6, status: 'Confirmed' },
    { id: 'PO-26-3326', mat: 'MO', qty: 30, placedDay: -10, dueDay: 32, status: 'Confirmed' },
  ]

  return { products, sales, customers, orders, prices, pos }
}

// The systems this site's data comes from. `at` is when each last synced today,
// `uses` the screens it feeds, `open` the screen its Open button goes to.
export const SYSTEMS = [
  {
    id: 'SAP', name: 'SAP S/4HANA', kind: 'ERP',
    gives: 'Customer orders, sales history, finished stock, purchase orders',
    uses: [['forecast', 'Forecast'], ['orders', 'Orders'], ['products', 'Products']],
    every: 'Every 15 min', at: '11:52', records: 182450, status: 'Live', open: 'orders',
  },
  {
    id: 'MES', name: 'Plant MES', kind: 'Manufacturing execution',
    gives: 'What each line made, line capacity, maintenance windows',
    uses: [['plan', 'Plan & MRP']],
    every: 'Every 5 min', at: '11:50', records: 41280, status: 'Recovered', open: 'plan',
    note: 'One sync at 11:48 timed out (plant network busy). It retried by itself at 11:50 and worked. No data lost.',
  },
  {
    id: 'WMS', name: 'Warehouse system', kind: 'WMS',
    gives: 'Raw material stock',
    uses: [['materials', 'Materials & stock']],
    every: 'Every 15 min', at: '11:45', records: 9640, status: 'Live', open: 'materials',
  },
  {
    id: 'SUP', name: 'Supplier portal', kind: 'Supplier EDI',
    gives: 'Order confirmations, delivery dates, supplier notices',
    uses: [['buy', 'Buy'], ['orders', 'Orders'], ['changes', 'What changed']],
    every: 'Every hour', at: '11:00', records: 1870, status: 'Live', open: 'buy',
  },
  {
    id: 'CRM', name: 'Salesforce CRM', kind: 'CRM',
    gives: 'Customer outlooks from the sales team',
    uses: [['changes', 'What changed'], ['forecast', 'Forecast']],
    every: 'Every hour', at: '11:05', records: 640, status: 'Live', open: 'changes',
  },
  {
    id: 'LME', name: 'Metal price feed', kind: 'LME',
    gives: 'Nickel, molybdenum and ferrochrome prices',
    uses: [['materials', 'Materials & stock'], ['buy', 'Buy']],
    every: 'Daily 9:00', at: '09:00', records: 78, status: 'Live', open: 'materials',
  },
  {
    id: 'NEWS', name: 'Industry news feed', kind: 'News',
    gives: 'News on the industries our customers are in',
    uses: [['changes', 'What changed'], ['forecast', 'Forecast']],
    every: 'Every 6 hours', at: '06:00', records: 310, status: 'Live', open: 'changes',
  },
]

// How the data turns into a decision, in five plain steps.
export const FLOW = [
  { t: 'Collect', s: 'Every system above is read on its own schedule and landed as it is.' },
  { t: 'Clean', s: 'Units, product codes and customer names are matched to one common list.' },
  { t: 'Forecast', s: 'Two years of weekly sales become a 12-week forecast per product and region.' },
  { t: 'Plan', s: 'The forecast becomes a production plan, then the materials needed to run it.' },
  { t: 'Decide', s: 'Shortages and changes are ranked so a planner can act on them today.' },
]
