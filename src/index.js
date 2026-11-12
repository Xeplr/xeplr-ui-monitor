// @xeplr/ui-monitor — the Monitor page of a xeplr app (xeplr-monitor): see the
// server's services and how each is doing, start / stop / restart / kill them,
// read their logs live. Sign-in is the app's (@xeplr/ui-account). Model,
// controllers, designs and the ready-made page, each usable on its own.
export { createMonitorApi, query } from './monitorApi.js'
export { stateOf, resultText, bytes, ago, clock, keeps, appended, needsConfirm, confirmText, percent, memoryText, processState, concerns, spanTimes, LEVELS } from './monitorFormat.js'
export { useMonitorSettings } from './useMonitorSettings.js'
export { useMonitorServices } from './useMonitorServices.js'
export { useServiceLogs } from './useServiceLogs.js'
export { SCREEN_RULES } from './validateDesign.js'
export { MonitorScreen } from './designs/MonitorScreen.jsx'
export { MonitorPage } from './pages.jsx'
