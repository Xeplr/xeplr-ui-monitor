// THE MONITOR'S API, FROM A PAGE — the model: requests only, no React.
//
// `base` is where @xeplr/monitor's routes are: 'api' (the default, relative,
// so the page works under any path nginx gives it) or a full URL. Every
// change carries x-xeplr-monitor: 1, which the server requires; the sign-in
// cookie travels by itself (same site).
//
//   const api = createMonitorApi()
//   await api.login({ email, password, code })
//   await api.services()
//   const stop = api.follow('xeplr-bi-api.service', (line) => …, (problem) => …)

export function createMonitorApi(base = 'api', fetchImpl) {
  const root = String(base).replace(/\/+$/, '')
  const doFetch = fetchImpl || ((...a) => fetch(...a))
  const url = (path) => root + path

  async function call(method, path, body) {
    const res = await doFetch(url(path), {
      method,
      credentials: 'same-origin',
      headers: Object.assign({ Accept: 'application/json' }, method === 'GET' ? {} : { 'Content-Type': 'application/json', 'x-xeplr-monitor': '1' }),
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    let data = null
    try { data = await res.json() } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || messageFor(res.status))
      err.status = res.status
      err.needsCode = Boolean(data && data.needsCode)
      throw err
    }
    return data
  }

  const unit = (u) => '/services/' + encodeURIComponent(u)

  return {
    login: ({ email, password, code }) => call('POST', '/login', { email, password, code: code || undefined }),
    logout: () => call('POST', '/logout', {}),
    me: () => call('GET', '/me'),
    services: () => call('GET', '/services'),
    addService: ({ unit: u, label }) => call('POST', '/services', { unit: u, label }),
    editService: (u, patch) => call('PATCH', unit(u), patch),
    removeService: (u) => call('DELETE', unit(u)),
    act: (u, action) => call('POST', unit(u) + '/' + action, {}),
    logs: (u, q = {}) => call('GET', unit(u) + '/logs' + query(q)).then((r) => r.lines),
    audit: (limit) => call('GET', '/audit' + query({ limit })).then((r) => r.entries),

    /** Follow a service's log as it is written. → stop(). Reconnects by itself (EventSource) after a drop. */
    follow(u, onLine, onProblem, onOpen) {
      const es = new EventSource(url(unit(u) + '/logs/live'), { withCredentials: true })
      es.onmessage = (e) => { try { onLine(JSON.parse(e.data)) } catch (err) { /* not a line */ } }
      es.addEventListener('ready', () => { if (onOpen) onOpen() })
      es.addEventListener('problem', (e) => { try { onProblem && onProblem(JSON.parse(e.data).error) } catch (err) { /* ignore */ } })
      es.onerror = () => { if (onProblem) onProblem(es.readyState === EventSource.CLOSED ? 'The live log stopped. Open it again' : null) }
      return () => es.close()
    }
  }
}

/** The query string of the values that are set. */
export function query(q) {
  const parts = Object.keys(q || {}).filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== '').map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k]))
  return parts.length ? '?' + parts.join('&') : ''
}

function messageFor(status) {
  if (status === 401) return 'Sign in first'
  if (status === 502 || status === 503 || status === 504) return 'The monitor is not answering (' + status + ')'
  return 'Something went wrong (' + status + ')'
}
