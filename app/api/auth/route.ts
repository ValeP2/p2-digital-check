import { NextRequest, NextResponse } from 'next/server'
import { verifyUser } from '@/lib/userStore'
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'Fehlende Angaben' }, { status: 400 })
  }

  const normalized = email.trim().toLowerCase()
  const user = await verifyUser(normalized, password)
  if (!user) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
  }

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  }
  const response = NextResponse.json({ ok: true, email: user.email, isAdmin: user.isAdmin })
  // Signierte Session – die einzige Grundlage für Zugriffsrechte
  response.cookies.set(SESSION_COOKIE, createSessionToken(normalized), cookieOpts)
  // Nur zur Anzeige im Client (nicht für Rechte verwendet)
  response.cookies.set('p2-user', normalized, { ...cookieOpts, httpOnly: false })
  // Altes Klartext-Passwort-Cookie entfernen
  response.cookies.delete('p2-session')
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('p2-session')
  response.cookies.delete(SESSION_COOKIE)
  response.cookies.delete('p2-user')
  return response
}
