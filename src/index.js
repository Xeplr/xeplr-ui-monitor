// @xeplr/ui-monitor — the Monitor page of a xeplr app (xeplr-monitor): see the
// server's services and how each is doing, start / stop / restart / kill them,
// read their logs live — and the Server page: the machine's memory in GB, CPU,
// disks and uptime. Sign-in is the app's (@xeplr/ui-account). Model,
// controllers, designs and the ready-made pages, each usable on its own.
export { createMonitorApi, query } from './monitorApi.js'
export { stateOf, resultText, bytes, ago, clock, keeps, appended, needsConfirm, confirmText, percent, memoryText, processState, concerns, spanTimes, LEVELS } from './monitorFormat.js'
export { gb, share, uptimeText, memoryParts, diskState, serverConcerns } from './serverFormat.js'
export { useMonitorSettings } from './useMonitorSettings.js'
export { useServerStats } from './useServerStats.js'
export { useMonitorServices } from './useMonitorServices.js'
export { useServiceLogs } from './useServiceLogs.js'
export { SCREEN_RULES, SERVER_RULES } from './validateDesign.js'
export { MonitorScreen } from './designs/MonitorScreen.jsx'
export { ServerScreen } from './designs/ServerScreen.jsx'
export { MonitorPage, ServerPage } from './pages.jsx'
