import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { crawlWebsite } from '@/lib/crawler'
import { buildPrompt } from '@/lib/prompt'

export const maxDuration = 120

const MODEL = 'claude-haiku-4-5-20251001'
const SCORE_KEYS = ['positionierung','angebot','zielgruppe','vertrauen','conversion','seo','navigation','sprache','technik','externe_sichtbarkeit','gesamt'] as const

export async function POST(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) return new Response('Unauthorized', { status: 401 })

  const { url } = await req.json() as { url: string }
  if (!url) return NextResponse.json({ error: 'keine url' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const crawlData = await crawlWebsite(url)
    const prompt = buildPrompt(crawlData)

    const scoreRes = await client.messages.create({
      model: MODEL, max_tokens: 300,
      system: 'Antworte NUR mit validem JSON, kein anderer Text.',
      messages: [{ role: 'user', content: `Bewerte diese Website (1–10):\n\n${prompt.slice(0, 4000)}\n\nNur JSON:\n{"positionierung":0,"angebot":0,"zielgruppe":0,"vertrauen":0,"conversion":0,"seo":0,"navigation":0,"sprache":0,"technik":0,"externe_sichtbarkeit":0,"gesamt":0}` }],
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
