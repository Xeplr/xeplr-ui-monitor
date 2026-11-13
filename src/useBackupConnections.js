// THE BACKUP CONNECTIONS — the controller for their page: the list, the form
// that adds or edits one, Test and Remove. No JSX. Secrets live only in the
// open form and are dropped the moment it saves or closes; they are never
// logged.
//
//   api   createMonitorApi()
// → { list, loading, error, draft, editing, errors, busy, testing,
//     openAdd, openEdit(c), close, set(field, value), setKind(kind), save(e), test(c), remove(c), reload }
import { useCallback, useEffect, useState } from 'react'
import { raiseConfirm, raiseSnackbar } from '@xeplr/ui-utils'
import { blankDraft, draftOf, withKind, validateDraft, bodyOf } from './connectionsFormat.js'

export function useBackupConnections({ api }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null)       // the open form, or null
  const [editing, setEditing] = useState(null)   // the saved one being edited, or null (adding)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(null)   // the id being tested

  const load = useCallback(() => api.connections().then((l) => { setList(l); setError(null) }).catch((e) => setError(e.message)), [api])
  useEffect(() => { load() }, [load])

  const close = useCallback(() => { setDraft(null); setEditing(null); setErrors({}); setBusy(false) }, [])
  const openAdd = useCallback(() => { setEditing(null); setErrors({}); setDraft(blankDraft()) }, [])
  const openEdit = useCallback((c) => { setEditing(c); setErrors({}); setDraft(draftOf(c)) }, [])
  const set = useCallback((field, value) => {
    setDraft((d) => Object.assign({}, d, { [field]: value }))
    setErrors((e) => { if (!e[field]) return e; const n = Object.assign({}, e); delete n[field]; return n })
  }, [])
  const setKind = useCallback((kind) => { setDraft((d) => withKind(d, kind)); setErrors({}) }, [])

  const save = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!draft || busy) return
    const opts = { editing: Boolean(editing) }
    const found = validateDraft(draft, opts)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const body = bodyOf(draft, opts)
      if (editing) await api.editConnection(editing.id, body)
      else await api.addConnection(body)
      raiseSnackbar((editing ? 'Saved ' : 'Added ') + body.name + '.', { design: 'success', duration: 4000 })
      close()
      load()
    } catch (err) {
      setBusy(false)
      setErrors({ form: err.message })
    }
  }, [api, draft, editing, busy, close, load])

  const test = useCallback(async (c) => {
    setTesting(c.id)
    try {
      const out = await api.testConnection(c.id)
      raiseSnackbar(c.name + ': ' + (out.message || (out.ok ? 'it works' : 'it did not work')), { design: out.ok ? 'success' : 'error', duration: out.ok ? 6000 : 12000 })
    } catch (err) {
      raiseSnackbar(c.name + ': ' + err.message, { design: 'error', duration: 12000 })
    } finally {
      setTesting(null)
    }
  }, [api])

  const remove = useCallback(async (c) => {
    const yes = await raiseConfirm('Remove ' + c.name + '? Jobs using it will fail.', { confirmLabel: 'Yes, remove', danger: true })
    if (!yes) return
    try {
      await api.removeConnection(c.id)
      raiseSnackbar('Removed ' + c.name + '.', { design: 'success', duration: 4000 })
      if (editing && editing.id === c.id) close()
      load()
    } catch (err) {
      // 409: a job still uses it — the server says which.
      raiseSnackbar(err.message, { design: 'error', duration: 12000 })
    }
  }, [api, editing, close, load])

  return { list, loading: !list && !error, error, draft, editing, errors, busy, testing, openAdd, openEdit, close, set, setKind, save, test, remove, reload: load }
}
