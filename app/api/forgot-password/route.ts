import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Nur diese zwei Adressen dürfen das Passwort anfordern
const ALLOWED = ['vale@p-zwei.ch', 'andreas@p-zwei.ch']

export async function POST() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false }, { status: 500 })

  const resend = new Resend(apiKey)
  const FROM = process.env.MAIL_FROM || 'P2 Digitalcheck <digitalcheck@p-zwei.ch>'
  const pw = process.env.APP_PASSWORD || '(nicht konfiguriert)'

  try {
    await resend.emails.send({
      from: FROM,
      to: ALLOWED,
      subject: 'P2 Digitalcheck – Passwort',
      html: `
        <div style="font-family:Arial,sans-serif;background:#293263;color:#EBEACC;padding:32px;border-radius:12px;max-width:420px">
          <h2 style="color:#EBEACC;margin:0 0 16px">P2/ Digitalcheck</h2>
          <p style="color:rgba(235,234,204,0.7);margin:0 0 8px">Das Passwort für digitalcheck.p-zwei.ch lautet:</p>
          <p style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#EBEACC;background:rgba(255,255,255,0.08);padding:12px 20px;border-radius:8px;margin:16px 0">${pw}</p>
          <a href="https://digitalcheck.p-zwei.ch/login" style="display:inline-block;background:#EBEACC;color:#293263;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:bold;margin-top:8px">Zum Login →</a>
        </div>`,
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
