// WHAT A DESIGN MUST HAVE — or it does not load. The check itself is
// @xeplr/ui-utils' useDesignCheck (pages.jsx): after each render, one missing
// element replaces the page with an error naming it, so a custom design that
// dropped the password box or the Restart button fails at once, where its
// author sees it, instead of half-working.
//
// A rule with `when(controller)` is checked only while that holds: the log
// panel is required once a service is selected, not before.

export const LOGIN_RULES = [
  { selector: '#xeplr-monitor-email input', label: 'Email input, inside id="xeplr-monitor-email"', when: (c) => !c.needsCode },
  { selector: '#xeplr-monitor-password input[type="password"]', label: 'Password input, inside id="xeplr-monitor-password"', when: (c) => !c.needsCode },
  { selector: '#xeplr-monitor-code input', label: 'Code input, inside id="xeplr-monitor-code", once the code is asked for', when: (c) => c.needsCode },
  { selector: 'button[type="submit"]', label: 'Submit button (type="submit")' }
]

export const SCREEN_RULES = [
  { selector: '#xeplr-monitor-services', label: 'The services list (id="xeplr-monitor-services")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add', label: 'The "Add a service" button (id="xeplr-monitor-add")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add-unit input', label: 'The service name input, inside id="xeplr-monitor-add-unit", while adding', when: (c) => Boolean(c.adding) },
  { selector: '[data-xeplr-action="restart"]', label: 'A Restart button (data-xeplr-action="restart") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '#xeplr-monitor-log', label: 'The log (id="xeplr-monitor-log") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '#xeplr-monitor-audit', label: 'The audit list (id="xeplr-monitor-audit")', when: (c) => c.view === 'audit' && Boolean(c.audit) }
]
