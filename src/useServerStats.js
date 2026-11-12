// THE SERVER ITSELF — the controller for the Home page: its memory, CPU,
// disks and uptime, asked again every 5 seconds while the tab is visible. No JSX.
//
//   api  createMonitorApi()
// → { stats, loading, error, reload }
import { useCallback, useEffect, useState } from 'react'

const POLL_MS = 5000

export function useServerStats({ api }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(() => api.host().then((s) => { setStats(s); setError(null) }).catch((e) => setError(e.message)), [api])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    return () => clearInterval(t)
  }, [load])
  return { stats, loading: !stats && !error, error, reload: load }
}
