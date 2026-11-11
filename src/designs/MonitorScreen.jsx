// THE MONITOR — presentation only. Everything arrives as props:
//   c        useMonitorServices: the list, the selected one, actions, add/edit, audit
//   logs     useServiceLogs: the selected service's log
//   session  useMonitorSession: who is signed in, sign out, what may be added
//
// Left, the watched services with their state; right, the selected one: what
// systemd says about it, Start / Stop / Restart / Kill, and its log, live or
// from a time range.
import { useEffect, useRef } from 'react'
import { stateOf, bytes, ago, clock, resultText } from '../monitorFormat.js'
import './monitor.css'

export function MonitorScreen({ c, logs, session, title = 'Xeplr Monitor' }) {
  return (
    <div className="xeplr-monitor">
      <header className="xeplr-monitor-top">
        <b className="xeplr-monitor-brand">{title}</b>
        <nav className="xeplr-monitor-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={c.view === 'services'} onClick={c.showServices}>Services</button>
          <button type="button" role="tab" aria-selected={c.view === 'audit'} onClick={c.showAudit}>Audit log</button>
        </nav>
        <span className="xeplr-monitor-grow" />
        <span className="xeplr-monitor-muted">{session.user ? session.user.email : ''}</span>
        <button type="button" className="xeplr-monitor-link" onClick={session.signOut}>Sign out</button>
      </header>
      {c.message ? <div className={'xeplr-monitor-banner is-' + c.message.tone} role="status"><span>{c.message.text}</span><button type="button" className="xeplr-monitor-link" onClick={c.clearMessage} aria-label="Dismiss">✕</button></div> : null}
      {c.view === 'audit' ? <AuditView c={c} /> : (
        <div className="xeplr-monitor-body">
          <ServiceList c={c} session={session} />
          <main className="xeplr-monitor-main">
            {c.selected ? <ServiceDetail c={c} s={c.selected} logs={logs} /> : (
              <div className="xeplr-monitor-empty">
                <p>{c.loading ? 'Loading…' : c.list && c.list.length ? 'Choose a service on the left.' : 'No services yet. Add one: the name of its systemd service, e.g. xeplr-bi-api.'}</p>
              </div>
            )}
          </main>
        </div>
      )}
      {c.adding ? <AddWindow c={c} session={session} /> : null}
      {c.editing ? <EditWindow c={c} /> : null}
    </div>
  )
}

function Dot({ tone }) { return <span className={'xeplr-monitor-dot is-' + tone} aria-hidden="true" /> }

function ServiceList({ c, session }) {
  return (
    <aside className="xeplr-monitor-side">
      <div className="xeplr-monitor-side-head">
        <b>Services</b>
        <button type="button" id="xeplr-monitor-add" onClick={c.openAdd}>+ Add a service</button>
      </div>
      {c.loadError ? <p className="xeplr-monitor-bad">{c.loadError}</p> : null}
      <ul id="xeplr-monitor-services" className="xeplr-monitor-list" aria-label="Services">
        {(c.list || []).map((s) => {
          const st = stateOf(s.status)
          return (
            <li key={s.unit}>
              <button type="button" className={'xeplr-monitor-item' + (c.selectedUnit === s.unit ? ' is-on' : '')} aria-current={c.selectedUnit === s.unit} onClick={() => c.select(s.unit)}>
                <span className="xeplr-monitor-item-top"><Dot tone={st.tone} /><b>{s.label}</b>{c.busy[s.unit] ? <span className="xeplr-monitor-muted"> · {c.busy[s.unit]}…</span> : null}</span>
                <span className="xeplr-monitor-item-sub">{st.text}{s.status && s.status.since ? ' · ' + ago(s.status.since) : ''}{s.status && s.status.memoryBytes ? ' · ' + bytes(s.status.memoryBytes) : ''}</span>
                {s.statusError ? <span className="xeplr-monitor-bad">{s.statusError}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      {session.allowed.length ? <p className="xeplr-monitor-muted xeplr-monitor-small">This monitor may control: {session.allowed.join(', ')}</p> : null}
    </aside>
  )
}

function ServiceDetail({ c, s, logs }) {
  const st = stateOf(s.status)
  const t = s.status || {}
  const can = c.actionsFor(s)
  const busy = c.busy[s.unit]
  const facts = [
    ['State', t.subState ? st.text + ' (' + t.state + ' / ' + t.subState + ')' : st.text],
    [t.state === 'active' ? 'Running for' : 'Stopped for', ago(t.since)],
    ['Process', t.pid || '—'],
    ['Memory', bytes(t.memoryBytes)],
    ['CPU used', t.cpuSeconds === null || t.cpuSeconds === undefined ? '—' : t.cpuSeconds + ' s'],
    ['Restarts', t.restarts === null || t.restarts === undefined ? '—' : t.restarts],
    ['Last ended', t.result && t.result !== 'success' ? resultText(t.result) + (t.exitStatus ? ' (exit ' + t.exitStatus + ')' : '') : 'normally'],
    ['Restarts by itself', t.restartPolicy && t.restartPolicy !== 'no' ? 'yes (' + t.restartPolicy + ')' : 'no'],
    ['At boot', t.enabled || '—']
  ]
  return (
    <>
      <section className="xeplr-monitor-card">
        <div className="xeplr-monitor-head">
          <div className="xeplr-monitor-grow">
            <h1 className="xeplr-monitor-h1"><Dot tone={st.tone} />{s.label}</h1>
            <span className="xeplr-monitor-muted">{s.unit}{t.description ? ' · ' + t.description : ''}</span>
          </div>
          <div className="xeplr-monitor-actions">
            <button type="button" data-xeplr-action="start" disabled={!can.start || Boolean(busy)} onClick={() => c.ask(s.unit, 'start')}>Start</button>
            <button type="button" data-xeplr-action="restart" disabled={!can.restart || Boolean(busy)} onClick={() => c.ask(s.unit, 'restart')}>{busy === 'restart' ? 'Restarting…' : 'Restart'}</button>
            <button type="button" data-xeplr-action="stop" disabled={!can.stop || Boolean(busy)} onClick={() => c.ask(s.unit, 'stop')} title={can.own ? 'This is the monitor itself' : ''}>Stop</button>
            <button type="button" data-xeplr-action="kill" className="is-danger" disabled={!can.kill || Boolean(busy)} onClick={() => c.ask(s.unit, 'kill')} title={can.own ? 'This is the monitor itself' : 'Ends every process of it at once'}>Kill</button>
            <button type="button" className="xeplr-monitor-link" onClick={() => c.openEdit(s)}>Edit</button>
          </div>
        </div>
        {c.confirm && c.confirm.unit === s.unit ? (
          <div className="xeplr-monitor-confirm" role="alertdialog" aria-label="Are you sure?">
            <span className="xeplr-monitor-grow">{c.confirm.text}</span>
            <button type="button" onClick={c.confirmNo}>Cancel</button>
            <button type="button" className={c.confirm.action === 'kill' ? 'xeplr-monitor-primary is-danger' : 'xeplr-monitor-primary'} data-xeplr-confirm="yes" onClick={c.confirmYes}>Yes, {c.confirm.action}</button>
          </div>
        ) : null}
        <dl className="xeplr-monitor-facts">{facts.map((f) => <div key={f[0]} className="xeplr-monitor-fact"><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl>
      </section>
      <LogPanel logs={logs} />
    </>
  )
}

function LogPanel({ logs }) {
  const box = useRef(null)
  const stick = useRef(true)
  // Kept at the newest line while you are at the bottom; scrolled up, it stays where you are.
  useEffect(() => { if (box.current && stick.current) box.current.scrollTop = box.current.scrollHeight }, [logs.lines])
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40 }
  const live = logs.mode === 'live'
  return (
    <section className="xeplr-monitor-card xeplr-monitor-logcard">
      <div className="xeplr-monitor-logbar">
        <div className="xeplr-monitor-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={live} onClick={() => logs.setMode('live')}>Live</button>
          <button type="button" role="tab" aria-selected={!live} onClick={() => logs.setMode('history')}>History</button>
        </div>
        <input type="search" aria-label="Search the log" placeholder="Search…" value={logs.grep} onChange={(e) => logs.setGrep(e.target.value)} />
        <select aria-label="Level" value={logs.level} onChange={(e) => logs.setLevel(e.target.value)}>
          <option value="">Every line</option>
          <option value="warn">Warnings and errors</option>
          <option value="error">Errors only</option>
        </select>
        <span className="xeplr-monitor-grow" />
        <LogState logs={logs} />
        {live ? (logs.paused
          ? <button type="button" onClick={logs.resume}>Resume{logs.held ? ' (' + logs.held + ' new)' : ''}</button>
          : <button type="button" onClick={logs.pause}>Pause</button>) : null}
        <button type="button" className="xeplr-monitor-link" onClick={logs.clear}>Clear</button>
      </div>
      {!live ? (
        <form className="xeplr-monitor-range" onSubmit={(e) => { e.preventDefault(); logs.readHistory() }}>
          <label>From <input type="datetime-local" value={logs.range.since} onChange={(e) => logs.setRange({ since: e.target.value })} /></label>
          <label>To <input type="datetime-local" value={logs.range.until} onChange={(e) => logs.setRange({ until: e.target.value })} /></label>
          <label>At most <input type="number" min="1" max="5000" value={logs.range.lines} onChange={(e) => logs.setRange({ lines: e.target.value })} /> lines</label>
          <button type="submit" className="xeplr-monitor-primary">Read</button>
        </form>
      ) : null}
      {logs.error ? <p className="xeplr-monitor-bad">{logs.error}</p> : null}
      <div id="xeplr-monitor-log" className="xeplr-monitor-log" ref={box} onScroll={onScroll} role="log" aria-live="off">
        {logs.lines.length ? logs.lines.map((l, i) => (
          <div key={(l.cursor || '') + i} className={'xeplr-monitor-line is-' + l.level}>
            <span className="xeplr-monitor-line-at">{clock(l.at)}</span>
            <span className="xeplr-monitor-line-msg">{l.message}</span>
          </div>
        )) : <p className="xeplr-monitor-muted">{logs.state === 'loading' ? 'Reading…' : logs.total ? 'No line matches.' : live ? 'Nothing yet. New lines appear here as they are written.' : 'No lines in that range.'}</p>}
      </div>
      <p className="xeplr-monitor-muted xeplr-monitor-small">{logs.lines.length === logs.total ? logs.total + ' lines' : logs.lines.length + ' of ' + logs.total + ' lines match'}{live ? ' · the newest 5,000 are kept here' : ''}</p>
    </section>
  )
}

function LogState({ logs }) {
  if (logs.mode !== 'live') return null
  if (logs.state === 'live') return <span className="xeplr-monitor-pill is-good"><Dot tone="good" />Live</span>
  if (logs.state === 'reconnecting') return <span className="xeplr-monitor-pill is-busy">Reconnecting…</span>
  if (logs.state === 'loading') return <span className="xeplr-monitor-pill">Opening…</span>
  if (logs.state === 'error') return <span className="xeplr-monitor-pill is-bad">Stopped</span>
  return null
}

function AuditView({ c }) {
  return (
    <div className="xeplr-monitor-body is-one">
      <section className="xeplr-monitor-card">
        <h1 className="xeplr-monitor-h1">Audit log</h1>
        <p className="xeplr-monitor-muted">Every sign-in and every change, refused ones too. Newest first.</p>
        {!c.audit ? <p className="xeplr-monitor-muted">Loading…</p> : (
          <table id="xeplr-monitor-audit" className="xeplr-monitor-table">
            <thead><tr><th>When</th><th>Who</th><th>What</th><th>Service</th><th>Result</th></tr></thead>
            <tbody>
              {c.audit.map((a, i) => (
                <tr key={i} className={a.ok ? '' : 'is-bad'}>
                  <td>{new Date(a.at).toLocaleString()}</td>
                  <td>{a.email || '—'}{a.ip ? <span className="xeplr-monitor-muted"> · {a.ip}</span> : null}</td>
                  <td>{a.action}</td>
                  <td>{a.unit || '—'}</td>
                  <td>{a.ok ? 'done' : 'refused: ' + (a.error || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Window({ title, onClose, children }) {
  return (
    <div className="xeplr-monitor-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="xeplr-monitor-window" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function AddWindow({ c, session }) {
  const a = c.adding
  return (
    <Window title="Add a service" onClose={c.closeAdd}>
      <form onSubmit={c.saveAdd}>
        <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-add-unit">Its systemd name
          <input id="xeplr-monitor-add-unit" type="text" value={a.unit} placeholder="e.g. xeplr-bi-api" onChange={(e) => c.editAdd({ unit: e.target.value })} autoFocus />
        </label>
        <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-add-label">A name for it here (optional)
          <input id="xeplr-monitor-add-label" type="text" value={a.label} placeholder="e.g. BI API (testbi)" onChange={(e) => c.editAdd({ label: e.target.value })} />
        </label>
        <p className="xeplr-monitor-muted xeplr-monitor-small">It must be a service on this server{session.allowed.length ? ', matching ' + session.allowed.join(', ') : ''}. Adding it starts nothing.</p>
        {a.error ? <p className="xeplr-monitor-bad" role="alert">{a.error}</p> : null}
        <div className="xeplr-monitor-row">
          <span />
          <span className="xeplr-monitor-row-right">
            <button type="button" onClick={c.closeAdd}>Cancel</button>
            <button type="submit" className="xeplr-monitor-primary" disabled={a.busy}>{a.busy ? 'Adding…' : 'Add'}</button>
          </span>
        </div>
      </form>
    </Window>
  )
}

function EditWindow({ c }) {
  const x = c.editing
  return (
    <Window title={'Edit ' + x.label} onClose={c.closeEdit}>
      <form onSubmit={c.saveEdit}>
        <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-edit-label">Name here
          <input id="xeplr-monitor-edit-label" type="text" value={x.label} onChange={(e) => c.editEdit({ label: e.target.value })} autoFocus />
        </label>
        <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-edit-unit">Its systemd name
          <input id="xeplr-monitor-edit-unit" type="text" value={x.newUnit} onChange={(e) => c.editEdit({ newUnit: e.target.value })} />
        </label>
        {x.error ? <p className="xeplr-monitor-bad" role="alert">{x.error}</p> : null}
        <div className="xeplr-monitor-row">
          <button type="button" className="xeplr-monitor-link is-danger" onClick={c.removeEditing}>Stop watching it</button>
          <span className="xeplr-monitor-row-right">
            <button type="button" onClick={c.closeEdit}>Cancel</button>
            <button type="submit" className="xeplr-monitor-primary" disabled={x.busy}>Save</button>
          </span>
        </div>
      </form>
    </Window>
  )
}
