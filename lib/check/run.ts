import type Anthropic from '@anthropic-ai/sdk'
import { crawlWebsite } from '../crawl/crawlWebsite'
import { measurePageSpeed } from '../measure/pagespeed'
import {
  addUsage, ANALYSIS_EFFORT, ANALYSIS_MODEL, anthropicClient, emptyUsage, fehlerArt,
  RESEARCH_MODEL, USD_TO_CHF,
} from './anthropic'
import { DIMENSIONS, KALIBRIERUNG, type MeasureContext } from './criteria'
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt'
import { researchVisibility } from './research'
import { CHECK_SCHEMA, type ModelOutput } from './schema'
import { dimensionBasis, dimensionScore, overallScore } from './score'
import {
  DIMENSION_KEYS, HORIZONTE, LEVELS, URTEILE,
  type CheckResult, type CriterionResult, type DimensionKey, type DimensionResult, type Massnahme, type Urteil,
} from './types'

// ── Die eine Pipeline ────────────────────────────────────────────
//
// Vorher gab es drei Kopien (Analyse, Framer-Eingang, Recheck) mit
// verschiedenen Modellen und Prompts — ein Recheck verglich darum vor allem
// zwei Modelle miteinander. Jetzt laufen alle drei Wege hier durch.
//
//   1. Crawl  ‖  PageSpeed (parallel)
//   2. Messungen rechnen
//   3. Recherche (Sonnet + Websuche)
//   4. Analyse (Opus, strukturierte Ausgabe)
//   5. Scores rechnen

export type Progress = (message: string) => void

function measureAll(ctx: MeasureContext): Record<DimensionKey, CriterionResult[]> {
  const out = {} as Record<DimensionKey, CriterionResult[]>
  for (const d of DIMENSIONS) {
    out[d.key] = d.kriterien
      .filter(c => c.quelle === 'messung' && c.measure)
      .map(c => {
        const m = c.measure!(ctx)
        return { id: c.id, label: c.label, gewicht: c.gewicht, quelle: c.quelle, urteil: m.urteil, beleg: m.beleg }
      })
  }
  return out
}

/** Phase der laufenden Ausgabe aus dem JSON-Strom ablesen — für die Fortschrittsanzeige. */
function writingPhase(json: string): string | null {
  const markers: [string, string][] = [
    ['"fazit"', 'Fazit wird formuliert'],
    ['"textbeispiele"', 'Textbeispiele werden ausgewählt'],
    ['"massnahmen"', 'Massnahmen werden abgeleitet'],
    ['"staerken"', 'Stärken werden zusammengefasst'],
    ...[...DIMENSIONS].reverse().map(d => [`"${d.key}"`, `Bewertet: ${d.label}`] as [string, string]),
    ['"firma"', 'Firmenprofil wird erfasst'],
  ]
  for (const [needle, label] of markers) if (json.includes(needle)) return label
  return null
}

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? value as T : fallback
}

async function analyse(prompt: string, usage: ReturnType<typeof emptyUsage>, onProgress: Progress): Promise<ModelOutput> {
  const client = anthropicClient()
  let attempt = 0
  for (;;) {
    let json = ''
    let lastPhase = ''
    try {
      // Lehnt ein Sicherheitsfilter die Anfrage ab, übernimmt serverseitig ein
      // anderes Modell (fallbacks: "default") statt eines leeren Ergebnisses.
      const stream = client.beta.messages.stream({
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        model: ANALYSIS_MODEL,
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        output_config: { effort: ANALYSIS_EFFORT, format: { type: 'json_schema', schema: CHECK_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming)
      stream.on('text', (delta: string) => {
        json += delta
        const phase = writingPhase(json)
        if (phase && phase !== lastPhase) { lastPhase = phase; onProgress(phase) }
      })
      const msg = await stream.finalMessage()
      addUsage(usage, ANALYSIS_MODEL, msg.usage as Anthropic.Usage)
      if (msg.stop_reason === 'refusal') throw new Error('Die KI hat die Analyse dieser Website abgelehnt.')
      if (msg.stop_reason === 'max_tokens') throw new Error('Das Ergebnis wurde zu lang und musste abgebrochen werden. Bitte erneut versuchen.')
      const text = msg.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('')
      return JSON.parse(text) as ModelOutput
    } catch (err) {
      // Überlastung mitten in der Antwort: einmal nachfassen (Kompass, 09.10.2026).
      if (fehlerArt(err) === 'ueberlastet' && attempt === 0) {
        attempt++
        onProgress('Anthropic ist gerade überlastet – zweiter Versuch')
        await new Promise(r => setTimeout(r, 8000))
        continue
      }
      throw err
    }
  }
}

function assemble(args: {
  measured: Record<DimensionKey, CriterionResult[]>
  output: ModelOutput
}): { dimensionen: DimensionResult[]; massnahmen: Massnahme[] } {
  const { measured, output } = args
  const dimensionen = DIMENSIONS.map((def): DimensionResult => {
    const fromModel = output.dimensionen?.[def.key]
    const kriterien: CriterionResult[] = def.kriterien.map(c => {
      if (c.quelle === 'messung') return measured[def.key].find(m => m.id === c.id)!
      const j = fromModel?.kriterien?.[c.id]
      // Fehlt ein Urteil trotz Schema, gilt der Punkt als nicht geprüft —
      // nie als Durchschnitt (der alte Fehler: still eine 5).
      const urteil: Urteil = j ? pick(j.urteil, URTEILE, 'nicht_pruefbar') : 'nicht_pruefbar'
      return { id: c.id, label: c.label, gewicht: c.gewicht, quelle: c.quelle, urteil, beleg: j?.beleg?.trim() || 'Nicht beurteilt' }
    })
    return {
      key: def.key,
      label: def.label,
      score: dimensionScore(kriterien),
      basis: dimensionBasis(kriterien),
      befund: fromModel?.befund?.trim() ?? '',
      kriterien,
    }
  })

  const massnahmen: Massnahme[] = (output.massnahmen ?? []).slice(0, 12).map(m => ({
    titel: m.titel,
    beschreibung: m.beschreibung,
    dimension: pick(m.dimension, DIMENSION_KEYS, 'positionierung'),
    prioritaet: pick(m.prioritaet, LEVELS, 'Mittel'),
    wirkung: pick(m.wirkung, LEVELS, 'Mittel'),
    zeithorizont: pick(m.zeithorizont, HORIZONTE, 'Kurzfristig'),
    schritte: (m.schritte ?? []).filter(Boolean),
  }))
  return { dimensionen, massnahmen }
}

export async function runCheck(rawUrl: string, onProgress: Progress = () => {}): Promise<CheckResult> {
  const started = Date.now()
  const usage = emptyUsage()

  onProgress('Website wird gelesen')
  const [crawl, pagespeed] = await Promise.all([
    crawlWebsite(rawUrl, msg => onProgress(msg)),
    measurePageSpeed(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`),
  ])
  onProgress(pagespeed.measured ? `Ladezeit gemessen (PageSpeed ${pagespeed.performance ?? '–'}/100)` : `Ladezeit nicht gemessen: ${pagespeed.reason}`)

  const measured = measureAll({ crawl, pagespeed })

  onProgress('Externe Sichtbarkeit wird recherchiert')
  const searchesBefore = usage.webSearches
  const research = await researchVisibility(crawl, usage)

  onProgress(`Analyse mit ${crawl.pages.length} Seiten startet`)
  const output = await analyse(buildUserPrompt({ crawl, measured, research }), usage, onProgress)

  const { dimensionen, massnahmen } = assemble({ measured, output })
  const overall = overallScore(dimensionen)

  return {
    version: 2,
    url: rawUrl,
    finalUrl: crawl.inputUrl,
    checkedAt: new Date().toISOString(),
    firma: {
      name: output.firma?.name?.trim() || crawl.identity.imprint.entity || crawl.companyName,
      branche: output.firma?.branche ?? '',
      angebot: output.firma?.angebot ?? '',
      zielgruppe: output.firma?.zielgruppe ?? '',
      region: output.firma?.region ?? '',
    },
    overall: overall.score,
    overallRechnung: overall.rechnung,
    fazit: output.fazit ?? '',
    staerken: output.staerken ?? [],
    dimensionen,
    massnahmen,
    textbeispiele: (output.textbeispiele ?? []).slice(0, 3),
    messungen: {
      pagespeed,
      technik: crawl.technical,
      plattform: crawl.identity.platform,
      impressum: crawl.identity.imprint,
      socialProfiles: crawl.socialProfiles,
      seiten: crawl.pages.map(p => ({ url: p.url, status: p.statusCode, woerter: p.wordCount, lesbar: p.readable })),
      nichtErreichbar: crawl.unreachable,
    },
    recherche: research ? { text: research, suchen: usage.webSearches - searchesBefore } : null,
    meta: {
      model: ANALYSIS_MODEL,
      researchModel: RESEARCH_MODEL,
      kalibrierung: KALIBRIERUNG,
      costUsd: Math.round(usage.costUsd * 1e6) / 1e6,
      costChf: Math.round(usage.costUsd * USD_TO_CHF * 1e4) / 1e4,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      webSearches: usage.webSearches,
      durationMs: Date.now() - started,
    },
  }
}
