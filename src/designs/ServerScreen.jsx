// THE SERVER ITSELF — the Home page, presentation only. Everything arrives as
// props:
//   s   useServerStats: { stats, loading, error }
//
// Memory first (in GB: total, used, cache & buffers, free, available, swap,
// and one bar of how it divides up), then the CPU, the disks (one bar each)
// and how long the server has been up. Values sit next to their bars; colour
// is never the only way to read one.
import { gb, share, uptimeText, memoryParts, diskState, serverConcerns } from '../serverFormat.js'
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
