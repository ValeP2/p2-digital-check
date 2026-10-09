import type Anthropic from '@anthropic-ai/sdk'
import type { CrawlResult } from '../crawl/crawlerTypes'
import { addUsage, anthropicClient, fehlerArt, RESEARCH_EFFORT, RESEARCH_MODEL, type Usage } from './anthropic'

// ── Externe Sichtbarkeit recherchieren ───────────────────────────
//
// Eigener, günstiger Schritt mit Sonnet und Websuche. Liefert Fakten mit
// Quellen, KEIN Urteil — beurteilt wird im Hauptlauf anhand des Katalogs.
// Früher: eine einzige Suche, deren Ergebnis dann abgeschnitten wurde, bevor
// das Modell es sah. Die Bewertung der externen Sichtbarkeit war geraten.

const SYSTEM = `Du recherchierst Fakten zur Online-Präsenz EINES bestimmten Schweizer Unternehmens. Du bewertest nicht, du berichtest, was du findest — mit Quelle.

Regeln:
- Nur Funde, die eindeutig zu genau diesem Unternehmen gehören (Name UND Ort/Website passen). Bei Namensgleichheit mit einer anderen Firma: als "unsicher" kennzeichnen.
- Unterscheide klar: "nicht gefunden" (gezielt gesucht, nichts da) ist etwas anderes als "unklar" (Fremdtreffer, keine eindeutige Zuordnung).
- Erfinde nichts. Keine Bewertungszahlen, Daten oder Profile, die du nicht in einem Suchergebnis gesehen hast.
- Schweizer Rechtschreibung (ss).`

function companyName(crawl: CrawlResult): string {
  return crawl.identity.imprint.entity || crawl.companyName
}

function place(crawl: CrawlResult): string {
  return crawl.identity.imprint.address?.match(/\d{4}\s+(.+)$/)?.[1]?.trim() ?? ''
}

export async function researchVisibility(crawl: CrawlResult, usage: Usage): Promise<string | null> {
  const client = anthropicClient()
  const host = new URL(crawl.inputUrl).hostname.replace(/^www\./, '')
  const name = companyName(crawl)
  const ort = place(crawl)
  const social = crawl.socialProfiles.map(s => `${s.platform}: ${s.url}`).join('\n')

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Unternehmen: ${name}${ort ? `, ${ort}` : ''}
Website: ${host}
${social ? `Von der Website verlinkte Profile:\n${social}` : 'Die Website verlinkt keine Social-Media-Profile.'}

Recherchiere mit höchstens 5 Suchen und berichte unter genau diesen Überschriften:

1. Google-Unternehmensprofil: vorhanden? Durchschnittsbewertung und Anzahl Bewertungen, falls sichtbar.
2. Verzeichnisse: Einträge auf local.ch, search.ch oder relevanten Branchenportalen.
3. Social Media: Für jedes oben verlinkte Profil (und weitere, die eindeutig dazugehören): öffentlich sichtbar? Datum des letzten sichtbaren Beitrags, falls feststellbar.
4. Erwähnungen durch Dritte: Presse, Branchenportale, Verbände, Partner (höchstens 5, mit Quelle).
5. Suchanfragen: welche Suchen du gestellt hast.

Pro Punkt höchstens 3 Sätze. Schreibe "nicht gefunden" oder "unklar", wo es zutrifft.`,
  }]

  try {
    for (let runde = 0; runde < 3; runde++) {
      const msg = await client.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 6000,
        system: SYSTEM,
        output_config: { effort: RESEARCH_EFFORT },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, user_location: { type: 'approximate', country: 'CH' } }],
        messages,
      } as Anthropic.MessageCreateParamsNonStreaming, { timeout: 90_000 })
      addUsage(usage, RESEARCH_MODEL, msg.usage)
      // Lange Recherchen hält die Schnittstelle an ("pause_turn") — dann
      // weiterarbeiten lassen, statt ein halbes Ergebnis zu nehmen.
      if (msg.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: msg.content })
        continue
      }
      const text = msg.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('\n').trim()
      return text || null
    }
    return null
  } catch (e) {
    // Einrichtungsfehler (Guthaben, Schlüssel) treffen gleich danach auch die
    // Analyse — dann sofort abbrechen statt eine Minute später.
    const art = fehlerArt(e)
    if (art === 'guthaben' || art === 'schluessel') throw e
    // Die Recherche ist eine Ergänzung. Scheitert sie, werden die
    // Recherche-Prüfpunkte "nicht prüfbar" — der Check läuft weiter.
    console.error('[research] fehlgeschlagen:', e instanceof Error ? e.message : e)
    return null
  }
}
