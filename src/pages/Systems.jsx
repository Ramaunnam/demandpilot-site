import React, { useEffect, useState } from 'react'
import { SYSTEMS, FLOW, HIST } from '../data.js'
import { fmtNum } from '../engine.js'
import { useApp, Head, Card, Tile, Pill, Icon } from '../ui.jsx'

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

export default function Systems() {
  const { state, act, go } = useApp()
  const [, tick] = useState(0)

  // keep the "x min ago" column honest without the page being reloaded
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const sync = state.sync ?? {}
  const rows = SYSTEMS.map(s => {
    const o = sync[s.id]
    return { ...s, lastSync: o?.at ?? todayAt(s.at), status: o?.status ?? s.status, synced: !!o }
  })
  const live = rows.filter(r => r.status === 'Live').length
  const recovered = rows.filter(r => r.status === 'Recovered').length
  const lastFull = Math.max(...rows.map(r => r.lastSync))
  const records = rows.reduce((a, r) => a + r.records, 0)

  return (
    <>
      <Head title="Connected systems"
        sub="Where every number in DemandPilot comes from. Nothing here is typed in by hand."
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
                    <button className="btn sm" onClick={() => act.syncSystem(r)}>Sync now</button>
                    <button className="btn sm ghost" onClick={() => go(r.open)}>Open</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
        This is a demo: the systems above are not really connected. “Sync now” only moves the last-sync
        time so the screen can be seen working. No system is contacted and no data leaves this browser.
      </p>
    </>
  )
}
