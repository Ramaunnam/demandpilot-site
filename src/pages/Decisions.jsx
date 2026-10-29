import React, { useState } from 'react'
import { fmtINR, sum } from '../engine.js'
import { fmtWhen } from '../data.js'
import { useApp, Head, Tile, Card, Seg, DecisionRow, Empty, Icon, useViewState } from '../ui.jsx'

const TYPES = ['All', 'Order', 'Make more', 'Sales change', 'Factory too busy', 'Buy less']

export default function Decisions() {
  const { plan, state, go, act } = useApp()
  const [urg, setUrg] = useViewState('decisions.urgency', 'All')
  const [type, setType] = useViewState('decisions.type', 'All')
  const [sort, setSort] = useViewState('decisions.sort', 'deadline')
  const all = plan.decisions
  let list = all.filter(d => (urg === 'All' || d.urgency === urg) && (type === 'All' || d.type === type))
  if (sort === 'money') list = [...list].sort((a, b) => b.money - a.money)
  const urgent = all.filter(d => d.urgency === 'Urgent')
  const money = sum(all.map(d => d.money))
  const ex = {
    waiting: { title: 'Decisions waiting', value: `${all.length}`, means: 'Everything that needs a person to decide.', formula: 'Count of open items: orders to place, products to make more of, sales changes, busy factory weeks, materials to buy less of',
      worked: TYPES.slice(1).map(t => `${t}: ${all.filter(d => d.type === t).length}`).join(' + ') + ` = ${all.length}` },
    urgent: { title: 'Urgent', value: `${urgent.length}`, means: 'Things that will cause a shortage unless acted on today.', formula: 'Count of items where stock runs out before new supply can arrive',
      worked: (urgent.map(d => d.name).join(', ') || 'None') + ` → ${urgent.length}` },
    money: { title: 'Money involved', value: fmtINR(money), means: 'Total value of all waiting decisions (orders to buy, extra production, sales at stake).', formula: 'Sum of the money on every waiting item',
      worked: all.filter(d => d.money > 0).map(d => fmtINR(d.money)).join(' + ') + ` = ${fmtINR(money)}` },
  }

  return (
    <>
      <Head title="Decisions" sub="Everything waiting on a decision, ranked by how soon it must be made, with the reason for each product or material." />
      <div className="grid g3">
        <Tile k="Waiting" v={`${all.length}`} e={ex.waiting} d={`${state.log.length} done this session`} onClick={() => { setUrg('All'); setType('All') }} />
        <Tile k="Urgent" v={`${urgent.length}`} tone={urgent.length ? 'red' : 'green'} e={ex.urgent} d="act today" onClick={() => setUrg('Urgent')} />
        <Tile k="Money involved" v={fmtINR(money)} e={ex.money} d="across all waiting items" onClick={() => setSort('money')} />
      </div>
      <div className="row between">
        <div className="filters">
          <Seg value={urg} onChange={setUrg} options={['All', 'Urgent', 'Soon', 'Watch', 'Info'].map(u => ({ v: u, l: u, c: u === 'All' ? all.length : all.filter(d => d.urgency === u).length }))} />
          <label htmlFor="d-type">Type</label>
          <select id="d-type" className="sel" value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="filters"><label>Sort by</label><Seg value={sort} onChange={setSort} options={[{ v: 'deadline', l: 'Deadline' }, { v: 'money', l: 'Money' }]} /></div>
      </div>
      {list.length ? <div className="dlist">{list.map(d => <DecisionRow key={d.id} d={d} />)}</div>
        : all.length ? <Empty>Nothing waiting in this view. <button className="link" onClick={() => { setUrg('All'); setType('All') }}>Show all {all.length}</button></Empty>
          : <div className="alert calm"><Icon name="check" /><span className="msg"><b>Everything is decided.</b> {state.log.length} action{state.log.length === 1 ? '' : 's'} taken this session — orders placed, production planned and sales changes answered.</span><button className="btn sm" onClick={() => go('command')}>Command Centre</button></div>}
      <p className="note">Urgent: stock runs out before new supply can arrive. · Soon: act within a week. · Watch: sales changed, decide this week. · Info: nothing at risk.</p>
      {(state.activity ?? []).length > 0 && (
        <Card title="What you did" sub="Every action this session, where it ended up, and how to put it back." pad={false}>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>
              <th scope="col">Time</th><th scope="col">Action</th><th scope="col">What</th><th scope="col"></th>
            </tr></thead>
            <tbody>
              {state.activity.map(e => (
                <tr key={e.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{e.when ? fmtWhen(e.when) : e.at}</td>
                  <td><span className="tag">{e.kind}</span></td>
                  <td className="nm">{e.what}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      {e.link && <button className="btn sm" onClick={() => go(e.link.page, e.link.id)}>{e.linkLabel ?? 'Open'}</button>}
                      {e.undo && <button className="btn sm ghost" onClick={() => act.undo(e)}>Undo</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

    </>
  )
}
