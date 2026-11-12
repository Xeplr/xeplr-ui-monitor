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

test('how a service is doing: memory against its limit, CPU, and what needs a look', async () => {
  const { percent, memoryText, concerns, processState } = await import('../src/monitorFormat.js')
  assert.equal(percent(null), '—')
  assert.equal(percent(3.14), '3.1%')
  assert.equal(percent(142.6), '143%')
  const MB = 1024 * 1024
  assert.equal(memoryText({ memoryBytes: 300 * MB, memoryMaxBytes: 1024 * MB }), '300 MB of 1 GB (29%)')
  assert.equal(memoryText({ memoryBytes: 300 * MB, memoryMaxBytes: null }), '300 MB')
  const fine = { state: 'active', memoryBytes: 100 * MB, memoryMaxBytes: 1024 * MB, restarts: 0, swapBytes: 0, cpuPercent: 2 }
  assert.deepEqual(concerns(fine, [{ state: 'S' }]), [])
  const said = concerns({ state: 'active', memoryBytes: 950 * MB, memoryMaxBytes: 1024 * MB, restarts: 3, swapBytes: 0, cpuPercent: 99 }, [{ state: 'D' }, { state: 'Z' }])
  assert.equal(said.length, 5, said.join(' | '))
  assert.match(said[0], /93% of its limit/)
  assert.deepEqual(concerns({ state: 'inactive', restarts: 4 }), [], 'a stopped service has nothing to watch')
  assert.equal(processState('D'), 'stuck on disk or network')
})

test('a picked time span as the times the log is read between', async () => {
  const { spanTimes } = await import('../src/monitorFormat.js')
  const local = (text) => new Date(text).toISOString()
  assert.deepEqual(spanTimes(null), { since: undefined, until: undefined })
  assert.deepEqual(spanTimes({ from: '2026-11-12', to: '2026-11-12' }), { since: local('2026-11-12T00:00:00'), until: local('2026-11-12T23:59:59.999') }, 'a whole day')
  assert.deepEqual(spanTimes({ from: '2026-11-12T09:30', to: '2026-11-12T10:00' }), { since: local('2026-11-12T09:30'), until: local('2026-11-12T10:00:59.999') }, 'to the end of the last minute')
  assert.deepEqual(spanTimes({ from: '2026-11-12T09:30' }), { since: local('2026-11-12T09:30'), until: undefined }, 'open-ended')
})
