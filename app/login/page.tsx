'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push('/') }
    else { setError('Falsches Passwort'); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#293263', color: '#EBEACC' }}>

      <div className="mb-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-p2.svg" alt="P2 Logo" style={{ height: '32px', width: 'auto', margin: '0 auto' }} />
        <div className="text-sm font-medium mt-5" style={{ color: 'rgba(235,234,204,0.5)' }}>
          Digital Check
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Passwort" autoFocus
          className="w-full rounded-full px-6 py-3.5 text-sm outline-none mb-3"
          style={{ background: '#EBEACC', color: '#293263', fontFamily: 'inherit' }}
        />
        {error && <p className="text-xs text-center mb-3" style={{ color: '#fca5a5' }}>{error}</p>}
        <button type="submit" disabled={loading || !password}
          className="w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(235,234,204,0.15)', color: '#EBEACC', border: '1px solid rgba(235,234,204,0.25)' }}>
          {loading ? 'Wird geprüft…' : 'Anmelden'}
        </button>
      </form>

      <p className="mt-10 text-xs" style={{ color: 'rgba(235,234,204,0.2)' }}>
        v0.1.0
      </p>
    </div>
  )
}
