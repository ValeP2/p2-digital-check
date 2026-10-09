import Anthropic from '@anthropic-ai/sdk'

// Modelle wie im Kompass (Stand 09.10.2026). Opus 5.5 denkt ohne Angabe nur
// auf Stufe "medium" — deshalb wird die Stufe ausdrücklich gesetzt, damit sie
// bei einem Modellwechsel nicht still auf die Vorgabe des neuen fällt.
// Achtung: Beide Modelle lehnen `temperature` ab (400). Stabilität kommt aus
// dem Kriterienkatalog, nicht aus Zufallsunterdrückung.
export const ANALYSIS_MODEL = 'claude-opus-5-5'
export const ANALYSIS_EFFORT = 'high' as const
export const RESEARCH_MODEL = 'claude-sonnet-5-5'
export const RESEARCH_EFFORT = 'medium' as const

export function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ── Kosten ───────────────────────────────────────────────────────
// Quelle: Anthropic-Preisliste, Stand 06.10.2026 (dieselben Werte wie im Kompass).
// USD je 1 Mio. Token; Websuche 10 USD je 1000 Suchen.
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
}
const WEB_SEARCH_USD = 10 / 1000
// Fester Kurs wie im Kompass (EZB, 07.08.2026) — ein schwankender Kurs würde
// abgerechnete Läufe rückwirkend verändern.
export const USD_TO_CHF = 0.81

export interface Usage { inputTokens: number; outputTokens: number; webSearches: number; costUsd: number }

export function emptyUsage(): Usage {
  return { inputTokens: 0, outputTokens: 0, webSearches: 0, costUsd: 0 }
}

export function addUsage(total: Usage, model: string, u: Anthropic.Usage | null | undefined): void {
  if (!u) return
  const p = PRICING[model] ?? PRICING[ANALYSIS_MODEL]
  const input = u.input_tokens ?? 0
  const output = u.output_tokens ?? 0
  const cacheRead = u.cache_read_input_tokens ?? 0
  const searches = u.server_tool_use?.web_search_requests ?? 0
  total.inputTokens += input + cacheRead
  total.outputTokens += output
  total.webSearches += searches
  total.costUsd += (input * p.input + output * p.output + cacheRead * p.cacheRead) / 1e6 + searches * WEB_SEARCH_USD
}

// ── Fehler verständlich machen ───────────────────────────────────
// Aus dem Kompass: Am 08.10.2026 sah ein Kunde die rohe Anthropic-Meldung
// "credit balance is too low" — beim Digital Check passierte im September
// dasselbe vor einem Kunden. Unterschieden wird: Liegt es an unserer
// Einrichtung (P2 muss handeln) oder ist Anthropic überlastet (später nochmal)?

export type FehlerArt = 'guthaben' | 'schluessel' | 'ueberlastet' | 'anbieter' | 'unbekannt'

export function fehlerArt(err: unknown): FehlerArt {
  const f = (err ?? {}) as { status?: number; message?: string }
  const text = (f.message ?? '').toLowerCase()
  if (text.includes('credit balance')) return 'guthaben'
  if (f.status === 401 || f.status === 403 || text.includes('workspace') || text.includes('x-api-key')) return 'schluessel'
  if (f.status === 429 || f.status === 529 || text.includes('overloaded')) return 'ueberlastet'
  if (typeof f.status === 'number' && f.status >= 500) return 'anbieter'
  return 'unbekannt'
}

export function fehlerText(err: unknown): string {
  switch (fehlerArt(err)) {
    case 'guthaben': return 'Das Guthaben bei Anthropic ist aufgebraucht. Bitte unter console.anthropic.com → Plans & Billing aufladen; danach geht es sofort wieder.'
    case 'schluessel': return 'Der Anthropic-Schlüssel ist ungültig oder hat keinen Zugriff. Bitte ANTHROPIC_API_KEY in Vercel prüfen.'
    case 'ueberlastet': return 'Der KI-Dienst ist gerade stark ausgelastet. Bitte in ein paar Minuten erneut versuchen.'
    case 'anbieter': return 'Bei Anthropic ist ein Fehler aufgetreten. Bitte erneut versuchen.'
    default: return err instanceof Error ? err.message : 'Die Analyse konnte nicht abgeschlossen werden.'
  }
}
