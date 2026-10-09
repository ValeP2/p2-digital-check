import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { generatePassword, getUser, isAdmin, setPassword } from '@/lib/userStore'
import { redis } from '@/lib/redis'

// Passwort vergessen.
//
// Vorher schickte diese Route bei JEDEM Aufruf das gemeinsame Admin-Passwort
// an beide Admins — eingeladene User bekamen nie ein neues. Jetzt:
// - eingeladener User: neues Passwort an seine eigene Adresse (nur Hash gespeichert)
// - Admin: das Admin-Passwort an genau diese Admin-Adresse
// - unbekannte Adresse: nichts, aber dieselbe Antwort (keine Auskunft darüber,
//   welche Adressen einen Zugang haben)
// Höchstens eine Mail je Adresse in 10 Minuten.

const FROM = process.env.MAIL_FROM || 'P2 Digital Check <digitalcheck@p-zwei.ch>'

function mail(title: string, text: string, secret: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;padding:32px;background:#ffffff;border-radius:20px;border:1px solid #eee;color:#1C1C1E;text-align:center">
      <p style="color:#7B6FEF;font-weight:bold;margin:0 0 12px">P2 Digital Check</p>
      <h2 style="margin:0 0 8px;font-size:20px">${title}</h2>
      <p style="color:#6B7280;margin:0 0 20px;line-height:1.5">${text}</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#F5F5F7;padding:14px 20px;border-radius:12px;margin:0 0 24px;font-family:monospace">${secret}</p>
      <a href="https://digitalcheck.p-zwei.ch/login" style="display:inline-block;background:#1C1C1E;color:#fff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:bold">Zur Anmeldung</a>
    </div>`
}

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({})) as { email?: string }
  const target = email?.trim().toLowerCase() ?? ''
  const ok = NextResponse.json({ ok: true })
  if (!target || !process.env.RESEND_API_KEY) return ok

  if (redis) {
    const fresh = await redis.set(`p2dc:forgot:${target}`, '1', { nx: true, ex: 600 }).catch(() => 'OK')
    if (fresh === null) return ok
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    if (isAdmin(target)) {
      const pw = process.env.APP_PASSWORD
      if (pw) await resend.emails.send({ from: FROM, to: target, subject: 'P2 Digital Check – Admin-Passwort', html: mail('Admin-Passwort', 'Das Passwort für deinen Admin-Zugang:', pw) })
      return ok
    }
    const user = await getUser(target)
    if (!user) return ok
    const pw = generatePassword()
    await setPassword(user, pw)
    await resend.emails.send({ from: FROM, to: target, subject: 'P2 Digital Check – neues Passwort', html: mail('Neues Passwort', 'Du hast ein neues Passwort angefordert. Das bisherige gilt nicht mehr.', pw) })
  } catch (e) {
    console.error('[forgot-password]', e)
  }
  return ok
}
