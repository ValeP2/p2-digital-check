import { NextRequest, NextResponse } from 'next/server'
import { verifyUser } from '@/lib/userStore'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json() as { email?: string; password?: string }

  if (!email || !password) {
    return NextResponse.json({ error: 'Fehlende Angaben' }, { status: 400 })
  }

  const user = await verifyUser(email.trim().toLowerCase(), password)
  if (!user) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, email: user.email, isAdmin: user.isAdmin })
  response.cookies.set('p2-session', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  // Email in separatem Cookie für Client-Zugriff
  response.cookies.set('p2-user', email.trim().toLowerCase(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('p2-session')
  response.cookies.delete('p2-user')
  return response
}
