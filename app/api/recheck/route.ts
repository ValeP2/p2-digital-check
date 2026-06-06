import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { crawlWebsite } from '@/lib/crawler'
import { buildPrompt } from '@/lib/prompt'
import { verifyUser } from '@/lib/userStore'

export const maxDuration = 250

const MODEL = 'claude-sonnet-4-6' // Sonnet für konsistentere Scores
const SCORE_KEYS = ['positionierung','angebot','zielgruppe','vertrauen','conversion','seo','navigation','sprache','technik','externe_sichtbarkeit','gesamt'] as const

export async function POST(req: NextRequest) {
  // Auth: Admin-Passwort oder eingeladener User
  const session = req.cookies.get('p2-session')?.value
  const userEmail = req.cookies.get('p2-user')?.value || ''
  const isValidSession = session === process.env.APP_PASSWORD ||
    (userEmail && await verifyUser(userEmail, session || '').then(u => !!u).catch(() => false))
  if (!isValidSession) return new Response('Unauthorized', { status: 401 })

  const { url } = await req.json() as { url: string }
  if (!url) return NextResponse.json({ error: 'keine url' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const crawlData = await crawlWebsite(url)
    const prompt = buildPrompt(crawlData)

    const SCORE_SYSTEM = `Du bewertest Websites nach fixen, messbaren Kriterien. Antworte NUR mit JSON.

SCORING-KRITERIEN (strikt einhalten – gleiche Seite = gleiche Punkte):
- 1-2: Kritisch fehlend (kein Inhalt / komplett nicht vorhanden)
- 3-4: Stark verbesserungsbedürftig (vorhanden aber unvollständig/falsch)
- 5-6: Durchschnittlich (Basis erfüllt, Potenzial ungenutzt)
- 7-8: Gut (solide umgesetzt, kleinere Lücken)
- 9-10: Sehr gut bis excellent (vollständig, professionell, Best Practice)

TECHNIK-BONUS: +1 wenn JSON-LD vorhanden, +1 wenn alle Bilder Alt-Text haben, +1 wenn Core Web Vitals gut.
Sei KONSISTENT: Gleiche Fakten = gleiche Scores.`

    const scoreRes = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      temperature: 0, // Deterministische Scores – kein Zufallsrauschen
      system: SCORE_SYSTEM,
      messages: [{ role: 'user', content: `Bewerte diese Website objektiv nach den Kriterien:\n\n${prompt.slice(0, 5000)}\n\nAntworte NUR mit diesem JSON:\n{"positionierung":0,"angebot":0,"zielgruppe":0,"vertrauen":0,"conversion":0,"seo":0,"navigation":0,"sprache":0,"technik":0,"externe_sichtbarkeit":0,"gesamt":0}` }],
    })

    const scoreText = scoreRes.content[0].type === 'text' ? scoreRes.content[0].text : ''
    const scores: Record<string, number> = {}
    for (const k of SCORE_KEYS) {
      const m = scoreText.match(new RegExp(`"?${k}"?\\s*[:=]\\s*(\\d+)`, 'i'))
      scores[k] = m ? Math.min(10, Math.max(1, parseInt(m[1], 10))) : 5
    }
    if (!scoreText.match(/"?gesamt"?\s*[:=]\s*\d+/i)) {
      const vals = SCORE_KEYS.slice(0, 10).map(k => scores[k])
      scores.gesamt = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    }

    return NextResponse.json({ scores, date: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
