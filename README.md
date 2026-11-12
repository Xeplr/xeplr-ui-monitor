# @xeplr/ui-monitor

The **Monitor page** of [`xeplr-monitor`](https://github.com/Xeplr/xeplr-monitor), a xeplr app: see a server's services and how each one is doing, start, stop, restart or kill them, and read their logs live or for a time range. It is one page of an app made by `@xeplr/cli`: **sign-in, the side rail and who may do what are the app's** (`@xeplr/ui-account`, `@xeplr/auth`), not this package's.

It is built on the shared xeplr UI packages rather than its own copies of them:

| From | What the monitor uses it for |
|---|---|
| [`@xeplr/ui-utils`](https://www.npmjs.com/package/@xeplr/ui-utils) `useUrlParams` | What is open (service, log mode, search, level, audit view) lives in the URL |
| `@xeplr/ui-utils` `raiseConfirm` | "Are you sure?" before stop, kill and restart |
| `@xeplr/ui-utils` `raiseSnackbar` | The result of an action, or why it was refused |
| [`@xeplr/ui-account`](https://www.npmjs.com/package/@xeplr/ui-account) `authFetch`, `authEventStream` | Every request, with the app's sign-in token; the live log as server-sent events behind sign-in |
| `@xeplr/ui-utils` `TextFieldPage` | Every text box: adding and editing a service, searching the log |
| `@xeplr/ui-utils` `DropdownPage` | The log level: every line, warnings and errors, errors only |
| `@xeplr/ui-utils` `DateRangePage` (`withTime`) | When to read the log from: a quick preset, a single day, or a From–To range to the minute |
| `@xeplr/ui-utils` `NumberFieldPage` | How many lines to read at most |
| `@xeplr/ui-utils` `useDesignCheck` | A design missing its controls does not load (see below) |
| [`@xeplr/ui-table`](https://www.npmjs.com/package/@xeplr/ui-table) `XeplrTable` | The processes of a service, and the audit log (sorting; filters and pages on the audit log) |

Nothing is the monitor's own copy of a shared piece. `useDesignCheck` and `DateRange`'s `withTime` were added to `@xeplr/ui-utils` (1.1.8), and `authEventStream` to `@xeplr/ui-account` (1.5.2), for it.

Built the xeplr way, so the logic and the look can be swapped separately:

| Layer | Files | |
|---|---|---|
| Model | `monitorApi.js`, `monitorFormat.js` | Requests, and the pure rules: states in words, sizes, CPU %, memory against its limit, what needs a look, times, what a log filter keeps. No React. |
| Controllers | `useMonitorSettings`, `useMonitorServices`, `useServiceLogs` | State and handlers. No JSX. |
| Designs | `designs/MonitorScreen.jsx`, `monitor.css` | Presentation only; everything comes in as props. |
| Pages | `pages.jsx`: `MonitorPage` | Controllers and design wired together, with the design check. |

## Install

```bash
npm i @xeplr/ui-monitor @xeplr/ui-account @xeplr/ui-utils @xeplr/ui-table @tanstack/react-table react-router-dom
```

Peers: `react` 18 or 19, `@xeplr/ui-account`, `@xeplr/ui-utils`, `@xeplr/ui-table`, `@tanstack/react-table` 8, `react-router-dom` 6 or 7. The package ships `src/` with JSX and CSS imports, so it needs a bundler that compiles both (Vite does).

## Use it, in a xeplr app

```jsx
import { authFetch, authEventStream } from '@xeplr/ui-account'
import { createMonitorApi, MonitorPage } from '@xeplr/ui-monitor'

const monitor = createMonitorApi({ fetch: authFetch, stream: authEventStream, base: '/api/monitor' })

<Route path="/monitor" element={<MonitorPage api={monitor} />} />
```

The page sits under the app's router and sign-in (`NavPage`, `ProtectedRoute`). Every request carries the app's token; a route the person's roles do not include answers 403, and the page says so. The API is the app's `/api/monitor` routes (xeplr-monitor's `api/routes/monitor.js`).

Three levels:
1. **As it is:** `<MonitorPage api={monitor} />`.
2. **Your own look:** `<MonitorPage api={monitor} design={MyScreen} />` takes the same controllers.
3. **Your own page:** call the controllers yourself, or the model with no React at all:

```js
const services = await monitor.services()
const stop = monitor.follow('xeplr-bi-api.service', (line) => console.log(line.message))
```

`follow` reads the live log with `authEventStream`, since `EventSource` cannot send the token. After a drop it opens again by itself after 3 seconds; a refusal (4xx), or a problem the server reports, is final.

## A design must have what the monitor needs, or it does not load

After each render, the page checks its design for the elements it requires. If one is missing, the page shows an error naming it **instead of the design**, so a custom design that dropped the services list or the Restart button fails where its author sees it, rather than half-working. The check is `@xeplr/ui-utils`' `useDesignCheck`, run after every render since what is required depends on what is open; the rules are in `validateDesign.js`.

**Monitor (`SCREEN_RULES`):**
- `#xeplr-monitor-services` (the list) and `#xeplr-monitor-add` (the "Add a service" button)
- an `input` inside `#xeplr-monitor-add-unit` while adding
- for the selected service: a `[data-xeplr-action="restart"]` button and `#xeplr-monitor-log`
- `#xeplr-monitor-audit` on the audit view

## What the controllers give a design

**`useMonitorSettings({ api })`:** `allowed` (the patterns of services that may be added, `MONITOR_ALLOW`), `self` (the monitor API's own unit, which it will not stop or kill), `loading`, `error`.

**`useMonitorServices({ api, self })`:**
- **The list:** `list`, `loading`, `loadError`. It is asked again every 5 seconds while the tab is visible.
- **What is open:** `view` (`services` | `audit`), `selected`, `select(unit)`, `showAudit()`, `showServices()`, `audit`.
- **Actions:** `busy[unit]` and `ask(unit, action)`. Stop, kill and restart ask first with `raiseConfirm`; the result, or why it was refused, is shown with `raiseSnackbar`. A design draws neither. `actionsFor(service)` says which actions apply now: start only when it is down, and no stop or kill on the monitor's own service.
- **Adding:** `adding`, `openAdd`, `editAdd`, `saveAdd`, `closeAdd`.
- **Changing one in place:** `editing`, `openEdit`, `editEdit`, `saveEdit`, `removeEditing`, `closeEdit`. The label and the unit can be changed; "Stop watching it" removes it from the list.

**`useServiceLogs({ api, unit })`:**
- **The log:** `mode` (`live` | `history`), `setMode`, `lines` (filtered), `total`, `state` (`loading` | `live` | `reconnecting` | `ready` | `error`), `error`.
- **Filtering:** `grep`, `setGrep`, `level`, `setLevel`. History also has `range: { when, lines }` (`when` is a `DateRange` selection: a whole day from its first moment to its last, a time to the end of its minute, in the reader's time zone, see `spanTimes`), `setRange(patch)` and `readHistory()`.
- **Pausing:** `paused`, `pause()`, `resume()` (adds the `held` lines that arrived meanwhile) and `clear()`.
- **Size:** live keeps the newest 5,000 lines.
- **What runs:** following a log is one `authEventStream` request. Closing it (another service, history, leaving the page) ends the `journalctl` reading it on the server.

## How a service is doing

Each service in the list comes with its `status` and its `processes` (see xeplr-monitor's `api/README.md`). The ready-made screen shows:

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

The page is checked in the real app: xeplr-monitor's `ui/` uses this package.
