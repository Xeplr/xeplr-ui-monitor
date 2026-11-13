// THE BACKUP CONNECTIONS, IN WORDS — pure: no React, no requests. The logins
// the backup jobs use (GET /api/monitor/connections): a database SERVER
// (Postgres or MySQL: host, port, user — the job chooses the database) or an
// Amazon S3 bucket. Secrets never come back from the server: a form for a
// saved one starts with them blank, and blank means "keep the stored one".

export const KINDS = [
  { value: 'postgres', label: 'Postgres', port: 5432 },
  { value: 'mysql', label: 'MySQL', port: 3306 },
  { value: 's3', label: 'Amazon S3' }
]

// The S3 key can only write under backups/ (its IAM policy), so a folder
// outside it would fail on every upload.
export const S3_ROOT = 'backups'
export const DEFAULT_REGION = 'ap-south-1'

const kindOf = (kind) => KINDS.find((k) => k.value === kind) || null
export const isDatabase = (kind) => kind === 'postgres' || kind === 'mysql'

/** "Postgres", "MySQL", "Amazon S3". */
export function kindLabel(kind) {
  const k = kindOf(kind)
  return k ? k.label : String(kind || '—')
}

/** Where it points: "db.example.com:5432", or "my-bucket · ap-south-1 · backups/". */
export function whereText(c) {
  const d = (c && c.details) || {}
  if (c && c.kind === 's3') return [d.bucket, d.region, d.prefix ? String(d.prefix).replace(/\/*$/, '/') : ''].filter(Boolean).join(' · ')
  return d.host ? d.host + (d.port ? ':' + d.port : '') : '—'
}

/** Who it signs in as: the database user, or the access key's hint (masked by the server). */
export function whoText(c) {
  const d = (c && c.details) || {}
  return (c && c.kind === 's3' ? d.accessKeyHint : d.user) || '—'
}

/** A new form, for a kind. */
export function blankDraft(kind = 'postgres') {
  const k = kindOf(kind) || KINDS[0]
  return {
    name: '', kind: k.value,
    host: '', port: k.port ? String(k.port) : '', user: '', password: '',
    bucket: '', region: DEFAULT_REGION, prefix: S3_ROOT, accessKeyId: '', secretAccessKey: ''
  }
}

/** The form for a saved one: its details, the secrets blank (kept unless typed). */
export function draftOf(c) {
  const d = (c && c.details) || {}
  return Object.assign(blankDraft(c.kind), {
    name: c.name || '', kind: c.kind,
    host: d.host || '', port: d.port ? String(d.port) : '', user: d.user || '',
    bucket: d.bucket || '', region: d.region || DEFAULT_REGION, prefix: d.prefix || S3_ROOT
  })
}

/** Another kind chosen in the form: the port follows it unless one was typed. */
export function withKind(draft, kind) {
  const was = kindOf(draft.kind)
  const k = kindOf(kind)
  const typedPort = draft.port && (!was || String(was.port) !== String(draft.port))
  return Object.assign({}, draft, { kind, port: typedPort ? draft.port : (k && k.port ? String(k.port) : '') })
}

const blank = (v) => !String(v === undefined || v === null ? '' : v).trim()

/**
 * What is wrong with the form, by field: {} when it can be saved. A saved
 * one (`editing`) may leave its secrets blank.
 */
export function validateDraft(draft, { editing = false } = {}) {
  const e = {}
  if (blank(draft.name)) e.name = 'Give it a name'
  if (!kindOf(draft.kind)) e.kind = 'Choose Postgres, MySQL or Amazon S3'
  if (isDatabase(draft.kind)) {
    if (blank(draft.host)) e.host = 'The server\'s address'
    else if (/\s|\//.test(String(draft.host).trim())) e.host = 'Only the address, e.g. db.example.com or 10.0.0.5'
    const port = Number(draft.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) e.port = 'A port from 1 to 65535'
    if (blank(draft.user)) e.user = 'The user to sign in as'
    if (!editing && blank(draft.password)) e.password = 'The password (stored encrypted)'
  } else if (draft.kind === 's3') {
    const b = String(draft.bucket || '').trim()
    if (!b) e.bucket = 'The bucket\'s name'
    else if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(b) || /\.\./.test(b)) e.bucket = '3 to 63 characters: lowercase letters, digits, dots and hyphens'
    if (!/^[a-z]{2}-[a-z]+-\d$/.test(String(draft.region || '').trim())) e.region = 'A region such as ap-south-1'
    const p = String(draft.prefix || '').trim().replace(/^\/+/, '')
    if (p !== S3_ROOT && p.indexOf(S3_ROOT + '/') !== 0) e.prefix = 'Starts with "backups" — the key can only write under backups/'
    if (!editing && blank(draft.accessKeyId)) e.accessKeyId = 'The access key ID'
    if (!editing && blank(draft.secretAccessKey)) e.secretAccessKey = 'The secret access key (stored encrypted)'
    if (editing && blank(draft.accessKeyId) !== blank(draft.secretAccessKey)) {
      e[blank(draft.accessKeyId) ? 'accessKeyId' : 'secretAccessKey'] = 'A new key is both: the ID and its secret'
    }
  }
  return e
}

/**
 * What the API is sent: { name, kind, details, secret }. On an edit, blank
 * secrets are left out, so the stored ones stay; no secret at all, none sent.
 */
export function bodyOf(draft, { editing = false } = {}) {
  const t = (v) => String(v === undefined || v === null ? '' : v).trim()
  const body = { name: t(draft.name), kind: draft.kind }
  let secret
  if (isDatabase(draft.kind)) {
    body.details = { host: t(draft.host), port: Number(draft.port), user: t(draft.user) }
    secret = blank(draft.password) ? {} : { password: String(draft.password) }
  } else {
    body.details = { bucket: t(draft.bucket), region: t(draft.region), prefix: t(draft.prefix).replace(/^\/+/, '').replace(/\/+$/, '') }
    secret = {}
    if (!blank(draft.accessKeyId)) secret.accessKeyId = t(draft.accessKeyId)
    if (!blank(draft.secretAccessKey)) secret.secretAccessKey = String(draft.secretAccessKey).trim()
  }
  if (Object.keys(secret).length || !editing) body.secret = secret
  return body
}
