// THE MONITOR'S SETTINGS — the controller: the API's own unit, which it will
// not stop or kill. Any service can be added; roles decide who may. No JSX.
//
//   api  createMonitorApi()
// → { self: string | null, loading, error }
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
    self: (settings && settings.self) || null,
    loading: !settings && !error,
    error
  }
}
