// How the monitor says things: a service's state in words, sizes, times, what
// a log filter keeps, and which actions ask "are you sure". Pure functions.
import test from 'node:test'
import assert from 'node:assert'
import { stateOf, resultText, bytes, ago, keeps, appended, needsConfirm, confirmText } from '../src/monitorFormat.js'
import { query } from '../src/monitorApi.js'

test('a service\'s state, in words and a tone', () => {
  assert.deepEqual(stateOf({ exists: true, state: 'active', subState: 'running' }), { text: 'Running', tone: 'good' })
  assert.deepEqual(stateOf({ exists: true, state: 'activating', subState: 'auto-restart' }), { text: 'Restarting by itself', tone: 'busy' })
  assert.deepEqual(stateOf({ exists: true, state: 'failed', result: 'oom-kill' }), { text: 'Failed: out of memory', tone: 'bad' })
  assert.deepEqual(stateOf({ exists: true, state: 'inactive' }), { text: 'Stopped', tone: 'off' })
  assert.deepEqual(stateOf({ exists: false }), { text: 'Not on this server', tone: 'bad' })
  assert.deepEqual(stateOf(null), { text: 'Unknown', tone: 'unknown' })
  assert.equal(resultText('signal'), 'it was killed')
})

test('sizes and times, short', () => {
  assert.equal(bytes(null), '—')
  assert.equal(bytes(512), '512 B')
  assert.equal(bytes(1536 * 1024), '1.5 MB')
  assert.equal(bytes(300 * 1024 * 1024), '300 MB')
  const now = Date.parse('2026-11-11T12:00:00Z')
  assert.equal(ago('2026-11-11T11:59:30Z', now), '30s')
  assert.equal(ago('2026-11-11T11:15:00Z', now), '45 min')
  assert.equal(ago('2026-11-11T09:30:00Z', now), '2 h 30 min')
  assert.equal(ago('2026-11-09T12:00:00Z', now), '2 days')
  assert.equal(ago(null), '—')
})

test('a log filter: words in any case, and a level or worse', () => {
  const lines = [
    { level: 'info', message: 'GET /reports 200' },
    { level: 'warn', message: 'Slow query: 61s' },
    { level: 'error', message: 'Gateway timeout on /sql/run' }
  ]
  assert.deepEqual(lines.filter((l) => keeps(l, 'SQL', '')).map((l) => l.level), ['error'])
  assert.deepEqual(lines.filter((l) => keeps(l, '', 'warn')).map((l) => l.level), ['warn', 'error'])
  assert.deepEqual(lines.filter((l) => keeps(l, '', 'error')).map((l) => l.level), ['error'])
  assert.equal(lines.filter((l) => keeps(l, '', '')).length, 3)
})

test('a live log keeps the newest lines only', () => {
  assert.deepEqual(appended([1, 2, 3], [4, 5], 4), [2, 3, 4, 5])
  assert.deepEqual(appended([], [1], 4), [1])
})

test('taking a service down asks first, in words', () => {
  assert.ok(needsConfirm('stop') && needsConfirm('kill') && needsConfirm('restart'))
  assert.ok(!needsConfirm('start'))
  assert.match(confirmText('kill', 'BI API'), /^Kill BI API\? Every process of it ends at once/)
})

test('a query string of the values that are set', () => {
  assert.equal(query({ lines: 200, grep: 'a b', since: '', until: null }), '?lines=200&grep=a%20b')
  assert.equal(query({}), '')
})
