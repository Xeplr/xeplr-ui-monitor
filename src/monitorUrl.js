// WHAT IS OPEN LIVES IN THE URL — the selected service, the tab, a log's
// filter — so a refresh, or a link sent to someone, lands on the same screen.
// No router needed: the monitor is one page.

export function readUrl() {
  if (typeof window === 'undefined') return {}
  const p = new URLSearchParams(window.location.search)
  const out = {}
  p.forEach((v, k) => { out[k] = v })
  return out
}

/** Set some values (null or '' removes one). `push` adds a history entry (Back returns); otherwise it is replaced. */
export function writeUrl(patch, push) {
  if (typeof window === 'undefined') return
  const p = new URLSearchParams(window.location.search)
  Object.keys(patch).forEach((k) => {
    const v = patch[k]
    if (v === null || v === undefined || v === '') p.delete(k)
    else p.set(k, String(v))
  })
  const q = p.toString()
  const next = window.location.pathname + (q ? '?' + q : '') + window.location.hash
  if (next === window.location.pathname + window.location.search + window.location.hash) return
  window.history[push ? 'pushState' : 'replaceState'](null, '', next)
  window.dispatchEvent(new Event('xeplr-monitor-url'))
}
