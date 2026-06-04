'use client'

import { useState, useEffect } from 'react'

const CREAM = '#EBEACC'
const CREAM_15 = 'rgba(235,234,204,0.15)'
const CREAM_40 = 'rgba(235,234,204,0.4)'

interface User {
  email: string
  name: string
  createdAt: string
  createdBy: string
}

export default function UserManager({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/users')
    if (res.ok) { const d = await res.json(); setUsers(d.users || []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true); setInviteMsg('')
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    })
    if (res.ok) {
      setInviteMsg(`✓ Einladung an ${inviteEmail} gesendet.`)
      setInviteEmail(''); setInviteName('')
      load()
    } else {
      const d = await res.json()
      setInviteMsg(`Fehler: ${d.error}`)
    }
    setInviting(false)
  }

  async function handleDelete(email: string) {
    const res = await fetch('/api/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) { setConfirmDelete(null); load() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
        style={{ background: '#293263', border: '1px solid rgba(235,234,204,0.15)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(235,234,204,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: CREAM }}>Team verwalten</h2>
          <button onClick={onClose} style={{ color: CREAM_40 }} className="hover:opacity-80 text-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Einladen */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: CREAM }}>Neues Mitglied einladen</h3>
            <form onSubmit={handleInvite} className="space-y-2">
              <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: CREAM_15, color: CREAM, border: '1px solid rgba(235,234,204,0.1)' }} />
              <div className="flex gap-2">
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="E-Mail-Adresse" required
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ background: CREAM_15, color: CREAM, border: '1px solid rgba(235,234,204,0.1)' }} />
                <button type="submit" disabled={inviting || !inviteEmail}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 shrink-0"
                  style={{ background: CREAM, color: '#293263' }}>
                  {inviting ? '…' : 'Einladen'}
                </button>
              </div>
              {inviteMsg && <p className="text-xs" style={{ color: inviteMsg.startsWith('✓') ? '#86efac' : '#fca5a5' }}>{inviteMsg}</p>}
            </form>
          </div>

          {/* User-Liste */}
          <div>
            <h3 className="text-sm font-semibold mb-3" style={{ color: CREAM }}>Aktive Mitglieder</h3>
            {loading ? (
              <p className="text-sm" style={{ color: CREAM_40 }}>Lädt…</p>
            ) : (
              <div className="space-y-1.5">
                {/* Admins (fix) */}
                {['vale@p-zwei.ch', 'andreas@p-zwei.ch'].map(email => (
                  <div key={email} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: CREAM_15 }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(235,234,204,0.25)', color: CREAM }}>
                      {email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: CREAM }}>{email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(235,234,204,0.15)', color: CREAM_40 }}>Admin</span>
                  </div>
                ))}

                {/* Normale User */}
                {users.filter(u => !['vale@p-zwei.ch','andreas@p-zwei.ch'].includes(u.email)).map(user => (
                  <div key={user.email}>
                    {confirmDelete === user.email ? (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <p className="flex-1 text-sm" style={{ color: '#fca5a5' }}>
                          {user.email} wirklich entfernen?
                        </p>
                        <button onClick={() => handleDelete(user.email)}
                          className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: '#ef4444', color: 'white' }}>
                          Ja, entfernen
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="text-xs" style={{ color: CREAM_40 }}>Abbrechen</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl group" style={{ background: CREAM_15 }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: 'rgba(235,234,204,0.15)', color: CREAM }}>
                          {user.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: CREAM }}>{user.name || user.email}</p>
                          <p className="text-xs truncate" style={{ color: CREAM_40 }}>{user.email}</p>
                        </div>
                        <button onClick={() => setConfirmDelete(user.email)}
                          className="text-xs opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                          style={{ color: '#fca5a5' }}>Entfernen</button>
                      </div>
                    )}
                  </div>
                ))}

                {users.filter(u => !['vale@p-zwei.ch','andreas@p-zwei.ch'].includes(u.email)).length === 0 && (
                  <p className="text-sm py-2" style={{ color: CREAM_40 }}>Noch keine weiteren Mitglieder</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
