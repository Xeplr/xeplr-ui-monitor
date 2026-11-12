// HOW THE MONITOR SAYS THINGS — pure: no React, no requests. A service's
// state in words, sizes, times, and which lines a filter keeps. Shared by the
// controllers and any design.

/** A service's state as a word and a tone: good | bad | busy | off | unknown. */
export function stateOf(status) {
  if (!status) return { text: 'Unknown', tone: 'unknown' }
  if (!status.exists) return { text: 'Not on this server', tone: 'bad' }
  const s = status.state
  if (s === 'active') return { text: status.subState === 'exited' ? 'Done (exited)' : 'Running', tone: 'good' }
  if (s === 'activating') return { text: status.subState === 'auto-restart' ? 'Restarting by itself' : 'Starting', tone: 'busy' }
  if (s === 'deactivating') return { text: 'Stopping', tone: 'busy' }
  if (s === 'reloading') return { text: 'Reloading', tone: 'busy' }
  if (s === 'failed') return { text: 'Failed' + (status.result && status.result !== 'success' ? ': ' + resultText(status.result) : ''), tone: 'bad' }
  if (s === 'inactive') return { text: 'Stopped', tone: 'off' }
  return { text: s, tone: 'unknown' }
}

/** Why a service last ended, in words (systemd's Result). */
export function resultText(r) {
  return {
    'exit-code': 'it exited with an error',
    signal: 'it was killed',
    'core-dump': 'it crashed (core dump)',
    timeout: 'it timed out',
    watchdog: 'its watchdog fired',
    'oom-kill': 'out of memory',
    'start-limit-hit': 'restarted too often',
    resources: 'it could not get its resources'
  }[r] || r
}

/** Bytes in a few characters: 512 MB, 1.2 GB. */
export function bytes(n) {
  if (n === null || n === undefined) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return (v >= 10 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + units[i]
}

/** How long ago, briefly: "12s", "5 min", "3 h", "2 days". */
export function ago(iso, now) {
  if (!iso) return '—'
  const s = Math.max(0, Math.round(((now || Date.now()) - new Date(iso).getTime()) / 1000))
  if (s < 60) return s + 's'
  if (s < 3600) return Math.floor(s / 60) + ' min'
  if (s < 86400) return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min'
  const d = Math.floor(s / 86400)
  return d + ' day' + (d === 1 ? '' : 's')
}

/** A log line's time as the reader's clock shows it, with seconds. */
export function clock(iso) {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

const RANK = { error: 0, warn: 1, info: 2, debug: 3 }

/** Whether a line passes the filter: its text contains `grep` (any case) and it is at `level` or worse. */
export function keeps(line, grep, level) {
  if (level && (RANK[line.level] === undefined ? 3 : RANK[line.level]) > RANK[level]) return false
  if (grep && String(line.message).toLowerCase().indexOf(String(grep).toLowerCase()) < 0) return false
  return true
}

/** Lines added to a live log, the oldest dropped past `max`. */
export function appended(lines, more, max) {
  const all = lines.concat(more)
  return all.length > max ? all.slice(all.length - max) : all
}

/** Whether an action needs a "are you sure": the ones that take a service down. */
export function needsConfirm(action) {
  return action === 'stop' || action === 'kill' || action === 'restart'
}

/** What a confirmation says about an action. */
export function confirmText(action, label) {
  if (action === 'stop') return 'Stop ' + label + '? It stays stopped until someone starts it.'
  if (action === 'kill') return 'Kill ' + label + '? Every process of it ends at once, mid-work. If it is set to restart, systemd starts it again.'
  if (action === 'restart') return 'Restart ' + label + '? Requests it is answering now are cut off.'
  return ''
}

/** CPU now: "12%", or "—" before a second reading. Above 100% is more than one core. */
export function percent(n) {
  if (n === null || n === undefined) return '—'
  return (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10) + '%'
}

/** Memory in use, against its limit when it has one: "310 MB of 1 GB (30%)". */
export function memoryText(status) {
  if (!status || status.memoryBytes === null || status.memoryBytes === undefined) return '—'
  const max = status.memoryMaxBytes
  return bytes(status.memoryBytes) + (max ? ' of ' + bytes(max) + ' (' + Math.round(status.memoryBytes / max * 100) + '%)' : '')
}

const STATES = { R: 'running', S: 'waiting', D: 'stuck on disk or network', Z: 'zombie (ended, not collected)', T: 'paused', I: 'idle' }

/** A process's state letter in words. */
export function processState(letter) { return STATES[letter] || letter }

/**
 * What needs a look in a running service, from systemd's own numbers: memory
 * close to its limit, restarts, swap, threads near their cap, CPU pinned,
 * processes stuck or left as zombies. [] when all is well.
 */
export function concerns(status, processes) {
  const t = status || {}
  const out = []
  if (t.state !== 'active') return out
  const mem = t.memoryBytes
  if (mem && t.memoryMaxBytes && mem >= t.memoryMaxBytes * 0.9) out.push('Memory is at ' + Math.round(mem / t.memoryMaxBytes * 100) + '% of its limit: past it, systemd kills it')
  else if (mem && t.memoryHighBytes && mem >= t.memoryHighBytes) out.push('Memory is past its MemoryHigh, so it is being slowed down')
  if (t.restarts) out.push('It has restarted ' + t.restarts + ' time' + (t.restarts === 1 ? '' : 's') + ' by itself: see the log around ' + (t.since ? 'when it last started' : 'the restarts'))
  if (t.swapBytes) out.push(bytes(t.swapBytes) + ' of it is in swap: the server is short of memory')
  if (t.tasks && t.tasksMax && t.tasks >= t.tasksMax * 0.8) out.push(t.tasks + ' threads, near its cap of ' + t.tasksMax)
  if (t.cpuPercent !== null && t.cpuPercent !== undefined && t.cpuPercent >= 90) out.push('CPU at ' + percent(t.cpuPercent) + ': a busy loop or a long job holds it')
  const list = processes || []
  const stuck = list.filter((p) => p.state === 'D').length
  const zombies = list.filter((p) => p.state === 'Z').length
  if (stuck) out.push(stuck + ' process' + (stuck === 1 ? ' is' : 'es are') + ' stuck waiting on disk or network')
  if (zombies) out.push(zombies + ' zombie process' + (zombies === 1 ? '' : 'es') + ': ended, never collected by its parent')
  return out
}

/** The log levels a reader can narrow to, as the level dropdown lists them. */
export const LEVELS = [
  { id: 'all', name: 'Every line' },
  { id: 'warn', name: 'Warnings and errors' },
  { id: 'error', name: 'Errors only' }
]

/**
 * A resolved DateRange ({ from, to }: "2026-11-12" or "2026-11-12T09:30",
 * either may be missing) as the ISO times the log is read between. A whole
 * day runs from its first moment to its last; a time to the end of its
 * minute. Both in the reader's own time zone, as they were picked.
 */
export function spanTimes(span) {
  if (!span) return { since: undefined, until: undefined }
  const at = (v, end) => {
    if (!v) return undefined
    const day = /^\d{4}-\d{2}-\d{2}$/.test(v)
    const d = new Date(day ? v + 'T00:00:00' : v)
    if (isNaN(d)) return undefined
    if (end) d.setTime(d.getTime() + (day ? 86400000 : 60000) - 1)
    return d.toISOString()
  }
  return { since: at(span.from, false), until: at(span.to, true) }
}
