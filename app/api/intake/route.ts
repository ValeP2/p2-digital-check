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
  // Secret prüfen (Header "x-intake-secret" oder ?secret=)
  const secret = req.headers.get('x-intake-secret') || new URL(req.url).searchParams.get('secret')
  if (!process.env.INTAKE_SECRET || secret !== process.env.INTAKE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  let url = (body.url || '').trim()
  if (!url) return NextResponse.json({ error: 'keine url im formular' }, { status: 400 })
  if (!url.startsWith('http')) url = `https://${url}`
  try { new URL(url) } catch { return NextResponse.json({ error: 'ungültige url' }, { status: 400 }) }

  const id = randomId()
  const origin = new URL(req.url).origin
  const link = `${origin}/a/${id}`

  // Sofort antworten, Analyse läuft im Hintergrund weiter
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
      console.error('[intake] Analyse fehlgeschlagen:', e)
    }
  })

  return NextResponse.json({ ok: true, id, link }, { status: 202 })
}
