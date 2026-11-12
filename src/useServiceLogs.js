// ONE SERVICE'S LOG — the controller: live (followed as it is written) or
// history (a time range), a search and a level that narrow what shows, pause
// that holds the screen still while lines keep arriving underneath. No JSX.
// The mode and the filter are in the URL (?tab=history&grep=…&level=warn),
// through @xeplr/ui-utils' useUrlParams.
//
//   api        createMonitorApi()
//   unit       the service, or null
//   onExpired  a request answered 401
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUrlParams } from '@xeplr/ui-utils/src/url/useUrlState.js'
import { resolveDateValue } from '@xeplr/ui-utils'
import { keeps, appended, spanTimes } from './monitorFormat.js'

const KEEP = 5000          // lines held on screen; the oldest go
const FIRST = 300          // lines shown when a log is opened

export function useServiceLogs({ api, unit, onExpired }) {
  const url = useUrlParams()
  const [lines, setLines] = useState([])
  const [state, setState] = useState('idle')        // idle | loading | live | reconnecting | ready | error
  const [error, setError] = useState(null)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState([])              // arrived while paused
  const [range, setRange] = useState({ when: null, lines: 1000 })   // when: a DateRange selection
  const pausedRef = useRef(false)

  const mode = url.get('tab') === 'history' ? 'history' : 'live'
  const grep = url.get('grep') || ''
  const level = url.get('level') || ''
  const setUrl = url.set

  const failed = useCallback((err) => {
    if (err && err.status === 401 && onExpired) onExpired()
    setError(err.message)
    setState('error')
  }, [onExpired])

  // Live: the last lines, then every new one as it is written. Closing the
  // page, choosing another service or switching to history ends the follow,
  // and with it the journalctl reading it on the server.
  useEffect(() => {
    setLines([]); setHeld([]); setError(null); setPaused(false); pausedRef.current = false
    if (!unit || mode !== 'live') { setState('idle'); return undefined }
    let stop = null
    let live = true
    setState('loading')
    api.logs(unit, { lines: FIRST }).then((first) => {
      if (!live) return
      setLines(first)
      stop = api.follow(unit, (line) => {
        if (pausedRef.current) setHeld((h) => appended(h, [line], KEEP))
        else setLines((l) => appended(l, [line], KEEP))
      }, (problem) => {
        if (!live) return
        if (problem) { setError(problem); setState('error') } else setState('reconnecting')
      }, () => { if (live) { setState('live'); setError(null) } })
    }).catch((e) => { if (live) failed(e) })
    return () => { live = false; if (stop) stop() }
  }, [api, unit, mode, failed])

  // History: read when asked (and when opened).
  const readHistory = useCallback(async () => {
    if (!unit) return
    setState('loading')
    setError(null)
    try {
      const times = spanTimes(resolveDateValue(range.when, new Date()))
      const out = await api.logs(unit, {
        lines: range.lines || 1000,
        since: times.since,
        until: times.until,
        grep: grep || undefined,
        level: level || undefined
      })
      setLines(out)
      setState('ready')
    } catch (e) { failed(e) }
  }, [api, unit, range, grep, level, failed])
  useEffect(() => { if (unit && mode === 'history') readHistory() }, [unit, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => { pausedRef.current = true; setPaused(true) }, [])
  const resume = useCallback(() => {
    pausedRef.current = false
    setPaused(false)
    setHeld((h) => { if (h.length) setLines((l) => appended(l, h, KEEP)); return [] })
  }, [])
  const clear = useCallback(() => { setLines([]); setHeld([]) }, [])

  const shown = useMemo(() => lines.filter((l) => keeps(l, grep, level)), [lines, grep, level])

  return {
    unit, mode,
    // Switching the mode or typing a filter replaces the history entry: Back is not a keystroke undo.
    setMode: useCallback((m) => setUrl({ tab: m === 'history' ? 'history' : null }, { replace: true }), [setUrl]),
    grep, setGrep: useCallback((g) => setUrl({ grep: g }, { replace: true }), [setUrl]),
    level, setLevel: useCallback((v) => setUrl({ level: v }, { replace: true }), [setUrl]),
    range, setRange: useCallback((patch) => setRange((r) => Object.assign({}, r, patch)), []),
    readHistory,
    lines: shown, total: lines.length, state, error,
    paused, held: held.length, pause, resume, clear
  }
}
