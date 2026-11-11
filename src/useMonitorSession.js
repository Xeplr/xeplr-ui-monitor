// WHO IS SIGNED IN — the controller that decides between the sign-in page and
// the monitor. No JSX.
//
//   api        createMonitorApi()
// → { state: 'checking' | 'out' | 'in', user, allowed, self, signedIn(user), signOut() }
import { useCallback, useEffect, useState } from 'react'

export function useMonitorSession({ api }) {
  const [state, setState] = useState('checking')
  const [me, setMe] = useState(null)

  const check = useCallback(() => {
    return api.me().then((m) => { setMe(m); setState('in') }).catch(() => { setMe(null); setState('out') })
  }, [api])
  useEffect(() => { check() }, [check])

  const signedIn = useCallback(() => check(), [check])
  const signOut = useCallback(async () => {
    try { await api.logout() } catch (e) { /* signed out either way */ }
    setMe(null)
    setState('out')
  }, [api])

  return {
    state,
    user: me && me.user,
    allowed: (me && me.allowed) || [],
    self: (me && me.self) || null,
    signedIn,
    signOut,
    // A request answered 401 mid-session (expired, or the password changed elsewhere).
    expired: useCallback(() => { setMe(null); setState('out') }, [])
  }
}
