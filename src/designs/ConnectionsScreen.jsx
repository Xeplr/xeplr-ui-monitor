// THE BACKUP CONNECTIONS — presentation only. Everything arrives as props:
//   b   useBackupConnections: { list, loading, error, draft, editing, errors, busy, testing, … }
//
// The logins the backup jobs use: a database server (Postgres, MySQL — the
// job chooses which database) or an Amazon S3 bucket. A list with Test, Edit
// and Remove; Add and Edit open one form. Secrets are typed, never shown.
import { XeplrTable } from '@xeplr/ui-table'
import { KINDS, kindLabel, whereText, whoText, isDatabase } from '../connectionsFormat.js'
import { ago } from '../monitorFormat.js'
import './monitor.css'

export function ConnectionsScreen({ b, title = 'Backup connections' }) {
  return (
    <div className="xeplr-monitor">
      <header className="xeplr-monitor-top">
        <b className="xeplr-monitor-brand">{title}</b>
        <span className="xeplr-monitor-grow" />
        <button type="button" id="xeplr-monitor-connection-add" className="xeplr-monitor-primary" onClick={b.openAdd}>+ Add a connection</button>
      </header>
      <div className="xeplr-monitor-body is-one">
        <p className="xeplr-monitor-muted">Logins the backup jobs use. Passwords and keys are stored encrypted and never shown again.</p>
        {b.error ? <p className="xeplr-monitor-bad" role="alert">{b.error}</p> : null}
        {b.loading ? <p className="xeplr-monitor-muted">Reading…</p> : null}
        {b.list ? <List b={b} /> : null}
      </div>
      {b.draft ? <Form b={b} /> : null}
    </div>
  )
}

function List({ b }) {
  if (!b.list.length) return <section id="xeplr-monitor-connections" className="xeplr-monitor-card"><p className="xeplr-monitor-muted">None yet. Add the database servers to back up, and the S3 bucket they go to.</p></section>
  const columns = [
    { accessor: 'name', header: 'Name', cell: (r) => <b>{r.row.original.name}</b> },
    { accessor: 'kind', header: 'Kind', cell: (r) => kindLabel(r.row.original.kind) },
    { accessor: 'where', header: 'Where', cell: (r) => <code>{whereText(r.row.original)}</code> },
    { accessor: 'who', header: 'Signs in as', cell: (r) => whoText(r.row.original) },
    { accessor: 'secret', header: 'Secret', cell: (r) => r.row.original.hasSecret ? <span className="xeplr-monitor-pill">🔒 stored</span> : <span className="xeplr-monitor-bad">missing</span> },
    { accessor: 'changed', header: 'Last changed', cell: (r) => { const x = r.row.original; return <span title={x.addedBy ? 'Added by ' + x.addedBy : ''}>{x.recordModifiedDate ? ago(x.recordModifiedDate) : '—'}</span> } },
    { accessor: 'actions', header: '', cell: (r) => { const x = r.row.original; return (
      <span className="xeplr-monitor-actions">
        <button type="button" data-xeplr-action="test" disabled={b.testing === x.id} onClick={() => b.test(x)}>{b.testing === x.id ? 'Testing…' : 'Test'}</button>
        <button type="button" className="xeplr-monitor-link" onClick={() => b.openEdit(x)}>Edit</button>
        <button type="button" className="xeplr-monitor-link is-danger" onClick={() => b.remove(x)}>Remove</button>
      </span>
    ) } }
  ]
  return (
    <section id="xeplr-monitor-connections" className="xeplr-monitor-card">
      <div className="xeplr-monitor-tablebox">
        <XeplrTable data={b.list} schema={{ 0: { key: 'connections', columns } }} enableFiltering={false} enablePagination={false} showToolbar={false} />
      </div>
    </section>
  )
}

/** One field: a label, the input, its problem. Plain inputs, so passwords never autofill a saved login. */
function Field({ b, name, label, type = 'text', placeholder, help, inputMode }) {
  const err = b.errors[name]
  const secret = type === 'password'
  return (
    <label className="xeplr-monitor-field">
      {label}
      <input
        name={name} type={type} value={b.draft[name]} placeholder={placeholder} inputMode={inputMode}
        autoComplete={secret ? 'new-password' : 'off'} spellCheck={false} aria-invalid={Boolean(err)}
        onChange={(e) => b.set(name, e.target.value)}
      />
      {err ? <span className="xeplr-monitor-bad xeplr-monitor-small" role="alert">{err}</span> : help ? <span className="xeplr-monitor-small">{help}</span> : null}
    </label>
  )
}

function Form({ b }) {
  const d = b.draft
  const editing = Boolean(b.editing)
  const keep = editing ? 'unchanged — type to replace' : undefined
  const title = editing ? 'Edit ' + b.editing.name : 'Add a connection'
  return (
    <div className="xeplr-monitor-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) b.close() }}>
      <div className="xeplr-monitor-window" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape') b.close() }}>
        <h2>{title}</h2>
        <form id="xeplr-monitor-connection-form" onSubmit={b.save} noValidate>
          <Field b={b} name="name" label="Name" placeholder="e.g. Main Postgres, or Backups bucket" />
          <label className="xeplr-monitor-field">
            Kind
            <select name="kind" value={d.kind} disabled={editing} onChange={(e) => b.setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          {isDatabase(d.kind) ? (
            <>
              <div className="xeplr-monitor-field-pair">
                <Field b={b} name="host" label="Host" placeholder="db.example.com" />
                <Field b={b} name="port" label="Port" inputMode="numeric" />
              </div>
              <Field b={b} name="user" label="User" />
              <Field b={b} name="password" label="Password" type="password" placeholder={keep} />
              <p className="xeplr-monitor-muted xeplr-monitor-small">The server only: each backup job chooses which of its databases to back up.</p>
            </>
          ) : (
            <>
              <div className="xeplr-monitor-field-pair">
                <Field b={b} name="bucket" label="Bucket" placeholder="xeplr-db-backups-…" />
                <Field b={b} name="region" label="Region" />
              </div>
              <Field b={b} name="prefix" label="Folder" help="Starts with backups — the key can only write under backups/." />
              <Field b={b} name="accessKeyId" label="Access key ID" type="password" placeholder={keep} />
              <Field b={b} name="secretAccessKey" label="Secret access key" type="password" placeholder={keep} />
            </>
          )}
          {b.errors.form ? <p className="xeplr-monitor-bad" role="alert">{b.errors.form}</p> : null}
          <div className="xeplr-monitor-row">
            {editing ? <button type="button" className="xeplr-monitor-link is-danger" onClick={() => b.remove(b.editing)}>Remove</button> : <span />}
            <span className="xeplr-monitor-row-right">
              <button type="button" onClick={b.close}>Cancel</button>
              <button type="submit" className="xeplr-monitor-primary" disabled={b.busy}>{b.busy ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
