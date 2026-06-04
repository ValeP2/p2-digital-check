import { NextRequest, NextResponse } from 'next/server'
import { performAnalysis } from '@/lib/performAnalysis'
import { saveAnalysis } from '@/lib/analysisStore'
import { sendAnalysisMail } from '@/lib/sendMail'
import { addCost } from '@/lib/costStore'

export const maxDuration = 300

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

export async function POST(req: NextRequest) {
  // Secret prüfen – Framer sendet es als x-framer-secret oder x-intake-secret
  const secret =
    req.headers.get('x-intake-secret') ||
    req.headers.get('x-framer-secret') ||
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-framer-webhook-secret') ||
    new URL(req.url).searchParams.get('secret')

  if (process.env.INTAKE_SECRET && secret !== process.env.INTAKE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  // URL aus verschiedenen möglichen Feldnamen lesen
  // Framer-Feldname laut Mail: "Website URL"
  const rawUrl = body['Website URL'] || body['website url'] || body['Website-URL'] ||
    body.url || body.URL || body.website || body.Website ||
    body.website_url || body.domain || body.link ||
    Object.values(body).find(v => typeof v === 'string' && (v.startsWith('http') || v.includes('.'))) || ''

  let url = rawUrl.trim()
  if (!url) return NextResponse.json({ error: 'keine url gefunden', body }, { status: 400 })
  if (!url.startsWith('http')) url = `https://${url}`
  try { new URL(url) } catch { return NextResponse.json({ error: 'ungültige url' }, { status: 400 }) }

  const id = randomId()
  const origin = req.headers.get('x-forwarded-host')
    ? `https://${req.headers.get('x-forwarded-host')}`
    : new URL(req.url).origin
  const link = `${origin}/a/${id}`

  try {
    // Analyse synchron durchführen (maxDuration=300s reicht)
    const result = await performAnalysis(url)

    await saveAnalysis({
      id, url,
      companyName: result.companyName,
      date: new Date().toISOString(),
      scores: result.scores,
      report: result.report,
      cost: { chf: result.chf },
    })

    await addCost(parseFloat(result.chf))

    const mailSent = await sendAnalysisMail({
      companyName: result.companyName,
      url,
      score: result.scores.gesamt,
      link,
    })

    return NextResponse.json({
      ok: true, id, link,
      mailSent,
      score: result.scores.gesamt,
      company: result.companyName,
    }, { status: 200 })

  } catch (e) {
    console.error('[intake] Fehler:', e)
    return NextResponse.json({ error: 'analyse fehlgeschlagen', detail: String(e) }, { status: 500 })
  }
}
