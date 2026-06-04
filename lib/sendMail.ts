import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null

// Absender: bis p-zwei.ch bei Resend verifiziert ist, Resend-Testdomain nutzen
const FROM = process.env.MAIL_FROM || 'P2 Digitalcheck <onboarding@resend.dev>'
const TO = process.env.MAIL_TO || 'hello@p-zwei.ch'

export async function sendAnalysisMail(opts: {
  companyName: string
  url: string
  score: number
  link: string
}): Promise<boolean> {
  if (!resend) {
    console.log('[sendMail] Kein RESEND_API_KEY – Link wäre:', opts.link)
    return false
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: TO,
      subject: `Digitalcheck fertig: ${opts.companyName} (Score ${opts.score}/10)`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#293263;color:#EBEACC;padding:32px;border-radius:12px;max-width:520px">
          <h2 style="color:#EBEACC;margin:0 0 8px">P2/ Digitalcheck</h2>
          <p style="color:rgba(235,234,204,0.7);margin:0 0 24px">Eine neue Analyse ist fertig.</p>
          <table style="color:#EBEACC;font-size:14px;margin-bottom:24px">
            <tr><td style="padding:4px 16px 4px 0;opacity:0.6">Unternehmen</td><td><strong>${opts.companyName}</strong></td></tr>
            <tr><td style="padding:4px 16px 4px 0;opacity:0.6">Website</td><td>${opts.url}</td></tr>
            <tr><td style="padding:4px 16px 4px 0;opacity:0.6">Gesamtscore</td><td><strong>${opts.score}/10</strong></td></tr>
          </table>
          <a href="${opts.link}" style="display:inline-block;background:#EBEACC;color:#293263;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">Analyse ansehen →</a>
          <p style="color:rgba(235,234,204,0.4);font-size:12px;margin-top:24px">${opts.link}</p>
        </div>`,
    })
    return true
  } catch (e) {
    console.error('[sendMail] Fehler:', e)
    return false
  }
}
