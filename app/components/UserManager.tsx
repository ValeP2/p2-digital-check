'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { FELD, KNOPF, cn } from './ui'

const ADMINS = ['vale@p-zwei.ch', 'andreas@p-zwei.ch']

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

  const others = users.filter(u => !ADMINS.includes(u.email))
  const Row = ({ email, sub, badge, children }: { email: string; sub?: string; badge?: string; children?: React.ReactNode }) => (
    <div className="group flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#F5F5F7]">
      <span className="w-8 h-8 rounded-full bg-primary/15 text-primary text-[13px] font-semibold flex items-center justify-center shrink-0">{email[0].toUpperCase()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate">{sub ?? email}</p>
        {sub && <p className="text-[12px] text-muted-foreground truncate">{email}</p>}
      </div>
      {badge && <span className="text-[11px] font-medium text-muted-foreground bg-white rounded-xs px-2 py-0.5">{badge}</span>}
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-[18px] font-semibold">Team verwalten</h2>
          <button onClick={onClose} aria-label="Schliessen" className="w-8 h-8 rounded-xs flex items-center justify-center text-muted-foreground hover:bg-black/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-7">
          <div>
            <h3 className="text-[13px] font-semibold text-muted-foreground mb-2.5">Neues Mitglied einladen</h3>
            <form onSubmit={handleInvite} className="space-y-2">
              <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name (optional)" className={FELD} />
              <div className="flex gap-2">
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="E-Mail-Adresse" required className={cn(FELD, 'flex-1')} />
                <button type="submit" disabled={inviting || !inviteEmail} className={KNOPF}>{inviting ? '…' : 'Einladen'}</button>
              </div>
              {inviteMsg && <p className={cn('text-[13px]', inviteMsg.startsWith('✓') ? 'text-good' : 'text-red-600')}>{inviteMsg}</p>}
              <p className="text-[12px] text-muted-foreground leading-relaxed">Die Person bekommt eine Mail mit ihrem Passwort. Gespeichert wird nur ein Hash.</p>
            </form>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-muted-foreground mb-2.5">Mitglieder</h3>
            {loading ? <p className="text-[13px] text-muted-foreground">Wird geladen …</p> : (
              <div className="space-y-1.5">
                {ADMINS.map(email => <Row key={email} email={email} badge="Admin" />)}
                {others.map(user => confirmDelete === user.email ? (
                  <div key={user.email} className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-100">
                    <p className="flex-1 text-[13px] text-red-700">{user.email} entfernen? Der Zugang endet sofort.</p>
                    <button onClick={() => handleDelete(user.email)} className="text-[12px] px-3 py-1.5 rounded-xs font-semibold bg-red-600 text-white">Entfernen</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-[12px] text-muted-foreground">Abbrechen</button>
                  </div>
                ) : (
                  <Row key={user.email} email={user.email} sub={user.name || user.email}>
                    <button onClick={() => setConfirmDelete(user.email)} className="text-[12px] text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">Entfernen</button>
                  </Row>
                ))}
                {others.length === 0 && <p className="text-[13px] text-muted-foreground py-2">Noch keine weiteren Mitglieder.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
