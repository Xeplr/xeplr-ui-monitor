// THE SERVER ITSELF — the controller for the Home page: its memory, CPU,
// disks and uptime, and the services added to the monitor with what each is
// using, asked again every 5 seconds while the tab is visible. No JSX.
//
//   api          createMonitorApi()
//   monitorPath  where the app's Monitor page is (default /monitor): open(unit) goes there
// → { stats, services, loading, error, servicesError, open(unit), reload }
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const POLL_MS = 5000

export function useServerStats({ api, monitorPath = '/monitor' }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [services, setServices] = useState(null)
  const [servicesError, setServicesError] = useState(null)
  const load = useCallback(() => Promise.all([
    api.host().then((s) => { setStats(s); setError(null) }).catch((e) => setError(e.message)),
    // Separately: someone allowed to see the server but not the services still sees the server.
    api.services().then((l) => { setServices(l); setServicesError(null) }).catch((e) => setServicesError(e.message))
  ]), [api])
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    return () => clearInterval(t)
  }, [load])
  const open = useCallback((unit) => navigate(monitorPath + '?service=' + encodeURIComponent(unit)), [navigate, monitorPath])
  return { stats, services, loading: !stats && !error, error, servicesError, open, reload: load }
}
