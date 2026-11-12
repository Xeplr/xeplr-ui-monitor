// HOW THE SERVER ITSELF IS SAID — pure: no React, no requests. The Home page's
// numbers (GET /api/monitor/host) in words: sizes in GB, shares, uptime, and
// how memory divides up.

const GB = 1024 * 1024 * 1024

/** Bytes in GB, two decimals: "7.66 GB". '—' when unknown. */
export function gb(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '—'
  return (bytes / GB).toFixed(2) + ' GB'
}

/** A part of a whole as a whole percent, 0–100. null when the whole is unknown. */
export function share(part, whole) {
  if (!whole || part === null || part === undefined) return null
  return Math.max(0, Math.min(100, Math.round(part / whole * 100)))
}

/** How long the server has been up: "3 days 4 h", "5 h 12 min", "8 min". */
export function uptimeText(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d) return d + ' day' + (d === 1 ? '' : 's') + ' ' + h + ' h'
  if (h) return h + ' h ' + m + ' min'
  return m + ' min'
}

/**
 * How memory divides up, for one bar: used, then cache & buffers (which the
 * kernel gives back when a program needs it), then free. Each part's share of
 * the total, whole percents that add up to 100.
 */
export function memoryParts(memory) {
  if (!memory || !memory.totalBytes) return []
  const parts = [
    { key: 'used', label: 'Used', bytes: memory.usedBytes },
    { key: 'cache', label: 'Cache & buffers', bytes: (memory.cacheBytes || 0) + (memory.buffersBytes || 0) },
    { key: 'free', label: 'Free', bytes: memory.freeBytes }
  ]
  let left = 100
  return parts.map((p, i) => {
    const pct = i === parts.length - 1 ? Math.max(0, left) : share(p.bytes, memory.totalBytes)
    left -= pct
    return Object.assign({}, p, { percent: pct })
  })
}

/** A disk's state: how full, and whether it needs a look (90% or more). */
export function diskState(disk) {
  const used = share(disk.usedBytes, disk.totalBytes)
  return { usedPercent: used, nearlyFull: used !== null && used >= 90 }
}

/** What needs a look on the server: memory short, swap busy, a disk nearly full, load past the cores. [] when all is well. */
export function serverConcerns(stats) {
  if (!stats || !stats.linux) return []
  const out = []
  const m = stats.memory
  if (m && m.availableBytes !== null && share(m.availableBytes, m.totalBytes) < 10) out.push('Only ' + gb(m.availableBytes) + ' of memory is available: programs will start to swap')
  if (m && m.swapTotalBytes && share(m.swapUsedBytes, m.swapTotalBytes) >= 50) out.push(gb(m.swapUsedBytes) + ' of swap in use: the server is short of memory')
  ;(stats.disks || []).forEach((d) => { if (diskState(d).nearlyFull) out.push(d.mount + ' is ' + diskState(d).usedPercent + '% full: ' + gb(d.availableBytes) + ' left') })
  const c = stats.cpu
  if (c && c.load && c.cores && c.load[1] > c.cores) out.push('Load over 5 minutes (' + c.load[1] + ') is more than the ' + c.cores + ' cores: work is waiting for CPU')
  return out
}
