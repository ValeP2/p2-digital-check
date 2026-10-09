'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import LogoP2 from '../components/LogoP2'
import { APP_VERSION } from '../components/AppShell'
import { FELD, KNOPF, cn } from '../components/ui'

// Anmeldung im Kompass-Stil (anmelde-rahmen.tsx): violetter Grund, weisse Karte.

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState<'idle' | 'busy' | 'sent'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (res.ok) { router.push('/'); router.refresh(); return }
      setError(res.status === 401 ? 'E-Mail oder Passwort stimmt nicht.' : 'Anmeldung gerade nicht möglich. Bitte später erneut versuchen.')
    } catch {
      setError('Keine Verbindung. Bitte erneut versuchen.')
    }
    setLoading(false)
  }

  async function handleForgot() {
    if (!email.trim()) { setError('Bitte zuerst die E-Mail-Adresse eingeben.'); return }
    setForgot('busy'); setError('')
    await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) }).catch(() => {})
    setForgot('sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'radial-gradient(circle at 12% 8%, #9C8FFF 0%, #7B6FEF 38%, #5B4FD1 72%, #4238A8 100%)' }}>
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3 justify-center mb-10 text-white">
          <LogoP2 height={28} color="#FFFFFF" />
          <span className="font-semibold text-[17px] pt-1">Digital Check</span>
        </div>

        <div className="bg-white rounded-xl p-8 shadow-xl">
          <h1 className="font-semibold text-[20px] text-foreground mb-1">Anmelden</h1>
          <p className="text-[14px] text-muted-foreground mb-6 leading-relaxed">Websites von KMU prüfen: ein Score, klare Massnahmen.</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="ihre@email.ch" autoComplete="email" autoFocus required className={FELD} aria-label="E-Mail" />
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Passwort" autoComplete="current-password" required className={cn(FELD, 'pr-11')} aria-label="Passwort" />
              <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p role="alert" className="text-[13px] text-red-600 leading-relaxed rounded-lg bg-red-50 border border-red-100 px-3.5 py-2.5">{error}</p>}
            <button type="submit" disabled={loading || !email || !password} className={cn(KNOPF, 'w-full')}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} {loading ? 'Wird geprüft …' : 'Anmelden'}
            </button>
          </form>

          <div className="mt-5 text-center">
            {forgot === 'sent' ? (
              <p className="text-[13px] text-muted-foreground leading-relaxed">Falls ein Zugang zu dieser Adresse besteht, ist ein neues Passwort unterwegs.</p>
            ) : (
              <button onClick={handleForgot} disabled={forgot === 'busy'} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                {forgot === 'busy' ? 'Wird gesendet …' : 'Passwort vergessen?'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[12px] text-white/60 mt-6">© {new Date().getFullYear()} P2/ Kommunikation · Version {APP_VERSION}</p>
      </div>
    </div>
  )
}
