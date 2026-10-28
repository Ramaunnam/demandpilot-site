// Everything scripts/check.mjs needs, in one bundle it can import from node.
export { Ctx } from '../src/ui.jsx'
export { default as App } from '../src/App.jsx'
export { buildData, SYSTEMS, FLOW } from '../src/data.js'
export { computePlan, DEFAULT_SETTINGS, weekView, whatIf, fmtINR, fmtQty, sum } from '../src/engine.js'

import Command from '../src/pages/Command.jsx'
import Decisions from '../src/pages/Decisions.jsx'
import Changes from '../src/pages/Changes.jsx'
import Forecast from '../src/pages/Forecast.jsx'
import Products from '../src/pages/Products.jsx'
import Product from '../src/pages/Product.jsx'
import Materials from '../src/pages/Materials.jsx'
import Material from '../src/pages/Material.jsx'
import Plan from '../src/pages/Plan.jsx'
import Buy from '../src/pages/Buy.jsx'
import Orders from '../src/pages/Orders.jsx'
import Simulate from '../src/pages/Simulate.jsx'
import Method from '../src/pages/Method.jsx'
import Systems from '../src/pages/Systems.jsx'

export const PAGES = {
  command: Command, decisions: Decisions, changes: Changes, forecast: Forecast, products: Products, product: Product,
  materials: Materials, material: Material, plan: Plan, buy: Buy, orders: Orders, simulate: Simulate, method: Method, systems: Systems,
}
