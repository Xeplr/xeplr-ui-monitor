// THE SERVER ITSELF — the Home page, presentation only. Everything arrives as
// props:
//   s   useServerStats: { stats, services, loading, error, servicesError, open }
//
// Memory first (in GB: total, used, cache & buffers, free, available, swap,
// one bar of how it divides up, and what the cache holds — by kind and by
// service), then the services added to the monitor
// with what each is using, then the CPU, the disks (one bar each) and how long
// the server has been up. Values sit next to their bars; colour
// is never the only way to read one.
import { XeplrTable } from '@xeplr/ui-table'
import { gb, share, uptimeText, memoryParts, cacheBreakdown, diskState, serverConcerns } from '../serverFormat.js'
import { stateOf, bytes, percent, ago, concerns } from '../monitorFormat.js'
import './monitor.css'

export function ServerScreen({ s, title = 'Server' }) {
  const st = s.stats
  return (
    <div className="xeplr-monitor">
      <header className="xeplr-monitor-top">
        <b className="xeplr-monitor-brand">{title}</b>
        {st ? <span className="xeplr-monitor-muted">{st.host.name} · {st.host.os} · kernel {st.host.kernel} · {st.host.arch}</span> : null}
        <span className="xeplr-monitor-grow" />
        {st && st.host.uptimeSeconds !== null ? <span className="xeplr-monitor-muted">Up {uptimeText(st.host.uptimeSeconds)}</span> : null}
      </header>
      <div className="xeplr-monitor-body is-one xeplr-monitor-server">
        {s.error ? <p className="xeplr-monitor-bad" role="alert">{s.error}</p> : null}
        {!st ? <p className="xeplr-monitor-muted">{s.loading ? 'Reading the server…' : ''}</p>
          : !st.linux ? <p className="xeplr-monitor-muted">These numbers come from Linux. This server runs {st.host.os}, so there is nothing to show.</p>
          : (
            <>
              <Concerns list={serverConcerns(st)} />
              <Memory m={st.memory} />
              <Services s={s} total={st.memory && st.memory.totalBytes} />
              <div className="xeplr-monitor-server-row">
                <Cpu c={st.cpu} />
                <Disks disks={st.disks} />
              </div>
            </>
          )}
      </div>
    </div>
  )
}

function Concerns({ list }) {
  if (!list.length) return <p className="xeplr-monitor-healthy">Nothing to look at: memory, swap, disks and load are all fine.</p>
  return <ul className="xeplr-monitor-concerns" aria-label="Needs a look">{list.map((x) => <li key={x}>{x}</li>)}</ul>
}

function Tile({ label, value, sub }) {
  return (
    <div className="xeplr-monitor-tile">
      <span className="xeplr-monitor-tile-label">{label}</span>
      <span className="xeplr-monitor-tile-value">{value}</span>
      {sub ? <span className="xeplr-monitor-tile-sub">{sub}</span> : null}
    </div>
  )
}

function Memory({ m }) {
  const parts = memoryParts(m)
  return (
    <section id="xeplr-monitor-memory" className="xeplr-monitor-card">
      <b>Memory</b>
      <div className="xeplr-monitor-tiles">
        <Tile label="Total" value={gb(m.totalBytes)} />
        <Tile label="Used" value={gb(m.usedBytes)} sub={share(m.usedBytes, m.totalBytes) + '% of total'} />
        <Tile label="Cache & buffers" value={gb(m.cacheBytes + m.buffersBytes)} sub="given back when needed" />
        <Tile label="Free" value={gb(m.freeBytes)} sub="not in use at all" />
        <Tile label="Available" value={gb(m.availableBytes)} sub="for new programs, without swapping" />
        <Tile label="Swap" value={m.swapTotalBytes ? gb(m.swapUsedBytes) : 'none'} sub={m.swapTotalBytes ? 'of ' + gb(m.swapTotalBytes) + ' in use' : 'no swap set up'} />
      </div>
      <div className="xeplr-monitor-stack" role="img" aria-label={parts.map((p) => p.label + ' ' + gb(p.bytes) + ' (' + p.percent + '%)').join(', ')}>
        {parts.map((p) => p.percent > 0 ? (
          <span key={p.key} className={'xeplr-monitor-stack-part is-' + p.key} style={{ flexBasis: p.percent + '%' }} title={p.label + ': ' + gb(p.bytes) + ' (' + p.percent + '%)'} />
        ) : null)}
      </div>
      <ul className="xeplr-monitor-legend">
        {parts.map((p) => (
          <li key={p.key}><span className={'xeplr-monitor-swatch is-' + p.key} aria-hidden="true" />{p.label} <b>{gb(p.bytes)}</b> <span className="xeplr-monitor-muted">{p.percent}%</span></li>
        ))}
      </ul>
      <CacheHolds c={cacheBreakdown(m)} />
    </section>
  )
}

/** What the cache & buffers hold: by kind, and by whom — each a bar of its share. */
function CacheHolds({ c }) {
  if (!c.kinds.length && !c.groups.length) return null
  return (
    <div className="xeplr-monitor-cache" id="xeplr-monitor-cache">
      <div>
        <b>What the cache holds</b> <span className="xeplr-monitor-muted">· {gb(c.wholeBytes)}, given back as soon as a program needs it</span>
        <ShareRows rows={c.kinds} sub={(k) => k.note} />
      </div>
      {c.groups.length ? (
        <div>
          <b>For whom</b> <span className="xeplr-monitor-muted">· whose files they are: each page counts for the service that first read it</span>
          <ShareRows rows={c.groups} sub={(g) => g.unit} />
        </div>
      ) : null}
    </div>
  )
}

function ShareRows({ rows, sub }) {
  return (
    <ul className="xeplr-monitor-shares">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="xeplr-monitor-share-name"><b>{r.label}</b> <span className="xeplr-monitor-muted">{sub(r)}</span></span>
          <span className="xeplr-monitor-share-bar" aria-hidden="true"><span style={{ width: (r.percent || 0) + '%' }} /></span>
          <span className="xeplr-monitor-share-num"><b>{gb(r.bytes)}</b> <span className="xeplr-monitor-muted">{r.percent === null ? '' : r.percent + '%'}</span></span>
        </li>
      ))}
    </ul>
  )
}

/** The services added to the monitor, with what each is using now. A name opens it on the Monitor page. */
function Services({ s, total }) {
  if (s.servicesError) return <section className="xeplr-monitor-card"><b>Services</b><p className="xeplr-monitor-muted">{s.servicesError}</p></section>
  if (!s.services) return null
  const rows = s.services.map((x) => Object.assign({ id: x.unit }, x, { t: x.status || {}, look: concerns(x.status, x.processes).length }))
  const columns = [
    { accessor: 'label', header: 'Service', cell: (r) => { const x = r.row.original; return <button type="button" className="xeplr-monitor-link xeplr-monitor-svc" onClick={() => s.open(x.unit)} title={'Open ' + x.unit + ' on the Monitor page'}><b>{x.label}</b><span className="xeplr-monitor-muted"> {x.unit}</span></button> } },
    { accessor: 'state', header: 'State', cell: (r) => { const st = stateOf(r.row.original.status); return <span className="xeplr-monitor-svc-state"><span className={'xeplr-monitor-dot is-' + st.tone} aria-hidden="true" />{st.text}</span> } },
    { accessor: 'memory', header: 'Memory', cell: (r) => { const t = r.row.original.t; return t.memoryBytes === null || t.memoryBytes === undefined ? '—' : <>{bytes(t.memoryBytes)}{total ? <span className="xeplr-monitor-muted"> · {percent(t.memoryBytes / total * 100)} of the server</span> : null}</> } },
    { accessor: 'limit', header: 'Limit', cell: (r) => { const t = r.row.original.t; return t.memoryMaxBytes ? bytes(t.memoryMaxBytes) + ' (' + Math.round(t.memoryBytes / t.memoryMaxBytes * 100) + '% used)' : 'none' } },
    { accessor: 'peak', header: 'At most', cell: (r) => bytes(r.row.original.t.memoryPeakBytes) },
    { accessor: 'cpu', header: 'CPU now', cell: (r) => percent(r.row.original.t.cpuPercent) },
    { accessor: 'threads', header: 'Processes · threads', cell: (r) => { const x = r.row.original; return (x.processes ? x.processes.length : '—') + ' · ' + (x.t.tasks === null || x.t.tasks === undefined ? '—' : x.t.tasks) } },
    { accessor: 'restarts', header: 'Restarts', cell: (r) => { const n = r.row.original.t.restarts; return n === null || n === undefined ? '—' : n } },
    { accessor: 'since', header: 'Running for', cell: (r) => { const t = r.row.original.t; return t.state === 'active' ? ago(t.since) : '—' } },
    { accessor: 'look', header: 'Needs a look', cell: (r) => r.row.original.look ? <span className="xeplr-monitor-pill is-busy">⚠ {r.row.original.look}</span> : <span className="xeplr-monitor-muted">no</span> }
  ]
  return (
    <section className="xeplr-monitor-card">
      <b>Services</b> <span className="xeplr-monitor-muted">· {rows.length} added to the monitor, what each is using now</span>
      {!rows.length ? <p className="xeplr-monitor-muted">None yet. Add them on the Monitor page.</p> : (
        <div id="xeplr-monitor-server-services" className="xeplr-monitor-tablebox">
          <XeplrTable
            data={rows}
            schema={{ 0: { key: 'services', columns: columns } }}
            enableFiltering={false}
            enablePagination={false}
            showToolbar={false}
            rowClassName={(x) => (stateOf(x.status).tone === 'bad' ? 'xeplr-monitor-row-bad' : '')}
          />
        </div>
      )}
    </section>
  )
}

function Cpu({ c }) {
  return (
    <section className="xeplr-monitor-card">
      <b>CPU</b>
      <div className="xeplr-monitor-tiles">
        <Tile label="In use now" value={c.usePercent === null ? '—' : c.usePercent + '%'} sub="all cores together" />
        <Tile label="Cores" value={c.cores} sub={c.model} />
        <Tile label="Load: 1 · 5 · 15 min" value={c.load ? c.load.join(' · ') : '—'} sub={'more than ' + c.cores + ' means work is waiting'} />
      </div>
    </section>
  )
}

function Disks({ disks }) {
  return (
    <section id="xeplr-monitor-disks" className="xeplr-monitor-card">
      <b>Disks</b>
      {!disks.length ? <p className="xeplr-monitor-muted">No disks found.</p> : (
        <ul className="xeplr-monitor-disks">
          {disks.map((d) => {
            const ds = diskState(d)
            return (
              <li key={d.device + d.mount}>
                <div className="xeplr-monitor-disk-head">
                  <b>{d.mount}</b>
                  <span className="xeplr-monitor-muted xeplr-monitor-small">{d.device} · {d.type}</span>
                  <span className="xeplr-monitor-grow" />
                  {ds.nearlyFull ? <span className="xeplr-monitor-pill is-busy">⚠ Nearly full</span> : null}
                </div>
                <div className="xeplr-monitor-meter" role="img" aria-label={d.mount + ': ' + gb(d.usedBytes) + ' of ' + gb(d.totalBytes) + ' used'}>
                  <span className={'xeplr-monitor-meter-fill' + (ds.nearlyFull ? ' is-full' : '')} style={{ width: ds.usedPercent + '%' }} title={gb(d.usedBytes) + ' used (' + ds.usedPercent + '%)'} />
                </div>
                <span className="xeplr-monitor-small">{gb(d.usedBytes)} of {gb(d.totalBytes)} used ({ds.usedPercent}%) · <b>{gb(d.availableBytes)}</b> free</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
