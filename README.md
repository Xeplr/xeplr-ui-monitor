# @xeplr/ui-monitor

The page for [`@xeplr/monitor`](https://github.com/Xeplr/xeplr-monitor). It lets you sign in, see a server's services and their state, start, stop, restart or kill them, and read their logs live or for a time range. `@xeplr/monitor` serves it ready-made; this package is for building it, or your own look on top of it.

Built the xeplr way, so the logic and the look can be swapped separately:

| Layer | Files | |
|---|---|---|
| Model | `monitorApi.js`, `monitorFormat.js`, `monitorUrl.js` | Requests, and the pure rules: states in words, sizes, times, what a log filter keeps. No React. |
| Controllers | `useMonitorSession`, `useMonitorLogin`, `useMonitorServices`, `useServiceLogs` | State and handlers. No JSX. |
| Designs | `designs/MonitorLogin.jsx`, `designs/MonitorScreen.jsx`, `monitor.css` | Presentation only; everything comes in as props. |
| Pages | `pages.jsx`: `MonitorApp`, `MonitorLoginPage`, `MonitorPage` | Controller and design wired together, with the design check. |

## Use it

```jsx
import { MonitorApp } from '@xeplr/ui-monitor'

<MonitorApp base="api" />           // sign-in, then the monitor; base = where @xeplr/monitor's /api is
```

You can use it at three levels:
1. **As it is:** `<MonitorApp />`.
2. **Your own look:** `<MonitorPage design={MyScreen} … />` and `<MonitorLoginPage design={MyLogin} … />` take the same controllers.
3. **Your own page:** call the controllers yourself, or use `createMonitorApi()` with no React at all.

```js
import { createMonitorApi } from '@xeplr/ui-monitor'
const api = createMonitorApi('https://monitor.example.com/api')
await api.login({ email, password, code })
const services = await api.services()
const stop = api.follow('xeplr-bi-api.service', (line) => console.log(line.message))
```

## A design must have what the monitor needs, or it does not load

After each render, the page checks its design for the elements it requires. If one is missing, the page shows an error naming it **instead of the design**, so a custom design that dropped the password box or the Restart button fails where its author sees it, rather than half-working (`validateDesign.js`).

**Sign-in (`LOGIN_RULES`):**
- `#xeplr-monitor-email` and `#xeplr-monitor-password`
- `#xeplr-monitor-code`, once the code is asked for
- a `button[type="submit"]`

**Monitor (`SCREEN_RULES`):**
- `#xeplr-monitor-services` (the list) and `#xeplr-monitor-add` (the "Add a service" button)
- `#xeplr-monitor-add-unit` while adding
- for the selected service: a `[data-xeplr-action="restart"]` button and `#xeplr-monitor-log`
- `[data-xeplr-confirm="yes"]` while asking "are you sure"
- `#xeplr-monitor-audit` on the audit view

## What the controllers give a design

**`useMonitorServices({ api, self, onExpired })`:**
- **The list:** `list`, `loading`, `loadError`. It is asked again every 5 seconds while the tab is visible.
- **What is open:** `view` (`services` | `audit`), `selected`, `select(unit)`, `showAudit()`, `showServices()`, `audit`.
- **Actions:** `busy[unit]` and `ask(unit, action)`. Stop, kill and restart set `confirm: { unit, action, text }` first; then `confirmYes()` or `confirmNo()`. `actionsFor(service)` says which actions apply now: start only when it is down, and no stop or kill on the monitor's own service.
- **The result:** `message: { tone, text }` and `clearMessage()`.
- **Adding:** `adding`, `openAdd`, `editAdd`, `saveAdd`, `closeAdd`.
- **Changing one in place:** `editing`, `openEdit`, `editEdit`, `saveEdit`, `removeEditing`, `closeEdit`. The label and the unit can be changed; "Stop watching it" removes it from the list.

**`useServiceLogs({ api, unit, onExpired })`:**
- **The log:** `mode` (`live` | `history`), `setMode`, `lines` (filtered), `total`, `state` (`loading` | `live` | `reconnecting` | `ready` | `error`), `error`.
- **Filtering:** `grep`, `setGrep`, `level`, `setLevel`. History also has `range: { since, until, lines }`, `setRange` and `readHistory()`.
- **Pausing:** `paused`, `pause()`, `resume()` (adds the `held` lines that arrived meanwhile) and `clear()`.
- **Size:** live keeps the newest 5,000 lines.
- **What runs:** following a log is one EventSource. Closing it (another service, history, leaving the page) ends the `journalctl` reading it on the server.

**`useMonitorSession({ api })`:** `state` (`checking` | `out` | `in`), `user`, `allowed`, `self`, `signedIn()`, `signOut()`, `expired()`.

**`useMonitorLogin({ api, onSignedIn })`:** `email`, `password`, `code`, their setters, `needsCode`, `error`, `busy`, `submit`, `back`.

## What is open lives in the URL

`?service=xeplr-bi-api.service&tab=history&grep=timeout&level=warn`, or `?view=audit`. A refresh, or a link sent to someone, opens the same service, log mode and filter. Back goes to the previous service.

## Look

Every class starts with `xeplr-monitor-`. The page is dark by default; `data-theme="light"` on `.xeplr-monitor`, or on an ancestor, switches it to light. Colours are CSS variables (`--xm-bg`, `--xm-panel`, `--xm-accent`, `--xm-good`, `--xm-bad`, …) on `.xeplr-monitor`, so a host can override them. The page uses the full width; below 760px the list sits above the selected service.

## Development

```bash
npm test          # the pure rules
```

The screens are checked against a real monitor: see `@xeplr/monitor`'s README, which builds this package's source into its page (`XEPLR_UI_MONITOR_SRC`).
