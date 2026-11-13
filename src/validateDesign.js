// WHAT A DESIGN MUST HAVE — or it does not load. The check itself is
// @xeplr/ui-utils' useDesignCheck (pages.jsx): after each render, one missing
// element replaces the page with an error naming it, so a custom design that
// dropped the password box or the Restart button fails at once, where its
// author sees it, instead of half-working.
//
// A rule with `when(controller)` is checked only while that holds: the log
// panel is required once a service is selected, not before.

export const SCREEN_RULES = [
  { selector: '#xeplr-monitor-services', label: 'The services list (id="xeplr-monitor-services")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add', label: 'The "Add a service" button (id="xeplr-monitor-add")', when: (c) => c.view === 'services' },
  { selector: '#xeplr-monitor-add-unit input', label: 'The service name input, inside id="xeplr-monitor-add-unit", while adding', when: (c) => Boolean(c.adding) },
  { selector: '[data-xeplr-action="restart"]', label: 'A Restart button (data-xeplr-action="restart") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '#xeplr-monitor-log', label: 'The log (id="xeplr-monitor-log") for the selected service', when: (c) => Boolean(c.selected) },
  { selector: '#xeplr-monitor-audit', label: 'The audit list (id="xeplr-monitor-audit")', when: (c) => c.view === 'audit' && Boolean(c.audit) }
]

// The Home page: the memory and the disks, once the numbers are in from Linux.
export const SERVER_RULES = [
  { selector: '#xeplr-monitor-memory', label: 'The memory (id="xeplr-monitor-memory")', when: (c) => Boolean(c.stats && c.stats.linux) },
  { selector: '#xeplr-monitor-disks', label: 'The disks (id="xeplr-monitor-disks")', when: (c) => Boolean(c.stats && c.stats.linux) }
]

// The backup connections: the list (once read), the Add button, and the form while it is open.
export const CONNECTION_RULES = [
  { selector: '#xeplr-monitor-connection-add', label: 'The "Add a connection" button (id="xeplr-monitor-connection-add")' },
  { selector: '#xeplr-monitor-connections', label: 'The connections list (id="xeplr-monitor-connections")', when: (c) => Boolean(c.list) },
  { selector: '#xeplr-monitor-connection-form input[type="password"]', label: 'A password-type input for the secrets, inside id="xeplr-monitor-connection-form"', when: (c) => Boolean(c.draft) }
]
