// THE MONITOR — presentation only. Everything arrives as props:
//   c        useMonitorServices: the list, the selected one, actions, add/edit, audit
//   logs     useServiceLogs: the selected service's log
//   settings useMonitorSettings: what may be added (allowed)
//
// Left, the watched services with their state; right, the selected one: what
// systemd says about it (memory, CPU, threads, what needs a look, what runs
// it, every process of it), Start / Stop / Restart / Kill, and its log, live
// or from a time range.
//
// Built from the shared pieces: text boxes are @xeplr/ui-utils' TextFieldPage,
// the level a DropdownPage, the history's time a DateRangePage (withTime) and
// its line count a NumberFieldPage,
// the processes and the audit log are @xeplr/ui-table's XeplrTable. The "are
// you sure" and the result of an action are raised by the controller
// (raiseConfirm, raiseSnackbar), so a design does not draw them.
import { useEffect, useRef, useState } from 'react'
import { TextFieldPage, DropdownPage, NumberFieldPage, DateRangePage, dateValueLabel } from '@xeplr/ui-utils'
import { XeplrTable } from '@xeplr/ui-table'
import { stateOf, bytes, ago, clock, resultText, percent, memoryText, processState, concerns, LEVELS } from '../monitorFormat.js'
import './monitor.css'

export function MonitorScreen({ c, logs, settings, title = 'Monitor' }) {
  return (
    <div className="xeplr-monitor">
      <header className="xeplr-monitor-top">
        <b className="xeplr-monitor-brand">{title}</b>
        <nav className="xeplr-monitor-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={c.view === 'services'} onClick={c.showServices}>Services</button>
          <button type="button" role="tab" aria-selected={c.view === 'audit'} onClick={c.showAudit}>Audit log</button>
        </nav>
        <span className="xeplr-monitor-grow" />
      </header>
      {c.view === 'audit' ? <AuditView c={c} /> : (
        <div className="xeplr-monitor-body">
          <ServiceList c={c} settings={settings} />
          <main className="xeplr-monitor-main">
            {c.selected ? <ServiceDetail c={c} s={c.selected} logs={logs} /> : (
              <div className="xeplr-monitor-empty">
                <p>{c.loading ? 'Loading…' : c.list && c.list.length ? 'Choose a service on the left.' : 'No services yet. Add one: the name of its systemd service, e.g. xeplr-bi-api.'}</p>
              </div>
            )}
          </main>
        </div>
      )}
      {c.adding ? <AddWindow c={c} settings={settings} /> : null}
      {c.editing ? <EditWindow c={c} /> : null}
    </div>
  )
}

function Dot({ tone }) { return <span className={'xeplr-monitor-dot is-' + tone} aria-hidden="true" /> }

function ServiceList({ c, settings }) {
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
                <span className="xeplr-monitor-item-sub">{st.text}{s.status && s.status.since ? ' · ' + ago(s.status.since) : ''}{s.status && s.status.memoryBytes ? ' · ' + bytes(s.status.memoryBytes) : ''}{s.status && s.status.cpuPercent !== null && s.status.cpuPercent !== undefined ? ' · CPU ' + percent(s.status.cpuPercent) : ''}</span>
                {concerns(s.status, s.processes).length ? <span className="xeplr-monitor-item-warn">{concerns(s.status, s.processes).length} to look at</span> : null}
                {s.statusError ? <span className="xeplr-monitor-bad">{s.statusError}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
      {settings.allowed.length ? <p className="xeplr-monitor-muted xeplr-monitor-small">This monitor may control: {settings.allowed.join(', ')}</p> : null}
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
    ['Main process', t.pid || '—'],
    ['Memory', memoryText(t)],
    ['Memory at most', bytes(t.memoryPeakBytes)],
    ['CPU now', percent(t.cpuPercent)],
    ['CPU used in all', t.cpuSeconds === null || t.cpuSeconds === undefined ? '—' : t.cpuSeconds + ' s'],
    ['Processes · threads', (s.processes ? s.processes.length : '—') + ' · ' + (t.tasks === null || t.tasks === undefined ? '—' : t.tasks + (t.tasksMax ? ' of ' + t.tasksMax : ''))],
    ['Swap', t.swapBytes ? bytes(t.swapBytes) : 'none'],
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
        <Concerns list={concerns(t, s.processes)} running={t.state === 'active'} />
        <dl className="xeplr-monitor-facts">{facts.map((f) => <div key={f[0]} className="xeplr-monitor-fact"><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl>
        <Runs runs={t.runs} />
      </section>
      {s.processes && s.processes.length ? <Processes list={s.processes} mainPid={t.pid} /> : null}
      <LogPanel logs={logs} />
    </>
  )
}

function Concerns({ list, running }) {
  if (!running) return null
  if (!list.length) return <p className="xeplr-monitor-healthy">Nothing to look at: memory, CPU, restarts and processes are all fine.</p>
  return (
    <ul className="xeplr-monitor-concerns" aria-label="Needs a look">
      {list.map((x) => <li key={x}>{x}</li>)}
    </ul>
  )
}

/** What systemd starts for it: the command, where, as whom, from which unit file. */
function Runs({ runs }) {
  if (!runs) return null
  return (
    <dl className="xeplr-monitor-runs">
      {(runs.commands || []).map((c, i) => <div key={i} className="xeplr-monitor-fact"><dt>{i ? 'Then runs' : 'Runs'}</dt><dd><code>{c.command}</code></dd></div>)}
      <div className="xeplr-monitor-fact"><dt>In folder</dt><dd><code>{runs.workingDirectory || '/'}</code></dd></div>
      <div className="xeplr-monitor-fact"><dt>As user</dt><dd>{runs.user}</dd></div>
      {runs.unitFile ? <div className="xeplr-monitor-fact"><dt>Unit file</dt><dd><code>{runs.unitFile}</code></dd></div> : null}
    </dl>
  )
}

const PROCESS_COLUMNS = [
  { accessor: 'pid', header: 'PID', cell: (x) => <>{x.row.original.pid}{x.row.original.main ? <span className="xeplr-monitor-muted"> main</span> : null}</> },
  { accessor: 'command', header: 'Command', cell: (x) => <code title={x.row.original.command}>{x.row.original.command}</code> },
  { accessor: 'memoryBytes', header: 'Memory', cell: (x) => <>{bytes(x.row.original.memoryBytes)}{x.row.original.swapBytes ? <span className="xeplr-monitor-muted"> +{bytes(x.row.original.swapBytes)} swap</span> : null}</> },
  { accessor: 'cpuPercent', header: 'CPU', cell: (x) => percent(x.row.original.cpuPercent) },
  { accessor: 'threads', header: 'Threads' },
  { accessor: 'state', header: 'State', cell: (x) => processState(x.row.original.state) },
  { accessor: 'startedAt', header: 'Running for', cell: (x) => ago(x.row.original.startedAt) }
]

/** Every process of the service: the main one first, then by memory (the server's order, until a header is clicked). */
function Processes({ list, mainPid }) {
  const rows = list.map((p) => Object.assign({ id: p.pid, main: p.pid === mainPid }, p))
  return (
    <section className="xeplr-monitor-card">
      <b>Processes</b> <span className="xeplr-monitor-muted">· {list.length}, the main one first</span>
      <div id="xeplr-monitor-processes" className="xeplr-monitor-tablebox">
        <XeplrTable
          data={rows}
          schema={{ 0: { key: 'processes', columns: PROCESS_COLUMNS } }}
          enableFiltering={false}
          enablePagination={false}
          showToolbar={false}
          rowClassName={(r) => (r.state === 'D' || r.state === 'Z' ? 'xeplr-monitor-row-bad' : '')}
        />
      </div>
    </section>
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
        <div className="xeplr-monitor-search"><TextFieldPage type="search" placeholder="Search the log…" value={logs.grep} onChange={logs.setGrep} /></div>
        <div className="xeplr-monitor-level"><DropdownPage options={LEVELS} value={logs.level || 'all'} searchable={false} onChange={(v) => logs.setLevel(v && v !== 'all' ? v : '')} /></div>
        <span className="xeplr-monitor-grow" />
        <LogState logs={logs} />
        {live ? (logs.paused
          ? <button type="button" onClick={logs.resume}>Resume{logs.held ? ' (' + logs.held + ' new)' : ''}</button>
          : <button type="button" onClick={logs.pause}>Pause</button>) : null}
        <button type="button" className="xeplr-monitor-link" onClick={logs.clear}>Clear</button>
      </div>
      {!live ? (
        <HistoryRange logs={logs} />
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

/** When to read the log from: a DateRange (with times) behind a button, how many lines at most, and Read. */
function HistoryRange({ logs }) {
  const [open, setOpen] = useState(false)
  return (
    <form className="xeplr-monitor-range" onSubmit={(e) => { e.preventDefault(); logs.readHistory() }}>
      <div className="xeplr-monitor-when">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{dateValueLabel(logs.range.when) || 'Any time'} ▾</button>
        {open ? (
          <div className="xeplr-monitor-when-panel">
            <DateRangePage withTime value={logs.range.when} onChange={(when) => logs.setRange({ when })} onClose={() => setOpen(false)} />
          </div>
        ) : null}
      </div>
      <label>At most</label>
      <div className="xeplr-monitor-lines"><NumberFieldPage value={logs.range.lines} min={1} max={5000} decimals={0} onChange={(lines) => logs.setRange({ lines })} /></div>
      <label>lines</label>
      <button type="submit" className="xeplr-monitor-primary">Read</button>
    </form>
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

const AUDIT_COLUMNS = [
  { accessor: 'at', header: 'When', cell: (x) => new Date(x.row.original.at).toLocaleString() },
  { accessor: 'email', header: 'Who', cell: (x) => <>{x.row.original.email || '—'}{x.row.original.ip ? <span className="xeplr-monitor-muted"> · {x.row.original.ip}</span> : null}</> },
  { accessor: 'action', header: 'What' },
  { accessor: 'unit', header: 'Service', cell: (x) => x.row.original.unit || '—' },
  { accessor: 'result', header: 'Result' }
]

function AuditView({ c }) {
  const rows = (c.audit || []).map((a, i) => Object.assign({ id: i, result: a.ok ? 'done' : 'refused: ' + (a.error || '') }, a))
  return (
    <div className="xeplr-monitor-body is-one">
      <section className="xeplr-monitor-card">
        <h1 className="xeplr-monitor-h1">Audit log</h1>
        <p className="xeplr-monitor-muted">Every sign-in and every change, refused ones too. Newest first.</p>
        {!c.audit ? <p className="xeplr-monitor-muted">Loading…</p> : (
          <div id="xeplr-monitor-audit" className="xeplr-monitor-tablebox">
            <XeplrTable
              data={rows}
              schema={{ 0: { key: 'audit', columns: AUDIT_COLUMNS } }}
              pageSize={50}
              rowClassName={(r) => (r.ok ? '' : 'xeplr-monitor-row-bad')}
            />
          </div>
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

function AddWindow({ c, settings }) {
  const a = c.adding
  return (
    <Window title="Add a service" onClose={c.closeAdd}>
      <form onSubmit={c.saveAdd}>
        <div id="xeplr-monitor-add-unit"><TextFieldPage label="Its systemd name" value={a.unit} placeholder="e.g. xeplr-bi-api" maxLength={200} onChange={(v) => c.editAdd({ unit: v })} /></div>
        <div id="xeplr-monitor-add-label"><TextFieldPage label="A name for it here (optional)" value={a.label} placeholder="e.g. BI API (testbi)" maxLength={80} onChange={(v) => c.editAdd({ label: v })} /></div>
        <p className="xeplr-monitor-muted xeplr-monitor-small">It must be a service on this server{settings.allowed.length ? ', matching ' + settings.allowed.join(', ') : ''}. Adding it starts nothing.</p>
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
        <div id="xeplr-monitor-edit-label"><TextFieldPage label="Name here" value={x.label} maxLength={80} onChange={(v) => c.editEdit({ label: v })} /></div>
        <div id="xeplr-monitor-edit-unit"><TextFieldPage label="Its systemd name" value={x.newUnit} maxLength={200} onChange={(v) => c.editEdit({ newUnit: v })} /></div>
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
