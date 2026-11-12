// THE SIGN-IN PAGE — presentation only: everything arrives from
// useMonitorLogin. Email and password, then the code when asked. The boxes
// are @xeplr/ui-utils' TextFieldPage (the password one masked).
import { TextFieldPage } from '@xeplr/ui-utils'
import './monitor.css'

export function MonitorLogin({ c, title = 'Xeplr Monitor' }) {
  return (
    <div className="xeplr-monitor xeplr-monitor-login">
      <form className="xeplr-monitor-login-box" onSubmit={c.submit} noValidate>
        <h1 className="xeplr-monitor-login-title">{title}</h1>
        <p className="xeplr-monitor-muted">The servers' services: their state, their logs, and start, stop, restart.</p>
        {!c.needsCode ? (
          <>
            <div id="xeplr-monitor-email" className="xeplr-monitor-field"><TextFieldPage label="Email" value={c.email} onChange={c.setEmail} /></div>
            <div id="xeplr-monitor-password" className="xeplr-monitor-field"><TextFieldPage type="password" label="Password" value={c.password} onChange={c.setPassword} /></div>
          </>
        ) : (
          <>
            <div id="xeplr-monitor-code" className="xeplr-monitor-field"><TextFieldPage label="The six digits your authenticator app shows" maxLength={6} value={c.code} onChange={(v) => c.setCode(String(v).replace(/\D/g, ''))} /></div>
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
