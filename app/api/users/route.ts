import { NextRequest, NextResponse } from 'next/server'
import { getAllUsers, saveUser, deleteUser, generatePassword, isAdmin, verifyUser, ADMIN_EMAILS } from '@/lib/userStore'
import { Resend } from 'resend'

// GET: User-Liste (nur Admins)
export async function GET(req: NextRequest) {
  const userEmail = req.cookies.get('p2-user')?.value || ''
  if (!isAdmin(userEmail)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const users = await getAllUsers()
  return NextResponse.json({ users })
}

// POST: User einladen (nur Admins)
export async function POST(req: NextRequest) {
  const userEmail = req.cookies.get('p2-user')?.value || ''
  if (!isAdmin(userEmail)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

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
    password,
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
        <div style="font-family:Arial,sans-serif;background:#293263;color:#EBEACC;padding:32px;border-radius:12px;max-width:480px">
          <h2 style="color:#EBEACC;margin:0 0 8px">P2/ Digitalcheck</h2>
          <p style="color:rgba(235,234,204,0.7);margin:0 0 24px">Du wurdest von ${userEmail} zum P2 Digitalcheck eingeladen.</p>
          <table style="color:#EBEACC;font-size:14px;margin-bottom:24px">
            <tr><td style="padding:4px 16px 4px 0;opacity:0.6">Login</td><td><strong>${targetEmail}</strong></td></tr>
            <tr><td style="padding:4px 16px 4px 0;opacity:0.6">Passwort</td><td><strong style="letter-spacing:1px">${password}</strong></td></tr>
          </table>
          <a href="https://digitalcheck.p-zwei.ch/login" style="display:inline-block;background:#EBEACC;color:#293263;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">Zum Login →</a>
        </div>`,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true, email: targetEmail })
}

// DELETE: User entfernen (nur Admins)
export async function DELETE(req: NextRequest) {
  const userEmail = req.cookies.get('p2-user')?.value || ''
  if (!isAdmin(userEmail)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { email } = await req.json() as { email: string }
  if (!email) return NextResponse.json({ error: 'E-Mail fehlt' }, { status: 400 })
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    return NextResponse.json({ error: 'Admin-Accounts können nicht entfernt werden' }, { status: 400 })
  }

  await deleteUser(email)
  return NextResponse.json({ ok: true })
}
