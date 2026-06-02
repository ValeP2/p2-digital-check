import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { crawlWebsite } from '@/lib/crawler'
import { buildPrompt } from '@/lib/prompt'

export const maxDuration = 60

// Modelle und Preise pro 1M Tokens (USD)
// Alles Haiku → ~CHF 0.05-0.10 pro Analyse
const MODELS = {
  fast:   { id: 'claude-haiku-4-5-20251001', inputPrice: 0.80, outputPrice: 4.00 },
  report: { id: 'claude-haiku-4-5-20251001', inputPrice: 0.80, outputPrice: 4.00 },
}
const USD_TO_CHF = 0.90

// Demo-Modus: gibt gecachten Bericht zurück (kein API-Call)
const DEMO_MODE = process.env.DEMO_MODE === 'true'

export async function POST(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { url } = await req.json() as { url: string }
  if (!url) return new Response('URL fehlt', { status: 400 })

  let inputUrl = url.trim()
  if (!inputUrl.startsWith('http')) inputUrl = `https://${inputUrl}`
  try { new URL(inputUrl) } catch {
    return new Response('Ungültige URL', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Token-Tracking pro Modell
      const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
      const addUsage = (model: keyof typeof MODELS, inp: number, out: number) => {
        usage.inputTokens += inp
        usage.outputTokens += out
        usage.costUsd += (inp / 1_000_000 * MODELS[model].inputPrice) + (out / 1_000_000 * MODELS[model].outputPrice)
      }

      try {
        // Demo-Modus: Sofort Mock-Daten zurückgeben
        if (DEMO_MODE) {
          send('status', 'Demo-Modus aktiv – lade Beispielanalyse...')
          await new Promise(r => setTimeout(r, 800))
          send('scores', JSON.stringify({
            positionierung: 6, angebot: 3, zielgruppe: 4, vertrauen: 5,
            conversion: 4, seo: 2, navigation: 6, sprache: 5, technik: 7,
            externe_sichtbarkeit: 3, gesamt: 4
          }))
          await new Promise(r => setTimeout(r, 400))
          const demoReport = getDemoReport()
          for (let i = 0; i < demoReport.length; i += 80) {
            send('chunk', demoReport.slice(i, i + 80))
            await new Promise(r => setTimeout(r, 15))
          }
          send('cost', JSON.stringify({ inputTokens: 0, outputTokens: 0, chf: '0.0000' }))
          send('done', demoReport)
          return
        }

        send('status', 'Crawle Website...')
        const crawlData = await crawlWebsite(inputUrl)
        send('status', `${crawlData.pages.length} Seiten analysiert – suche externe Signale...`)

        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const prompt = buildPrompt(crawlData)
        const hostname = new URL(inputUrl).hostname.replace(/^www\./, '')

        // Schritt 1: Web-Recherche mit Haiku (günstig)
        send('status', 'Analyse läuft – bitte einen Moment warten...')
        const researchResponse = await client.messages.create({
          model: MODELS.fast.id,
          max_tokens: 800,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
          system: 'Recherche-Assistent. Suche kompakt, gib nur das Wesentliche zurück.',
          messages: [{
            role: 'user',
            content: `Suche nach: "${crawlData.companyName}" Bewertungen local.ch, Social Media. 1 Suche genügt. Maximal 3 Sätze Zusammenfassung.`
          }],
        })
        addUsage('fast', researchResponse.usage.input_tokens, researchResponse.usage.output_tokens)

        let externalResearch = ''
        for (const block of researchResponse.content) {
          if (block.type === 'text') externalResearch = block.text
        }

        const fullPrompt = prompt + (externalResearch ? `\n\n---\nEXTERNE RECHERCHE:\n${externalResearch}\n---\n` : '')

        // Schritt 2: Scores mit Haiku (günstig, nur JSON)
        send('status', 'Bewerte Kategorien...')
        const scoreResponse = await client.messages.create({
          model: MODELS.fast.id,
          max_tokens: 300,
          system: 'Antworte NUR mit validem JSON, kein anderer Text.',
          messages: [{
            role: 'user',
            content: `Bewerte diese Website (1–10):\n\n${fullPrompt.slice(0, 4000)}\n\nNur JSON:\n{"positionierung":0,"angebot":0,"zielgruppe":0,"vertrauen":0,"conversion":0,"seo":0,"navigation":0,"sprache":0,"technik":0,"externe_sichtbarkeit":0,"gesamt":0}`
          }],
        })
        addUsage('fast', scoreResponse.usage.input_tokens, scoreResponse.usage.output_tokens)

        try {
          const scoreText = scoreResponse.content[0].type === 'text' ? scoreResponse.content[0].text : '{}'
          const scores = JSON.parse(scoreText.replace(/```json|```/g, '').trim())
          send('scores', JSON.stringify(scores))
        } catch { /* Scores-Parsing fehlgeschlagen */ }

        // Schritt 3: Bericht mit Sonnet (Qualität bei vernünftigen Kosten)
        send('status', 'Generiere Analysebericht...')
        const streamResponse = await client.messages.create({
          model: MODELS.report.id,
          max_tokens: 8000,
          system: `Du bist ein erfahrener Digital-Stratege und Website-Analyst für Schweizer KMU.
Dein Bericht muss KONKRET und SPEZIFISCH sein:
- Zitiere echten Text von der Website (Tippfehler, schwache Formulierungen)
- Nenne konkrete Zahlen (Wortanzahl, fehlende Meta-Daten, Bilder ohne Alt-Text)
- Bullet-Listen für Beispiele (Gerätetypen, fehlende Inhalte, Verbesserungsvorschläge)
- Vorher/Nachher-Beispiele bei schwachen Texten
- Externe Quellen einbeziehen (local.ch, Social Media, Konkurrenz)
- Jeder Abschnitt schliesst mit kursiver *Einschätzung*
- Schweizer Rechtschreibung (ss statt ß)`,
          messages: [{ role: 'user', content: fullPrompt }],
          stream: true,
        })

        let fullReport = ''
        for await (const chunk of streamResponse) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            fullReport += chunk.delta.text
            send('chunk', chunk.delta.text)
          }
          if (chunk.type === 'message_start' && chunk.message.usage) {
            addUsage('report', chunk.message.usage.input_tokens, 0)
          }
          if (chunk.type === 'message_delta' && chunk.usage) {
            addUsage('report', 0, chunk.usage.output_tokens)
          }
        }

        send('cost', JSON.stringify({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          chf: (usage.costUsd * USD_TO_CHF).toFixed(4),
        }))
        send('done', fullReport)

      } catch (err) {
        send('error', err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

function getDemoReport(): string {
  return `## Website Analyse – BUZAG Haushaltsgeräte

### Ausgangslage
BUZAG positioniert sich als regionaler Anbieter für Haushaltgeräte in Biel/Bienne mit den Schwerpunkten Service, Reparaturen und Verkauf. Das Geschäft besteht seit 1987 und wurde 2020 von Sandro Bundeli übernommen. Der erste Eindruck ist freundlich und bodenständig, wirkt aber wie eine digitale Visitenkarte statt ein aktiver Verkaufskanal.

### 1. Erster Eindruck und Positionierung
Der Claim «Ihr kompetenter Partner für Haushaltgeräte aller Marken» ist sofort verständlich. Was fehlt, ist eine problemorientierte Einstiegsebene. Besucher kommen mit konkreten Anliegen:

- Waschmaschine defekt
- Geschirrspüler läuft nicht
- Gerät ersetzen oder reparieren

*Die Website sagt was BUZAG macht – verkauft den Nutzen aber noch zu wenig klar.*

### 2. Angebot und Verständlichkeit
Die drei Leistungsbereiche Service, Reparatur und Verkauf werden in je 1–2 Sätzen beschrieben. Es fehlen konkrete Gerätekategorien:

- Waschmaschinen & Tumbler
- Geschirrspüler
- Backöfen & Steamer
- Kühlschränke & Gefriergeräte
- Kochfelder & Dunstabzüge

*Das Angebot ist vorhanden, aber zu wenig tief ausgearbeitet.*

### 3. Zielgruppe und Kundenbedürfnis
Typische Nutzerfragen die unbeantwortet bleiben:

- Repariert ihr meine Marke?
- Wie schnell könnt ihr kommen?
- Lohnt sich eine Reparatur noch?
- Liefert und montiert ihr?

*Die Bedürfnisse der Besucher werden inhaltlich kaum bedient.*

### 4. Vertrauen und Glaubwürdigkeit
Positiv: Team mit Namen, Geschichte seit 1987, Referenzen, Markenpartner (Miele, V-ZUG, Bosch, Siemens). Negativ: Keine Kundenbewertungen, Referenzseite ohne konkrete Inhalte, kein Google-Business-Profil erkennbar.

*Die Vertrauensbasis ist da, wird aber nicht stark genug inszeniert.*

### 5. Kontakt und Conversion
Telefon, E-Mail, WhatsApp und Formular sind vorhanden. Das Formular enthält Felder wie «Repeat e-mail» und «Your homepage» – nicht lokalisiert und für Endkunden unnötig. Kein durchgängiger CTA wie «Jetzt Reparatur anfragen».

*Kontaktwege vorhanden, der Besucher wird aber nicht aktiv geführt.*

### 6. Inhalte und SEO
Kritische Befunde: Meta-Titel 0 Zeichen (fehlt komplett), alle Unterseiten tragen denselben Titel «BUZAG Hauhaltsgeräte-Service» mit Tippfehler. 8 H1-Elemente auf der Startseite. Wortanzahl pro Seite: 55–175 Wörter – für Ranking zu wenig.

*Technisch und inhaltlich wird wertvolle lokale Sichtbarkeit verschenkt.*

### 7. Navigation und Struktur
Aktuelle Navigation: Angebot, Über uns, Partner, Referenzen, Kontakt. Besser wäre:

- Service & Reparatur
- Geräteverkauf
- Für Immobilienverwaltungen
- Über BUZAG
- Kontakt / Reparatur anfragen

*Die Grundstruktur stimmt, ist aber nicht nutzerorientiert genug.*

### 8. Sprache und Textqualität
Tippfehler: «WhatApp» statt WhatsApp im Footer. Schwache Formulierung: «Wenn Sie einen Wohnungswechsel haben, dann brauchen Ihre Geräte einen Service.»

Besser: «Bei einem Wohnungswechsel prüfen, reinigen und kontrollieren wir Ihre Haushaltgeräte fachgerecht – damit am neuen Ort alles zuverlässig funktioniert.»

*Der Ton ist gut, der verkäuferische Gehalt muss verbessert werden.*

### 9. Technik und Mobile
Positiv: HTTPS, Sitemap, robots.txt, Open Graph vorhanden. Negativ: Fehlendes JSON-LD (LocalBusiness), mehrere 404-Fehlerseiten, kein strukturiertes Daten-Markup für Öffnungszeiten.

*Die technische Basis funktioniert, SEO-relevante Elemente fehlen.*

### 10. Externe Sichtbarkeit
local.ch: 5.0 Sterne (2 Bewertungen) – wird auf der Website nicht genutzt. Instagram und Facebook verlinkt, aber Inhalte nicht in die Website eingebunden. Konkurrenz: Rey Allround mit deutlich mehr Bewertungen sichtbar. Zweite Domain buzag-haushaltsgeraete.ch mit ähnlichen Inhalten könnte SEO-Potenzial aufteilen.

*Externe Sichtbarkeit ist vorhanden, wird aber zu wenig als Vertrauensbeweis genutzt.*

### Gesamtbewertung
**Stärken:**
- Klare regionale Positionierung als markenunabhängiger Spezialist
- Authentische Geschichte (seit 1987) und persönliche Team-Vorstellung
- Zweisprachigkeit Deutsch/Französisch – ideal für Region Biel
- Mehrere Kontaktwege inkl. WhatsApp
- Solide technische Grundausstattung

**Schwächen:**
- Meta-Titel fehlt komplett, Tippfehler im Seitentitel
- Inhaltlich extrem dünne Texte (55–175 Wörter pro Seite)
- Keine aktiven Kundenbewertungen sichtbar
- Referenz- und Partnerseiten ohne aussagekräftigen Inhalt
- Kein strukturierter Reparatur-Anfrageprozess

### Empfehlung im Rahmen des Digital Checks
1. **Meta-Daten und Tippfehler korrigieren** – sofortige Wirkung auf Google
2. **Google-Unternehmensprofil aufbauen** – wichtigster lokaler Sichtbarkeitshebel
3. **404-Fehler beheben** – stören Nutzer und Suchmaschinen
4. **Angebotstexte ausbauen** – konkrete Geräte, Marken, Ablauf beschreiben
5. **Bewertungen sichtbar integrieren** – local.ch-Rating auf Website zeigen
6. **CTA auf jeder Seite** – «Jetzt Reparatur anfragen»-Button
7. **Strukturierte Daten (LocalBusiness)** – Öffnungszeiten in Google-Suche
8. **Kontaktformular modernisieren** – unnötige Felder entfernen

### Fazit
BUZAG verfügt über ein glaubwürdiges, klar positioniertes Geschäft mit starker regionaler Verankerung – online wird dieses Potenzial nur zu einem Bruchteil genutzt. Schon mit überschaubarem Aufwand lassen sich Meta-Daten, Inhalte und lokale Auffindbarkeit deutlich verbessern. Der Digital Check zeigt strukturiert auf, welche gezielten Massnahmen aus einer digitalen Visitenkarte einen aktiven Kundengewinnungskanal machen.`
}
