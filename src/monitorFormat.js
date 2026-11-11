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
