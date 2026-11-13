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

test('the server itself: GB, shares, uptime, how memory divides, what needs a look', async () => {
  const { gb, share, uptimeText, memoryParts, diskState, serverConcerns } = await import('../src/serverFormat.js')
  const G = 1024 * 1024 * 1024
  assert.equal(gb(7.66 * G), '7.66 GB')
  assert.equal(gb(null), '—')
  assert.equal(share(1, 4), 25)
  assert.equal(share(1, 0), null)
  assert.equal(uptimeText(3 * 86400 + 4 * 3600 + 59), '3 days 4 h')
  assert.equal(uptimeText(5 * 3600 + 12 * 60), '5 h 12 min')
  assert.equal(uptimeText(480), '8 min')
  const m = { totalBytes: 8 * G, usedBytes: 3 * G, cacheBytes: 2.5 * G, buffersBytes: 0.5 * G, freeBytes: 2 * G, availableBytes: 4.5 * G, swapTotalBytes: 0, swapUsedBytes: 0 }
  const parts = memoryParts(m)
  assert.deepEqual(parts.map((p) => [p.key, p.percent]), [['used', 38], ['cache', 38], ['free', 24]])
  assert.equal(parts.reduce((a, p) => a + p.percent, 0), 100, 'the bar adds up to the whole')
  assert.deepEqual(diskState({ usedBytes: 95, totalBytes: 100 }), { usedPercent: 95, nearlyFull: true })
  const fine = { linux: true, memory: m, disks: [{ mount: '/', usedBytes: 40, totalBytes: 100, availableBytes: 60 }], cpu: { cores: 4, load: [1, 1, 1] } }
  assert.deepEqual(serverConcerns(fine), [])
  const bad = { linux: true, memory: Object.assign({}, m, { availableBytes: 0.5 * G, swapTotalBytes: 2 * G, swapUsedBytes: 1.5 * G }), disks: [{ mount: '/', usedBytes: 95, totalBytes: 100, availableBytes: 5 }], cpu: { cores: 2, load: [3, 3.5, 2] } }
  assert.equal(serverConcerns(bad).length, 4, serverConcerns(bad).join(' | '))
})

test('what the cache holds: by kind and by whom, each a share of cache & buffers; the rest as Everything else', async () => {
  const { cacheBreakdown } = await import('../src/serverFormat.js')
  const c = cacheBreakdown({
    cacheBytes: 900, buffersBytes: 100,
    cacheKinds: [{ key: 'files', label: 'File contents', bytes: 800 }, { key: 'kernel', label: 'Kernel objects', bytes: 100 }, { key: 'buffers', label: 'Disk buffers', bytes: 100 }],
    cacheBy: { groups: [{ name: 'postgresql.service', bytes: 600 }, { name: 'user.slice', bytes: 150 }], othersBytes: 250 }
  })
  assert.equal(c.wholeBytes, 1000)
  assert.deepEqual(c.kinds.map((k) => [k.key, k.percent]), [['files', 80], ['kernel', 10], ['buffers', 10]])
  assert.match(c.kinds[0].note, /databases, logs/)
  assert.deepEqual(c.groups.map((g) => [g.label, g.unit, g.percent]), [['postgresql', 'postgresql.service', 60], ['People signed in', 'user.slice', 15], ['Everything else', 'the kernel itself, programs since stopped', 25]])
  assert.deepEqual(cacheBreakdown({ cacheBytes: 1, buffersBytes: 0 }), { wholeBytes: 1, kinds: [], groups: [] }, 'an older API: nothing to break down')
  assert.deepEqual(cacheBreakdown(null).kinds, [])
})
