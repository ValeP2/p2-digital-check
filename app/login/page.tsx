'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoP2 from '../components/LogoP2'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })
    if (res.ok) { router.push('/') }
    else { setError('Falsches Passwort oder E-Mail nicht gefunden.'); setLoading(false) }
  }

  async function handleForgot() {
    setForgotLoading(true)
    await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    setForgotSent(true)
    setForgotLoading(false)
  }

  const inputStyle = (hasError: boolean) => ({
    background: hasError ? 'rgba(252,165,165,0.15)' : '#EBEACC',
    color: hasError ? '#EBEACC' : '#293263',
    border: hasError ? '1px solid rgba(252,165,165,0.5)' : '1px solid transparent',
    fontFamily: 'inherit',
  })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#293263', color: '#EBEACC' }}>

      <div className="mb-10 text-center">
        <LogoP2 height={32} />
        <div className="text-sm font-medium mt-5" style={{ color: 'rgba(235,234,204,0.5)' }}>
          Digital Check
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        {/* E-Mail */}
        <input
          type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
          placeholder="E-Mail" autoFocus autoComplete="email"
          className="w-full rounded-full px-6 py-3.5 text-sm outline-none"
          style={inputStyle(!!error)}
        />

        {/* Passwort mit Auge */}
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password} onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Passwort" autoComplete="current-password"
            className="w-full rounded-full px-6 py-3.5 text-sm outline-none pr-12"
            style={inputStyle(!!error)}
          />
          <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
            className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-80 transition-opacity"
            style={{ color: error ? 'rgba(252,165,165,0.6)' : 'rgba(41,50,99,0.4)' }}>
            {showPw ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.5 6.5C4.5 8 3 10 3 12c0 0 3.75 6 9 6a9.16 9.16 0 004.5-1.5M9 9a3 3 0 014.24 4.24M21 12s-3.75-6-9-6a8.6 8.6 0 00-3 .53" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Fehlermeldung */}
        {error && (
          <p className="text-xs text-center flex items-center justify-center gap-1.5" style={{ color: '#fca5a5' }}>
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading || !email || !password}
          className="w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(235,234,204,0.15)', color: '#EBEACC', border: '1px solid rgba(235,234,204,0.25)' }}>
          {loading ? 'Wird geprüft…' : 'Anmelden'}
        </button>

        <div className="text-center pt-1">
          {forgotSent ? (
            <p className="text-xs" style={{ color: 'rgba(235,234,204,0.5)' }}>✓ Passwort wurde gesendet.</p>
          ) : (
            <button type="button" onClick={handleForgot} disabled={forgotLoading || !email}
              className="text-xs transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ color: 'rgba(235,234,204,0.35)' }}>
              {forgotLoading ? 'Wird gesendet…' : 'Passwort vergessen?'}
            </button>
          )}
        </div>
      </form>

      <p className="mt-10 text-xs" style={{ color: 'rgba(235,234,204,0.2)' }}>v1.0.0</p>
    </div>
  )
}
