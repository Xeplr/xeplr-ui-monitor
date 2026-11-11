// SIGNING IN — the controller: email and password, then the six-digit code
// when the server asks for it. No JSX.
//
//   api          createMonitorApi()
//   onSignedIn   called once signed in
import { useCallback, useState } from 'react'

export function useMonitorLogin({ api, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password')
    if (needsCode && !/^\d{6}$/.test(code.trim())) return setError('Enter the six digits your authenticator app shows')
    setBusy(true)
    setError(null)
    try {
      await api.login({ email: email.trim(), password, code: needsCode ? code.trim() : undefined })
      setPassword('')
      setCode('')
      if (onSignedIn) await onSignedIn()
    } catch (err) {
      if (err.needsCode && !needsCode) { setNeedsCode(true); setError(null) } else setError(err.message)
      if (err.needsCode && needsCode) setCode('')
    } finally {
      setBusy(false)
    }
  }, [api, email, password, code, needsCode, onSignedIn])

  const back = useCallback(() => { setNeedsCode(false); setCode(''); setError(null) }, [])

  return { email, setEmail, password, setPassword, code, setCode, needsCode, error, busy, submit, back }
}
