import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveUser, deleteUser, generatePassword, hashPassword, toPublic, ADMIN_EMAILS } from '@/lib/userStore'
import { getActiveUser } from '@/lib/session'
import { Resend } from 'resend'

// GET: User-Liste (nur Admins)
export async function GET(req: NextRequest) {
  const session = await getActiveUser(req)
  if (!session?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const userEmail = session.email
  // Nie Passwörter an den Browser (vorher gingen sie im Klartext mit)
  const users = (await getAllUsers()).map(toPublic)
  return NextResponse.json({ users })
}

// POST: User einladen (nur Admins)
export async function POST(req: NextRequest) {
  const session = await getActiveUser(req)
  if (!session?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const userEmail = session.email

  const { email, name } = await req.json() as { email: string; name?: string }
  if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })

  const targetEmail = email.trim().toLowerCase()

  // Admins können nicht als normale User eingeladen werden
  if (ADMIN_EMAILS.includes(targetEmail)) {
    return NextResponse.json({ error: 'Admin-Accounts brauchen keine Einladung' }, { status: 400 })
  }

  const password = generatePassword()
  await saveUser({
    email: targetEmail,
    passwordHash: await hashPassword(password),
    name: name || targetEmail.split('@')[0],
    createdAt: new Date().toISOString(),
    createdBy: userEmail,
    isAdmin: false,
  })

  // Einladungs-Mail senden
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const resend = new Resend(apiKey)
    const FROM = process.env.MAIL_FROM || 'P2 Digitalcheck <digitalcheck@p-zwei.ch>'
    await resend.emails.send({
      from: FROM,
      to: targetEmail,
      subject: 'Einladung zum P2 Digitalcheck',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;padding:32px;background:#ffffff;border-radius:20px;border:1px solid #eee;color:#1C1C1E;text-align:center">
          <p style="color:#7B6FEF;font-weight:bold;margin:0 0 12px">P2 Digital Check</p>
          <h2 style="margin:0 0 8px;font-size:20px">Einladung</h2>
          <p style="color:#6B7280;margin:0 0 20px;line-height:1.5">${userEmail} hat dich zum P2 Digital Check eingeladen.</p>
          <p style="margin:0 0 6px;color:#6B7280;font-size:13px">Anmeldung mit</p>
          <p style="margin:0 0 14px;font-weight:bold">${targetEmail}</p>
          <p style="font-size:22px;font-weight:bold;letter-spacing:2px;background:#F5F5F7;padding:14px 20px;border-radius:12px;margin:0 0 24px;font-family:monospace">${password}</p>
          <a href="https://digitalcheck.p-zwei.ch/login" style="display:inline-block;background:#1C1C1E;color:#fff;text-decoration:none;padding:12px 24px;border-radius:14px;font-weight:bold">Zur Anmeldung</a>
        </div>`,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true, email: targetEmail })
}

// DELETE: User entfernen (nur Admins)
export async function DELETE(req: NextRequest) {
  const session = await getActiveUser(req)
  if (!session?.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const userEmail = session.email

  const { email } = await req.json() as { email: string }
  if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Admin-Accounts können nicht entfernt werden' }, { status: 400 })
  }

  await deleteUser(email)
  return NextResponse.json({ ok: true })
}
