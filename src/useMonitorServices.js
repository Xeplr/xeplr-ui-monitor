// THE SERVICES — the controller: the watched list with each one's state
// (asked again every few seconds), adding one, changing one in place,
// start / stop / restart / kill with an "are you sure" for the ones that take
// it down (@xeplr/ui-utils raiseConfirm), each result told by raiseSnackbar,
// and the audit log. No JSX. The selected service and the view are in the URL
// (?service=…&view=…) through @xeplr/ui-utils' useUrlParams, under the app's
// router. An expired sign-in is @xeplr/ui-account's to handle (authFetch).
//
//   api        createMonitorApi()
//   self       the monitor API's own unit, which it will not stop or kill
import { useCallback, useEffect, useMemo, useState } from 'react'
import { raiseConfirm, raiseSnackbar } from '@xeplr/ui-utils'
import { useUrlParams } from '@xeplr/ui-utils/src/url/useUrlState.js'
import { stateOf, needsConfirm, confirmText } from './monitorFormat.js'

const POLL_MS = 5000

export function useMonitorServices({ api, self }) {
  const [list, setList] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const url = useUrlParams()
  const [busy, setBusy] = useState({})                // unit -> action running
  const [adding, setAdding] = useState(null)          // { unit, label, error, busy } while the add form is open
  const [editing, setEditing] = useState(null)        // { unit, label, newUnit, error, busy }
  const [audit, setAudit] = useState(null)

  const load = useCallback(() => api.services().then((l) => { setList(l); setLoadError(null) }).catch((e) => { setLoadError(e.message) }), [api])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const view = url.get('view') === 'audit' ? 'audit' : 'services'
  const selectedUnit = url.get('service')
  const selected = useMemo(() => (list || []).find((s) => s.unit === selectedUnit) || null, [list, selectedUnit])
  // Opening a service or a view adds a history entry, so Back returns to the last one.
  const setUrl = url.set
  const select = useCallback((unit) => setUrl({ service: unit, view: null, tab: null, grep: null, level: null }), [setUrl])
  const showAudit = useCallback(() => setUrl({ view: 'audit', service: null, tab: null, grep: null, level: null }), [setUrl])
  const showServices = useCallback(() => setUrl({ view: null }), [setUrl])

  useEffect(() => {
    if (view !== 'audit') return
    api.audit(300).then(setAudit).catch((e) => { raiseSnackbar(e.message, { design: 'error', duration: 8000 }) })
  }, [view, api])

  // ── actions ───────────────────────────────────────────────────────────
  const run = useCallback(async (unit, action) => {
    setBusy((b) => Object.assign({}, b, { [unit]: action }))
    try {
      const out = await api.act(unit, action)
      setList((l) => (l || []).map((s) => (s.unit === unit ? Object.assign({}, s, { status: out.status }) : s)))
      const s = (list || []).find((x) => x.unit === unit)
      raiseSnackbar((s ? s.label : unit) + ': ' + action + ' done. Now ' + stateOf(out.status).text.toLowerCase() + '.', { design: 'success', duration: 5000 })
    } catch (err) {
      // A refusal (sudo, a timeout) is read slowly: it stays longer.
      raiseSnackbar(err.message, { design: 'error', duration: 12000 })
    } finally {
      setBusy((b) => { const n = Object.assign({}, b); delete n[unit]; return n })
      load()
    }
  }, [api, list, load])

  // Stop, kill and restart ask first; start just runs.
  const ask = useCallback(async (unit, action) => {
    const s = (list || []).find((x) => x.unit === unit)
    if (needsConfirm(action)) {
      const yes = await raiseConfirm(confirmText(action, s ? s.label : unit), {
        confirmLabel: 'Yes, ' + action,
        danger: action === 'kill' || action === 'stop'
      })
      if (!yes) return
    }
    run(unit, action)
  }, [list, run])

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
      setAdding((a) => Object.assign({}, a, { busy: false, error: err.message }))
    }
  }, [api, adding, load, select])

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
      if (s.unit !== editing.unit && selectedUnit === editing.unit) setUrl({ service: s.unit }, { replace: true })
    } catch (err) {
      setEditing((x) => Object.assign({}, x, { busy: false, error: err.message }))
    }
  }, [api, editing, load, selectedUnit, setUrl])
  const removeEditing = useCallback(async () => {
    if (!editing) return
    try {
      await api.removeService(editing.unit)
      setEditing(null)
      if (selectedUnit === editing.unit) setUrl({ service: null }, { replace: true })
      await load()
    } catch (err) {
      setEditing((x) => Object.assign({}, x, { error: err.message }))
    }
  }, [api, editing, load, selectedUnit, setUrl])

  return {
    list, loading: list === null, loadError, reload: load,
    view, showAudit, showServices, audit,
    selected, selectedUnit, select,
    busy, ask, actionsFor,
    adding, openAdd, editAdd, closeAdd, saveAdd,
    editing, openEdit, editEdit, closeEdit, saveEdit, removeEditing
  }
}
