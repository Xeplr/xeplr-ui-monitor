// THE MONITOR, READY-MADE — each controller wired to its design, with the
// design check (validateDesign.js) around it. What is open lives in the URL
// through @xeplr/ui-utils (react-router's search params): MonitorApp brings a
// BrowserRouter when the host has none above it. A host can:
//   1. use <MonitorApp /> as it is (what @xeplr/monitor serves)
//   2. pass its own `design` to a page: the same controllers, its own look
//   3. use the controllers with its own page, or monitorApi with no React
import { useMemo } from 'react'
import { BrowserRouter, useInRouterContext } from 'react-router-dom'
import { createMonitorApi } from './monitorApi.js'
import { useMonitorSession } from './useMonitorSession.js'
import { useMonitorLogin } from './useMonitorLogin.js'
import { useMonitorServices } from './useMonitorServices.js'
import { useServiceLogs } from './useServiceLogs.js'
import { useDesignCheck } from '@xeplr/ui-utils'
import { LOGIN_RULES, SCREEN_RULES } from './validateDesign.js'
import { MonitorLogin } from './designs/MonitorLogin.jsx'
import { MonitorScreen } from './designs/MonitorScreen.jsx'
import './designs/monitor.css'

/** What a design that is missing required elements shows instead of itself. */
function Broken({ page, missing }) {
  return (
    <div className="xeplr-monitor xeplr-monitor-broken" role="alert">
      <h1>{page}: this design cannot be used</h1>
      <p>It is missing what the monitor needs:</p>
      <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
    </div>
  )
}

/** Sign-in. Props: api, onSignedIn, design?, title? */
export function MonitorLoginPage({ api, onSignedIn, design, title }) {
  const c = useMonitorLogin({ api, onSignedIn })
  const check = useDesignCheck(LOGIN_RULES, c)
  const View = design || MonitorLogin
  if (check.missing.length) return <Broken page="MonitorLoginPage" missing={check.missing} />
  return <div ref={check.ref}><View c={c} title={title} /></div>
}

/** The monitor itself, signed in. Props: api, session (useMonitorSession), design?, title? */
export function MonitorPage({ api, session, design, title }) {
  const c = useMonitorServices({ api, self: session.self, onExpired: session.expired })
  const logs = useServiceLogs({ api, unit: c.view === 'services' && c.selected ? c.selected.unit : null, onExpired: session.expired })
  const check = useDesignCheck(SCREEN_RULES, c)
  const View = design || MonitorScreen
  if (check.missing.length) return <Broken page="MonitorPage" missing={check.missing} />
  return <div ref={check.ref}><View c={c} logs={logs} session={session} title={title} /></div>
}

/** Sign-in, then the monitor. Props: base? ('api'), title?, loginDesign?, design? */
export function MonitorApp(props) {
  // Only the query is used, never the path, so the page works under whatever path nginx gives it.
  if (!useInRouterContext()) return <BrowserRouter><MonitorApp {...props} /></BrowserRouter>
  return <SignedInOrNot {...props} />
}

function SignedInOrNot({ base = 'api', title, loginDesign, design }) {
  const api = useMemo(() => createMonitorApi(base), [base])
  const session = useMonitorSession({ api })
  if (session.state === 'checking') return <div className="xeplr-monitor" />
  if (session.state === 'out') return <MonitorLoginPage api={api} onSignedIn={session.signedIn} design={loginDesign} title={title} />
  return <MonitorPage api={api} session={session} design={design} title={title} />
}
