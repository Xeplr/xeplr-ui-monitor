// A DESIGN MUST HAVE WHAT THE MONITOR NEEDS — or it does not load. After each
// render the page checks its design for the elements it requires (by id or
// selector); one missing replaces the page with an error naming it, so a
// custom design that dropped the password box or the Restart button fails
// at once, where its author sees it, instead of half-working.
//
// A rule with `when(controller)` is checked only while that holds: the log
// panel is required once a service is selected, not before.
import { useLayoutEffect, useRef, useState } from 'react'

export const LOGIN_RULES = [
  { selector: '#xeplr-monitor-email', label: 'Email input (id="xeplr-monitor-email")', when: (c) => !c.needsCode },
  { selector: '#xeplr-monitor-password', label: 'Password input (id="xeplr-monitor-password")', when: (c) => !c.needsCode },
  { selector: '#xeplr-monitor-code', label: 'Code input (id="xeplr-monitor-code"), once the code is asked for', when: (c) => c.needsCode },
  { selector: 'button[type="submit"]', label: 'Submit button (type="submit")' }
]

export const SCREEN_RULES = [
  { selector: '#xeplr-monitor-services', label: 'The services list (id="xeplr-monitor-services")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add', label: 'The "Add a service" button (id="xeplr-monitor-add")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add-unit', label: 'The service name input (id="xeplr-monitor-add-unit"), while adding', when: (c) => Boolean(c.adding) },
  { selector: '[data-xeplr-action="restart"]', label: 'A Restart button (data-xeplr-action="restart") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '#xeplr-monitor-log', label: 'The log (id="xeplr-monitor-log") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '[data-xeplr-confirm="yes"]', label: 'The confirm button (data-xeplr-confirm="yes") while asking', when: (c) => Boolean(c.confirm) },
  { selector: '#xeplr-monitor-audit', label: 'The audit list (id="xeplr-monitor-audit")', when: (c) => c.view === 'audit' && Boolean(c.audit) }
]

/** The rules a rendered element breaks, as labels. */
export function missingFrom(root, rules, controller) {
  if (!root) return []
  return rules.filter((r) => (!r.when || r.when(controller)) && !root.querySelector(r.selector)).map((r) => r.label)
}

/**
 * → { ref, missing }. Put `ref` on the element around the design; when
 * `missing` is not empty, render the error instead of the design.
 */
export function useDesignCheck(rules, controller) {
  const ref = useRef(null)
  const [missing, setMissing] = useState([])
  useLayoutEffect(() => {
    if (missing.length) return
    const m = missingFrom(ref.current, rules, controller)
    if (m.length) setMissing(m)
  })
  return { ref, missing }
}
