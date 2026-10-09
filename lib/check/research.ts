import type Anthropic from '@anthropic-ai/sdk'
import type { StartInfo } from '../crawl/crawlWebsite'
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

// Läuft parallel zum Crawl, sobald die Startseite gelesen ist (spart rund
// eine halbe Minute). Deshalb nur, was die Startseite schon hergibt.
export async function researchVisibility(start: StartInfo, usage: Usage): Promise<string | null> {
  const client = anthropicClient()
  const host = new URL(start.url).hostname.replace(/^www\./, '')
  const name = start.name
  const social = start.socialProfiles.map(s => `${s.platform}: ${s.url}`).join('\n')

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Unternehmen: ${name}
Website: ${host}
Seitentitel der Startseite: ${start.title || '(leer)'}
(Ist der Name oben offensichtlich ein Slogan statt eines Firmennamens, nimm den Firmennamen aus Titel oder Domain.)
${social ? `Von der Website verlinkte Profile:\n${social}` : 'Die Website verlinkt keine Social-Media-Profile.'}

Stelle genau diese Suchen (höchstens 6), damit jeder Lauf gleich gründlich ist:
a) "${name}" mit Ort, um ein Google-Unternehmensprofil mit Bewertungen zu finden
b) "${name}" local.ch
c) "${name}" search.ch
d) "${name}" LinkedIn Instagram Facebook
e) "${name}" mit Branche, für Presse- und Branchenerwähnungen
f) nur falls nötig: eine Nachsuche bei Namensgleichheit oder unklarem Ergebnis

Berichte danach unter genau diesen Überschriften:

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
        max_tokens: 10000, // Nachdenken zählt mit
        system: SYSTEM,
        output_config: { effort: RESEARCH_EFFORT },
        // Bewusst die einfache Websuche (wie im Kompass): Die Variante mit
        // automatischer Filterung (_20260209) verbrauchte beim Test am
        // 09.10.2026 Suchen für ein internes Skript — übrig blieb eine.
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, user_location: { type: 'approximate', country: 'CH' } }],
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
