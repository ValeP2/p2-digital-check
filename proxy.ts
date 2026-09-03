import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Öffentlich erreichbar: Login, Auth, geteilte Analyse-Seiten (/a/...), Intake-Webhook
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/forgot-password') ||
    pathname.startsWith('/api/intake') ||
    pathname.startsWith('/api/export-pptx-public') ||
    pathname.startsWith('/a/') ||
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  const session = req.cookies.get('p2-session')?.value
  const authFlag = req.cookies.get('p2-auth')?.value
  // Admin-Login: Passwort direkt. Eingeladene User: p2-auth=1 (gesetzt nach verifyUser)
  const isAuthed = session === process.env.APP_PASSWORD || authFlag === '1'
  if (!isAuthed) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
