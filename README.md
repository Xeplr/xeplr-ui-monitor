# @xeplr/ui-monitor

The page for [`@xeplr/monitor`](https://github.com/Xeplr/xeplr-monitor). It lets you sign in, see a server's services and how each one is doing, start, stop, restart or kill them, and read their logs live or for a time range. `@xeplr/monitor` serves it ready-made; this package is for building it, or your own look on top of it.

It is built on the shared xeplr UI packages rather than its own copies of them:

| From | What the monitor uses it for |
|---|---|
| [`@xeplr/ui-utils`](https://www.npmjs.com/package/@xeplr/ui-utils) `useUrlParams` | What is open (service, log mode, search, level, audit view) lives in the URL |
| `@xeplr/ui-utils` `raiseConfirm` | "Are you sure?" before stop, kill and restart |
| `@xeplr/ui-utils` `raiseSnackbar` | The result of an action, or why it was refused |
| `@xeplr/ui-utils` `TextFieldPage` | Every text box: email, password (masked) and code at sign-in, adding and editing a service, searching the log |
| `@xeplr/ui-utils` `DropdownPage` | The log level: every line, warnings and errors, errors only |
| `@xeplr/ui-utils` `DateRangePage` (`withTime`) | When to read the log from: a quick preset, a single day, or a From–To range to the minute |
| `@xeplr/ui-utils` `NumberFieldPage` | How many lines to read at most |
| `@xeplr/ui-utils` `useDesignCheck` | A design missing its controls does not load (see below) |
| [`@xeplr/ui-table`](https://www.npmjs.com/package/@xeplr/ui-table) `XeplrTable` | The processes of a service, and the audit log (sorting; filters and pages on the audit log) |

Nothing is the monitor's own copy of a shared piece. The password type, `useDesignCheck` and `DateRange`'s `withTime` were added to `@xeplr/ui-utils` (1.1.8) for it.

Built the xeplr way, so the logic and the look can be swapped separately:

| Layer | Files | |
|---|---|---|
| Model | `monitorApi.js`, `monitorFormat.js` | Requests, and the pure rules: states in words, sizes, CPU %, memory against its limit, what needs a look, times, what a log filter keeps. No React. |
| Controllers | `useMonitorSession`, `useMonitorLogin`, `useMonitorServices`, `useServiceLogs` | State and handlers. No JSX. |
| Designs | `designs/MonitorLogin.jsx`, `designs/MonitorScreen.jsx`, `monitor.css` | Presentation only; everything comes in as props. Uses `TextFieldPage` and `XeplrTable`. |
| Pages | `pages.jsx`: `MonitorApp`, `MonitorLoginPage`, `MonitorPage` | Controller and design wired together, with the design check. |

## Install

```bash
npm i @xeplr/ui-monitor @xeplr/ui-utils @xeplr/ui-table @tanstack/react-table react-router-dom
```

Peers: `react` 18 or 19, `@xeplr/ui-utils`, `@xeplr/ui-table`, `@tanstack/react-table` 8, `react-router-dom` 6 or 7. The package ships `src/` with JSX and CSS imports, so it needs a bundler that compiles both (Vite does).

## Use it

```jsx
import { MonitorApp } from '@xeplr/ui-monitor'

<MonitorApp base="api" />           // sign-in, then the monitor; base = where @xeplr/monitor's /api is
```

`MonitorApp` brings a `BrowserRouter` when there is none above it, and uses only the query string, so the page works under any path nginx gives it. Inside a host that has a router, it uses the host's. `MonitorPage` on its own needs a router above it (the URL state is react-router's search params).

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

After each render, the page checks its design for the elements it requires. If one is missing, the page shows an error naming it **instead of the design**, so a custom design that dropped the password box or the Restart button fails where its author sees it, rather than half-working. The check is `@xeplr/ui-utils`' `useDesignCheck`, run after every render since what is required depends on what is open; the rules are in `validateDesign.js`.

**Sign-in (`LOGIN_RULES`):**
- an `input` inside `#xeplr-monitor-email`, and an `input[type="password"]` inside `#xeplr-monitor-password`
- an `input` inside `#xeplr-monitor-code`, once the code is asked for
- a `button[type="submit"]`

**Monitor (`SCREEN_RULES`):**
- `#xeplr-monitor-services` (the list) and `#xeplr-monitor-add` (the "Add a service" button)
- an `input` inside `#xeplr-monitor-add-unit` while adding
- for the selected service: a `[data-xeplr-action="restart"]` button and `#xeplr-monitor-log`
- `#xeplr-monitor-audit` on the audit view

## What the controllers give a design

**`useMonitorServices({ api, self, onExpired })`:**
- **The list:** `list`, `loading`, `loadError`. It is asked again every 5 seconds while the tab is visible.
- **What is open:** `view` (`services` | `audit`), `selected`, `select(unit)`, `showAudit()`, `showServices()`, `audit`.
- **Actions:** `busy[unit]` and `ask(unit, action)`. Stop, kill and restart ask first with `raiseConfirm`; the result, or why it was refused, is shown with `raiseSnackbar`. A design draws neither. `actionsFor(service)` says which actions apply now: start only when it is down, and no stop or kill on the monitor's own service.
- **Adding:** `adding`, `openAdd`, `editAdd`, `saveAdd`, `closeAdd`.
- **Changing one in place:** `editing`, `openEdit`, `editEdit`, `saveEdit`, `removeEditing`, `closeEdit`. The label and the unit can be changed; "Stop watching it" removes it from the list.

**`useServiceLogs({ api, unit, onExpired })`:**
- **The log:** `mode` (`live` | `history`), `setMode`, `lines` (filtered), `total`, `state` (`loading` | `live` | `reconnecting` | `ready` | `error`), `error`.
- **Filtering:** `grep`, `setGrep`, `level`, `setLevel`. History also has `range: { when, lines }` (`when` is a `DateRange` selection: a whole day from its first moment to its last, a time to the end of its minute, in the reader's time zone, see `spanTimes`), `setRange(patch)` and `readHistory()`.
- **Pausing:** `paused`, `pause()`, `resume()` (adds the `held` lines that arrived meanwhile) and `clear()`.
- **Size:** live keeps the newest 5,000 lines.
- **What runs:** following a log is one EventSource. Closing it (another service, history, leaving the page) ends the `journalctl` reading it on the server.

**`useMonitorSession({ api })`:** `state` (`checking` | `out` | `in`), `user`, `allowed`, `self`, `signedIn()`, `signOut()`, `expired()`.

**`useMonitorLogin({ api, onSignedIn })`:** `email`, `password`, `code`, their setters, `needsCode`, `error`, `busy`, `submit`, `back`.

## How a service is doing

Each service in the list comes with its `status` and its `processes` (see `@xeplr/monitor`'s API). The ready-made screen shows:

- **In the list:** state, how long, memory, CPU now, and "N to look at" when something needs a look.
- **The facts:** state, running for, main process, **memory against its limit** ("67 MB of 256 MB (26%)"), **memory at most** (its peak), **CPU now** (from two readings; above 100% is more than one core), CPU used in all, **processes and threads** (against the thread cap), **swap**, restarts, how it last ended, whether it restarts by itself, at boot.
- **Needs a look** (`concerns(status, processes)`): memory at 90% of its limit or past `MemoryHigh`, restarts by itself, swap in use, threads near their cap, CPU at 90% or more, processes stuck waiting on disk or network (`D`), zombies (`Z`). When a running service has none, it says so.
- **What runs it:** the command systemd starts, its folder, its user, the unit file.
- **Processes:** every process of the service, the main one first, then by memory: PID, command, memory (and swap), CPU, threads, state in words, running for. A stuck or zombie process is red.

`percent`, `memoryText`, `processState` and `concerns` are exported for a design of your own.

## What is open lives in the URL

`?service=xeplr-bi-api.service&tab=history&grep=timeout&level=warn`, or `?view=audit`, read and written with `@xeplr/ui-utils`' `useUrlParams`. A refresh, or a link sent to someone, opens the same service, log mode and filter. Opening a service or the audit log adds a history entry, so Back returns. Switching live and history, or typing a search, replaces it, so Back is not a keystroke undo.

## Look

Every class starts with `xeplr-monitor-`. The page is dark by default; `data-theme="light"` on `.xeplr-monitor`, or on an ancestor, switches it to light. Colours are CSS variables (`--xm-bg`, `--xm-panel`, `--xm-accent`, `--xm-good`, `--xm-bad`, …) on `.xeplr-monitor`, so a host can override them. The shared pieces' `--xeplr-*` tokens (text box, table) are set from these on `.xeplr-monitor`, so they follow the monitor's theme.

The monitor's defaults for plain `button`, `input` and `select` have zero specificity (`:where`), so the shared components' own classes always win over them.

The confirm and the snackbar are mounted on `<body>`, outside `.xeplr-monitor`, so they use their own dark defaults, or a host's `--xeplr-*` theme (`@xeplr/ui-account`) when one is loaded.

The page uses the full width. Below 760px the list sits above the selected service, and the tables scroll sideways inside their box.

## Development

```bash
npm install
npm test          # the pure rules
```

The screens are checked against a real monitor: see `@xeplr/monitor`'s README, which builds this package's source into its page (`XEPLR_UI_MONITOR_SRC`).
