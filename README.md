# DemandPilot — one-site demand planning (mock POC)

Integrated Steelworks, Site 1: **36 stainless steel products, 12 raw materials, 5 production lines,
4 customer regions.** Two years of weekly sales go in; a 12-week forecast, a production plan, a
material-buying list and a ranked set of decisions come out — and every headline number has an **ⓘ**
that rebuilds it from the same inputs the screen used.

All data is generated from a fixed seed, so the same figures appear every time and any number can be
checked twice. Nothing is sent anywhere.

## Run

    npm install
    npm run dev        # open the link it prints, usually http://localhost:5173

    npm run build      # production build into dist/
    npm run preview    # serve that build
    npm run check      # render every screen and verify the numbers (no browser needed)

## Screens

| | |
|---|---|
| **Command Centre** | What needs doing today, plus demand, profit, supply risk and cash for any of the next 12 weeks |
| **Decisions** | Every open decision, ranked by deadline and money at stake |
| **What changed** | Changes in our own sales, and news from the market that may explain them |
| **Forecast** | All products, a product group, or one product, with its likely range |
| **Products** → product | Sales, stock cover, production plan, recipe, customers, orders |
| **Materials & stock** → material | Stock, the MRP worksheet week by week, price trend, where it is used |
| **Plan & MRP** | The five steps from forecast to purchase order, each one openable |
| **Buy** | Suggested orders — approve, change the quantity, or reject |
| **Orders** | Customer orders for our steel, and our purchase orders for materials |
| **What if** | Move a product's sales and see stock, materials, the factory and the money move |
| **How it works** | The whole calculation in order, with today's numbers in it |
| **Connected systems** | The 7 systems the data comes from, what each feeds, and when it last synced |

## How it is put together

    src/data.js     the site: products, materials, lines, customers, market news, 104 weeks of sales
    src/engine.js   every calculation, in one place
    src/pages/*     one file per screen
    src/charts.jsx  the charts (hand-drawn SVG, no chart library)
    src/ui.jsx      tiles, cards, pills, the ⓘ popover, the settings drawer
    scripts/check.mjs  the verification suite
    scripts/peek.mjs   print any screen as plain text (node scripts/peek.mjs systems)

`engine.js` runs in two passes. **Pass A** reads only the sales history and finds what changed; it is
cached, because no decision a planner takes can alter what the raw sales already did. **Pass B** is
everything that follows from a decision — forecast, stock, make plan, MRP, buying list, decisions —
and it reuses every per-product forecast whose inputs did not change. A click therefore recalculates
the whole plan in about **5 ms** rather than 30.

## What the planner can change

The settings drawer (gear icon, top right) holds four rules, and each one visibly moves the numbers:
**service level** (safety stock), **sales-change threshold** (what gets reported), **rush delivery
charge** (cost of a late order) and the **too-much-stock limit** (what gets flagged to free cash).
Decisions are kept in the browser so a session can be picked up again; **Reset** clears them.

Keyboard: `/` or `Ctrl-K` to search, arrows and `Enter` to open a result, `Esc` to close.

## Checking it

`npm run check` renders all 74 routes to HTML with `react-dom/server` and then verifies that:

- no screen throws, and none shows `NaN`, `Infinity` or `undefined` — including at every setting extreme,
  after every order has been approved, and with the decision list fully empty
- the factory forecast equals the sum of its 36 products, week by week
- every forecast sits inside its own likely range, and safety ≤ reorder ≤ target
- every product's stock projection balances week to week
- every material's MRP rows balance, lot sizes are respected, and **no order is planned earlier than
  its delivery time allows**
- every decision links to a screen that exists and carries a reason
- the three sales changes and three one-off weeks planted in the generated history are all found
- approving everything actually clears the list
- every product name reads grade + product + finish + thickness, carries what it is used for, and
  earns more per tonne than its raw materials cost
- the Profit box equals sales minus material cost for all 12 weeks, and matches its own ⓘ
- all 7 connected systems point at screens that exist, and the data-flow strip has its 5 steps
