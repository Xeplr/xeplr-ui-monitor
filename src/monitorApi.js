// THE MONITOR'S API, FROM A PAGE — the model: requests only, no React.
//
// Inside a xeplr app, every request goes through @xeplr/ui-account, which
// carries the sign-in token and refreshes it:
//
//   import { authFetch, authEventStream } from '@xeplr/ui-account'
//   const api = createMonitorApi({ fetch: authFetch, stream: authEventStream, base: '/api/monitor' })
//
// `fetch(path, options)` resolves to the parsed JSON and throws an Error
// (with .status) on a refusal; `stream(path, { onOpen, onEvent, onError })`
// returns close(). Those are authFetch's and authEventStream's contracts.

const RECONNECT_MS = 3000

export function createMonitorApi({ fetch: call, stream, base = '/api/monitor' } = {}) {
  if (typeof call !== 'function') throw new Error('createMonitorApi: pass { fetch: authFetch } from @xeplr/ui-account')
  const root = String(base).replace(/\/+$/, '')
  const json = (method, path, body) => call(root + path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
  const unit = (u) => '/services/' + encodeURIComponent(u)

  return {
    settings: () => json('GET', '/settings'),
    services: () => json('GET', '/services'),
    addService: ({ unit: u, label }) => json('POST', '/services', { unit: u, label }),
    editService: (u, patch) => json('PATCH', unit(u), patch),
    removeService: (u) => json('DELETE', unit(u)),
    act: (u, action) => json('POST', unit(u) + '/' + action, {}),
    logs: (u, q = {}) => json('GET', unit(u) + '/logs' + query(q)).then((r) => r.lines),
    audit: (limit) => json('GET', '/audit' + query({ limit })).then((r) => r.entries),

    /**
     * Follow a service's log as it is written. → stop(). After a drop it
     * opens again by itself (onProblem(null) meanwhile); a refusal (4xx) or
     * a problem the server reports is final (onProblem(message)).
     */
    follow(u, onLine, onProblem, onOpen) {
      if (typeof stream !== 'function') throw new Error('createMonitorApi: pass { stream: authEventStream } from @xeplr/ui-account to follow a log live')
      let stopped = false
      let close = null
      let retry = null
      const open = () => {
        close = stream(root + unit(u) + '/logs/live', {
          onOpen: () => { if (onOpen) onOpen() },
          onEvent: ({ event, data }) => {
            if (event === 'message') { try { onLine(JSON.parse(data)) } catch (e) { /* not a line */ } }
            else if (event === 'problem') { try { onProblem && onProblem(JSON.parse(data).error) } catch (e) { /* ignore */ } }
          },
          onError: (err) => {
            if (stopped) return
            if (err && err.status >= 400 && err.status < 500) { if (onProblem) onProblem(err.message); return }
            if (onProblem) onProblem(null)
            retry = setTimeout(open, RECONNECT_MS)
          }
        })
      }
      open()
      return () => { stopped = true; clearTimeout(retry); if (close) close() }
    }
  }
}

/** The query string of the values that are set. */
export function query(q) {
  const parts = Object.keys(q || {}).filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== '').map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k]))
  return parts.length ? '?' + parts.join('&') : ''
}
