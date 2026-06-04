import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { performAnalysis } from '@/lib/performAnalysis'
import { saveAnalysis } from '@/lib/analysisStore'
import { sendAnalysisMail } from '@/lib/sendMail'
import { addCost } from '@/lib/costStore'

export const maxDuration = 300

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)
}

export async function POST(req: NextRequest) {
  // Secret prüfen
  const secret =
    req.headers.get('x-intake-secret') ||
    req.headers.get('x-framer-secret') ||
    req.headers.get('x-webhook-secret') ||
    new URL(req.url).searchParams.get('secret')

  if (process.env.INTAKE_SECRET && secret !== process.env.INTAKE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  // URL aus verschiedenen Framer-Feldnamen
  const rawUrl = body['Website URL'] || body['website url'] || body['Website-URL'] ||
    body.url || body.URL || body.website || body.Website || body.website_url || body.domain ||
    Object.values(body).find(v => typeof v === 'string' && (v.startsWith('http') || v.includes('.'))) || ''

  let url = rawUrl.trim()
  if (!url) return NextResponse.json({ error: 'keine url', body }, { status: 400 })
  if (!url.startsWith('http')) url = `https://${url}`
  try { new URL(url) } catch { return NextResponse.json({ error: 'ungültige url' }, { status: 400 }) }

  const id = randomId()
  const origin = req.headers.get('x-forwarded-proto') && req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`
    : 'https://digitalcheck.p-zwei.ch'
  const link = `${origin}/a/${id}`

  // Sofort 200 antworten – Framer braucht keine lange Wartezeit
  // Analyse läuft im Hintergrund via after()
  after(async () => {
    try {
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
      await sendAnalysisMail({ companyName: result.companyName, url, score: result.scores.gesamt, link })
    } catch (e) {
      console.error('[intake] Hintergrund-Analyse fehlgeschlagen:', e)
    }
  })

  return NextResponse.json({ ok: true, id, link }, { status: 202 })
}
