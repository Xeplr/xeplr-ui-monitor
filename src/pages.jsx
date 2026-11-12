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
import { useServiceLogs } from './useServiceLogs.js'
import { SCREEN_RULES } from './validateDesign.js'
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
