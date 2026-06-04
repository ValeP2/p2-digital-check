import Anthropic from '@anthropic-ai/sdk'
import { crawlWebsite } from './crawler'
import { buildPrompt } from './prompt'

const MODEL = 'claude-haiku-4-5-20251001'
const PRICE_IN = 0.80, PRICE_OUT = 4.00, USD_TO_CHF = 0.90

const SCORE_KEYS = ['positionierung','angebot','zielgruppe','vertrauen','conversion','seo','navigation','sprache','technik','externe_sichtbarkeit','gesamt'] as const

export interface AnalysisResult {
  companyName: string
  scores: Record<string, number>
  report: string
  chf: string
}

// Vollständige Analyse ohne Streaming – für Hintergrund-Läufe (Intake-Webhook)
export async function performAnalysis(inputUrl: string): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let inUsd = 0

  const crawlData = await crawlWebsite(inputUrl)
  const prompt = buildPrompt(crawlData)
  const host = new URL(inputUrl).hostname.replace(/^www\./, '')

  // Recherche
  const research = await client.messages.create({
    model: MODEL, max_tokens: 800,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
    system: 'Du recherchierst zu EINEM bestimmten Schweizer Unternehmen. Suche gezielt auf local.ch, search.ch und Social Media. Nur dieses Unternehmen, keine fremden Domains. Maximal 3 Sätze.',
    messages: [{ role: 'user', content: `Unternehmen: "${crawlData.companyName}", Website: ${host}. Suche einmal gezielt nach Bewertungen/Einträgen dieses Unternehmens.` }],
  })
  inUsd += (research.usage.input_tokens / 1e6 * PRICE_IN) + (research.usage.output_tokens / 1e6 * PRICE_OUT)
  let externalResearch = ''
  for (const b of research.content) if (b.type === 'text') externalResearch = b.text
  const fullPrompt = prompt + (externalResearch ? `\n\n---\nEXTERNE RECHERCHE:\n${externalResearch}\n---\n` : '')

  // Scores
  const scoreRes = await client.messages.create({
    model: MODEL, max_tokens: 300,
    system: 'Antworte NUR mit validem JSON, kein anderer Text.',
    messages: [{ role: 'user', content: `Bewerte (1–10):\n\n${fullPrompt.slice(0, 4000)}\n\nNur JSON:\n{"positionierung":0,"angebot":0,"zielgruppe":0,"vertrauen":0,"conversion":0,"seo":0,"navigation":0,"sprache":0,"technik":0,"externe_sichtbarkeit":0,"gesamt":0}` }],
  })
  inUsd += (scoreRes.usage.input_tokens / 1e6 * PRICE_IN) + (scoreRes.usage.output_tokens / 1e6 * PRICE_OUT)
  const scoreText = scoreRes.content[0].type === 'text' ? scoreRes.content[0].text : ''
  const scores: Record<string, number> = {}
  for (const k of SCORE_KEYS) {
    const m = scoreText.match(new RegExp(`"?${k}"?\\s*[:=]\\s*(\\d+)`, 'i'))
    scores[k] = m ? Math.min(10, Math.max(1, parseInt(m[1], 10))) : 5
  }
  if (!scoreText.match(/"?gesamt"?\s*[:=]\s*\d+/i)) {
    const v = SCORE_KEYS.slice(0, 10).map(k => scores[k])
    scores.gesamt = Math.round(v.reduce((a, b) => a + b, 0) / v.length)
  }

  // Bericht
  const SYS = `Du bist ein erfahrener Digital-Stratege für Schweizer KMU. Konkret, mit Zitaten, Bullet-Listen, **fett** für Hervorhebungen, *Einschätzung* (kursiv) je Abschnitt. Schweizer Rechtschreibung (ss). EXAKT die vorgegebenen ###-Überschriften mit Nummer, keine eigenen, keine ####, keine Code-Blöcke/Backticks/Tabellen/--- Trennlinien.`
  const reportPrompt = `${fullPrompt}\n\n---\n\nErstelle den vollständigen Bericht mit dieser Struktur:\n\n## Website Analyse – ${crawlData.companyName}\n\n### Ausgangslage\n### 1. Erster Eindruck und Positionierung\n### 2. Angebot und Verständlichkeit\n### 3. Zielgruppe und Kundenbedürfnis\n### 4. Vertrauen und Glaubwürdigkeit\n### 5. Kontakt und Conversion\n### 6. Inhalte und SEO\n### 7. Navigation und Struktur\n### 8. Sprache und Textqualität\n### 9. Technik und Mobile\n### 10. Externe Sichtbarkeit\n### Gesamtbewertung\n### Empfehlung im Rahmen des Digital Checks\n### Fazit`

  const reportRes = await client.messages.create({
    model: MODEL, max_tokens: 16000, system: SYS,
    messages: [{ role: 'user', content: reportPrompt }],
  })
  inUsd += (reportRes.usage.input_tokens / 1e6 * PRICE_IN) + (reportRes.usage.output_tokens / 1e6 * PRICE_OUT)
  const report = reportRes.content[0].type === 'text' ? reportRes.content[0].text : ''

  const nameMatch = report.match(/##\s+Website Analyse\s*[–-]\s*(.+)/i)
  const companyName = (nameMatch ? nameMatch[1].trim() : '') || crawlData.companyName || host

  return { companyName, scores, report, chf: (inUsd * USD_TO_CHF).toFixed(4) }
}
