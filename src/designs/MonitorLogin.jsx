// THE SIGN-IN PAGE — presentation only: everything arrives from
// useMonitorLogin. Email and password, then the code when asked.
import './monitor.css'

export function MonitorLogin({ c, title = 'Xeplr Monitor' }) {
  return (
    <div className="xeplr-monitor xeplr-monitor-login">
      <form className="xeplr-monitor-login-box" onSubmit={c.submit} noValidate>
        <h1 className="xeplr-monitor-login-title">{title}</h1>
        <p className="xeplr-monitor-muted">The servers' services: their state, their logs, and start, stop, restart.</p>
        {!c.needsCode ? (
          <>
            <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-email">Email
              <input id="xeplr-monitor-email" type="email" autoComplete="username" value={c.email} onChange={(e) => c.setEmail(e.target.value)} autoFocus />
            </label>
            <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-password">Password
              <input id="xeplr-monitor-password" type="password" autoComplete="current-password" value={c.password} onChange={(e) => c.setPassword(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="xeplr-monitor-field" htmlFor="xeplr-monitor-code">The six digits your authenticator app shows
              <input id="xeplr-monitor-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={c.code} onChange={(e) => c.setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </label>
          </>
        )}
        {c.error ? <p className="xeplr-monitor-bad" role="alert">{c.error}</p> : null}
        <div className="xeplr-monitor-row">
          {c.needsCode ? <button type="button" className="xeplr-monitor-link" onClick={c.back}>Back</button> : <span />}
          <button type="submit" className="xeplr-monitor-primary" disabled={c.busy}>{c.busy ? 'Signing in…' : c.needsCode ? 'Sign in' : 'Continue'}</button>
        </div>
      </form>
    </div>
  )
}
