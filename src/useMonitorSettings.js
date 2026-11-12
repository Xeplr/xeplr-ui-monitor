// WHAT THIS MONITOR MAY DO — the controller for its settings: which services
// may be added (MONITOR_ALLOW) and the API's own unit, which it will not stop
// or kill. No JSX.
//
//   api  createMonitorApi()
// → { allowed: string[], self: string | null, loading, error }
import { useEffect, useState } from 'react'

export function useMonitorSettings({ api }) {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let live = true
    api.settings().then((s) => { if (live) setSettings(s) }).catch((e) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [api])
  return {
    allowed: (settings && settings.allowed) || [],
    self: (settings && settings.self) || null,
    loading: !settings && !error,
    error
  }
}
