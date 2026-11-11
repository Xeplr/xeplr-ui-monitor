// THE SERVICES — the controller: the watched list with each one's state
// (asked again every few seconds), adding one, changing one in place,
// start / stop / restart / kill with an "are you sure" for the ones that take
// it down, and the audit log. No JSX. The selected service and the view are
// in the URL (?service=…&view=…).
//
//   api        createMonitorApi()
//   self       the monitor's own unit, which it will not stop or kill
//   onExpired  a request answered 401: the session ended
import { useCallback, useEffect, useMemo, useState } from 'react'
import { readUrl, writeUrl } from './monitorUrl.js'
import { stateOf, needsConfirm, confirmText } from './monitorFormat.js'

const POLL_MS = 5000

export function useMonitorServices({ api, self, onExpired }) {
  const [list, setList] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [url, setUrl] = useState(readUrl)
  const [busy, setBusy] = useState({})                // unit -> action running
  const [message, setMessage] = useState(null)        // { tone, text }
  const [confirm, setConfirm] = useState(null)        // { unit, action, text }
  const [adding, setAdding] = useState(null)          // { unit, label, error, busy } while the add form is open
  const [editing, setEditing] = useState(null)        // { unit, label, newUnit, error, busy }
  const [audit, setAudit] = useState(null)

  useEffect(() => {
    const on = () => setUrl(readUrl())
    window.addEventListener('popstate', on)
    window.addEventListener('xeplr-monitor-url', on)
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('xeplr-monitor-url', on) }
  }, [])

  const failed = useCallback((err) => {
    if (err && err.status === 401 && onExpired) onExpired()
    return err
  }, [onExpired])

  const load = useCallback(() => api.services().then((l) => { setList(l); setLoadError(null) }).catch((e) => { failed(e); setLoadError(e.message) }), [api, failed])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const view = url.view === 'audit' ? 'audit' : 'services'
  const selectedUnit = url.service || null
  const selected = useMemo(() => (list || []).find((s) => s.unit === selectedUnit) || null, [list, selectedUnit])
  const select = useCallback((unit) => writeUrl({ service: unit, view: null, tab: null, grep: null, level: null }, true), [])
  const showAudit = useCallback(() => writeUrl({ view: 'audit', service: null }, true), [])
  const showServices = useCallback(() => writeUrl({ view: null }, true), [])

  useEffect(() => {
    if (view !== 'audit') return
    api.audit(300).then(setAudit).catch((e) => { failed(e); setMessage({ tone: 'bad', text: e.message }) })
  }, [view, api, failed])

  // ── actions ───────────────────────────────────────────────────────────
  const run = useCallback(async (unit, action) => {
    setConfirm(null)
    setBusy((b) => Object.assign({}, b, { [unit]: action }))
    setMessage(null)
    try {
      const out = await api.act(unit, action)
      setList((l) => (l || []).map((s) => (s.unit === unit ? Object.assign({}, s, { status: out.status }) : s)))
      const s = (list || []).find((x) => x.unit === unit)
      setMessage({ tone: 'good', text: (s ? s.label : unit) + ': ' + action + ' done. Now ' + stateOf(out.status).text.toLowerCase() + '.' })
    } catch (err) {
      failed(err)
      setMessage({ tone: 'bad', text: err.message })
    } finally {
      setBusy((b) => { const n = Object.assign({}, b); delete n[unit]; return n })
      load()
    }
  }, [api, list, load, failed])

  const ask = useCallback((unit, action) => {
    const s = (list || []).find((x) => x.unit === unit)
    if (needsConfirm(action)) setConfirm({ unit, action, text: confirmText(action, s ? s.label : unit) })
    else run(unit, action)
  }, [list, run])
  const confirmYes = useCallback(() => { if (confirm) run(confirm.unit, confirm.action) }, [confirm, run])
  const confirmNo = useCallback(() => setConfirm(null), [])

  /** Which actions a service offers now, and why one is not offered. */
  const actionsFor = useCallback((s) => {
    const st = s && s.status
    const up = st && (st.state === 'active' || st.state === 'activating' || st.state === 'reloading')
    const own = s && self && s.unit === self
    return {
      start: !up,
      stop: Boolean(up) && !own,
      restart: true,
      kill: Boolean(up) && !own,
      own: Boolean(own)
    }
  }, [self])

  // ── the list itself ───────────────────────────────────────────────────
  const openAdd = useCallback(() => setAdding({ unit: '', label: '', error: null, busy: false }), [])
  const editAdd = useCallback((patch) => setAdding((a) => (a ? Object.assign({}, a, patch, { error: null }) : a)), [])
  const closeAdd = useCallback(() => setAdding(null), [])
  const saveAdd = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!adding || !adding.unit.trim()) return setAdding((a) => Object.assign({}, a, { error: 'Enter the service name, e.g. xeplr-bi-api' }))
    setAdding((a) => Object.assign({}, a, { busy: true, error: null }))
    try {
      const s = await api.addService({ unit: adding.unit.trim(), label: adding.label.trim() })
      setAdding(null)
      await load()
      select(s.unit)
    } catch (err) {
      failed(err)
      setAdding((a) => Object.assign({}, a, { busy: false, error: err.message }))
    }
  }, [api, adding, load, select, failed])

  const openEdit = useCallback((s) => setEditing({ unit: s.unit, label: s.label, newUnit: s.unit, error: null, busy: false }), [])
  const editEdit = useCallback((patch) => setEditing((x) => (x ? Object.assign({}, x, patch, { error: null }) : x)), [])
  const closeEdit = useCallback(() => setEditing(null), [])
  const saveEdit = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!editing) return
    setEditing((x) => Object.assign({}, x, { busy: true }))
    try {
      const s = await api.editService(editing.unit, { label: editing.label, unit: editing.newUnit })
      setEditing(null)
      await load()
      if (s.unit !== editing.unit && selectedUnit === editing.unit) writeUrl({ service: s.unit })
    } catch (err) {
      failed(err)
      setEditing((x) => Object.assign({}, x, { busy: false, error: err.message }))
    }
  }, [api, editing, load, selectedUnit, failed])
  const removeEditing = useCallback(async () => {
    if (!editing) return
    try {
      await api.removeService(editing.unit)
      setEditing(null)
      if (selectedUnit === editing.unit) writeUrl({ service: null })
      await load()
    } catch (err) {
      failed(err)
      setEditing((x) => Object.assign({}, x, { error: err.message }))
    }
  }, [api, editing, load, selectedUnit, failed])

  return {
    list, loading: list === null, loadError, reload: load,
    view, showAudit, showServices, audit,
    selected, selectedUnit, select,
    busy, message, clearMessage: useCallback(() => setMessage(null), []),
    ask, confirm, confirmYes, confirmNo, actionsFor,
    adding, openAdd, editAdd, closeAdd, saveAdd,
    editing, openEdit, editEdit, closeEdit, saveEdit, removeEditing
  }
}
