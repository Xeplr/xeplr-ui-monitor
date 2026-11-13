// THE MONITOR, READY-MADE — the controllers wired to the design, with the
// design check (@xeplr/ui-utils' useDesignCheck, rules in validateDesign.js)
// around it. It is a page of a xeplr app: the app's @xeplr/ui-account signs
// people in and supplies the router; what is open lives in the URL's query.
//
//   import { authFetch, authEventStream } from '@xeplr/ui-account'
//   const api = createMonitorApi({ fetch: authFetch, stream: authEventStream })
//   <Route path="/monitor" element={<MonitorPage api={api} />} />
//
// A host can pass its own `design` (the same controllers, its own look), or
// use the controllers with its own page, or the model with no React at all.
import { useDesignCheck } from '@xeplr/ui-utils'
import { useMonitorSettings } from './useMonitorSettings.js'
import { useMonitorServices } from './useMonitorServices.js'
import { useServerStats } from './useServerStats.js'
import { useServiceLogs } from './useServiceLogs.js'
import { useBackupConnections } from './useBackupConnections.js'
import { SCREEN_RULES, SERVER_RULES, CONNECTION_RULES } from './validateDesign.js'
import { MonitorScreen } from './designs/MonitorScreen.jsx'
import { ServerScreen } from './designs/ServerScreen.jsx'
import { ConnectionsScreen } from './designs/ConnectionsScreen.jsx'
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

/** The monitor. Props: api (createMonitorApi), design?, title? */
export function MonitorPage({ api, design, title }) {
  const settings = useMonitorSettings({ api })
  const c = useMonitorServices({ api, self: settings.self })
  const logs = useServiceLogs({ api, unit: c.view === 'services' && c.selected ? c.selected.unit : null })
  const check = useDesignCheck(SCREEN_RULES, c)
  const View = design || MonitorScreen
  if (check.missing.length) return <Broken page="MonitorPage" missing={check.missing} />
  return <div ref={check.ref}><View c={c} logs={logs} settings={settings} title={title} /></div>
}

/**
 * The server itself (a Home page): memory in GB, the services added to the
 * monitor with what each uses, CPU, disks, uptime.
 * Props: api (createMonitorApi), monitorPath? ('/monitor': where a service opens), design?, title?
 */
export function ServerPage({ api, monitorPath, design, title }) {
  const s = useServerStats({ api, monitorPath })
  const check = useDesignCheck(SERVER_RULES, s)
  const View = design || ServerScreen
  if (check.missing.length) return <Broken page="ServerPage" missing={check.missing} />
  return <div ref={check.ref}><View s={s} title={title} /></div>
}

/**
 * The logins the backup jobs use: database servers (Postgres, MySQL) and the
 * S3 bucket the dumps go to. Add, edit, test, remove; secrets stored
 * encrypted by the API and never shown again.
 * Props: api (createMonitorApi), design?, title? ('Backup connections')
 */
export function ConnectionsPage({ api, design, title }) {
  const b = useBackupConnections({ api })
  const check = useDesignCheck(CONNECTION_RULES, b)
  const View = design || ConnectionsScreen
  if (check.missing.length) return <Broken page="ConnectionsPage" missing={check.missing} />
  return <div ref={check.ref}><View b={b} title={title} /></div>
}
