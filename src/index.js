// @xeplr/ui-monitor — the page for @xeplr/monitor: sign in, see the services,
// start / stop / restart / kill, read their logs live. Model, controllers,
// designs and ready-made pages, each usable on its own.
export { createMonitorApi, query } from './monitorApi.js'
export { stateOf, resultText, bytes, ago, clock, keeps, appended, needsConfirm, confirmText } from './monitorFormat.js'
export { readUrl, writeUrl } from './monitorUrl.js'
export { useMonitorSession } from './useMonitorSession.js'
export { useMonitorLogin } from './useMonitorLogin.js'
export { useMonitorServices } from './useMonitorServices.js'
export { useServiceLogs } from './useServiceLogs.js'
export { useDesignCheck, missingFrom, LOGIN_RULES, SCREEN_RULES } from './validateDesign.js'
export { MonitorLogin } from './designs/MonitorLogin.jsx'
export { MonitorScreen } from './designs/MonitorScreen.jsx'
export { MonitorApp, MonitorLoginPage, MonitorPage } from './pages.jsx'
