import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string }

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Falsches Passwort' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('p2-session', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 Tage
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('p2-session')
  return response
}
