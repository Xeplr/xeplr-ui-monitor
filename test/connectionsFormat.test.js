// The backup connections in words: kinds, where each points, the form for a
// new or saved one, what is wrong with it, and what is sent — secrets left
// out on an edit unless typed. Pure functions.
import test from 'node:test'
import assert from 'node:assert'
import { KINDS, kindLabel, whereText, whoText, blankDraft, draftOf, withKind, validateDraft, bodyOf } from '../src/connectionsFormat.js'

const PG = { id: 'c1', name: 'Main', kind: 'postgres', details: { host: 'db.local', port: 5432, user: 'backup' }, hasSecret: true }
const S3 = { id: 'c2', name: 'Bucket', kind: 's3', details: { bucket: 'xeplr-db-backups-x', region: 'ap-south-1', prefix: 'backups', accessKeyHint: 'AKIA…XYZ1' }, hasSecret: true }

test('kinds and where each points, in words', () => {
  assert.deepEqual(KINDS.map((k) => k.label), ['Postgres', 'MySQL', 'Amazon S3'])
  assert.equal(kindLabel('mysql'), 'MySQL')
  assert.equal(whereText(PG), 'db.local:5432')
  assert.equal(whoText(PG), 'backup')
  assert.equal(whereText(S3), 'xeplr-db-backups-x · ap-south-1 · backups/')
  assert.equal(whoText(S3), 'AKIA…XYZ1')
})

test('a new form: port and region by default; the port follows the kind unless typed', () => {
  const d = blankDraft()
  assert.deepEqual([d.kind, d.port, d.region, d.prefix], ['postgres', '5432', 'ap-south-1', 'backups'])
  assert.equal(withKind(d, 'mysql').port, '3306')
  assert.equal(withKind(Object.assign({}, d, { port: '6543' }), 'mysql').port, '6543', 'a typed port stays')
})

test('a saved one\'s form: its details, the secrets blank', () => {
  const d = draftOf(PG)
  assert.deepEqual([d.name, d.host, d.port, d.user, d.password], ['Main', 'db.local', '5432', 'backup', ''])
  assert.deepEqual([draftOf(S3).accessKeyId, draftOf(S3).secretAccessKey], ['', ''], 'the key never comes back: blank')
})

test('what is wrong with the form', () => {
  const pg = Object.assign(blankDraft('postgres'), { name: 'Main', host: 'db.local', user: 'backup', password: 'p' })
  assert.deepEqual(validateDraft(pg), {})
  assert.deepEqual(Object.keys(validateDraft(Object.assign({}, pg, { password: '' }))), ['password'], 'a new one needs its password')
  assert.deepEqual(validateDraft(Object.assign({}, pg, { password: '' }), { editing: true }), {}, 'a saved one keeps it')
  assert.ok(validateDraft(Object.assign({}, pg, { port: '70000' })).port)
  assert.ok(validateDraft(Object.assign({}, pg, { port: 'x' })).port)
  assert.ok(validateDraft(Object.assign({}, pg, { host: 'http://db/x' })).host)
  assert.deepEqual(Object.keys(validateDraft(blankDraft())).sort(), ['host', 'name', 'password', 'user'])

  const s3 = Object.assign(blankDraft('s3'), { name: 'B', bucket: 'xeplr-db-backups-x', accessKeyId: 'AKIA1', secretAccessKey: 's' })
  assert.deepEqual(validateDraft(s3), {})
  assert.ok(validateDraft(Object.assign({}, s3, { bucket: 'My_Bucket' })).bucket, 'uppercase and underscores')
  assert.ok(validateDraft(Object.assign({}, s3, { bucket: 'ab' })).bucket, 'too short')
  assert.match(validateDraft(Object.assign({}, s3, { prefix: 'dumps' })).prefix, /backups\//)
  assert.deepEqual(validateDraft(Object.assign({}, s3, { prefix: 'backups/ga' })), {})
  assert.ok(validateDraft(Object.assign({}, s3, { region: 'Mumbai' })).region)
  assert.deepEqual(validateDraft(Object.assign({}, s3, { accessKeyId: '', secretAccessKey: '' }), { editing: true }), {}, 'a saved key kept')
  assert.ok(validateDraft(Object.assign({}, s3, { accessKeyId: 'AKIA2', secretAccessKey: '' }), { editing: true }).secretAccessKey, 'a new key is both halves')
})

test('what is sent: details, and secrets only when typed on an edit', () => {
  const pg = Object.assign(draftOf(PG), { password: 'new' })
  assert.deepEqual(bodyOf(pg, { editing: true }), { name: 'Main', kind: 'postgres', details: { host: 'db.local', port: 5432, user: 'backup' }, secret: { password: 'new' } })
  assert.equal('secret' in bodyOf(draftOf(PG), { editing: true }), false, 'nothing typed: nothing sent, the stored one kept')
  assert.equal('database' in bodyOf(pg).details, false, 'a server login: the job chooses the database')
  const s3 = Object.assign(draftOf(S3), { prefix: '/backups/ga/', accessKeyId: ' AKIA2 ', secretAccessKey: 'sec' })
  assert.deepEqual(bodyOf(s3), { name: 'Bucket', kind: 's3', details: { bucket: 'xeplr-db-backups-x', region: 'ap-south-1', prefix: 'backups/ga' }, secret: { accessKeyId: 'AKIA2', secretAccessKey: 'sec' } })
})
