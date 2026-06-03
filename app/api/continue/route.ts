import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const MODEL = 'claude-haiku-4-5-20251001'

export async function POST(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { report, url } = await req.json() as { report: string; url: string }
  if (!report) return new Response('Kein Bericht', { status: 400 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        // Nur den Schluss des bisherigen Berichts als Kontext (spart Tokens)
        const tail = report.slice(-2500)

        const streamResponse = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          system: `Du bist ein erfahrener Digital-Stratege für Schweizer KMU. Du SETZT einen bereits begonnenen Digital-Check-Bericht FORT. Schreibe NUR die noch fehlenden Abschnitte – keine Wiederholung, keine Einleitung. Gleicher Stil: ### Überschriften mit Nummer, Bullet-Listen, **fett** für Hervorhebungen, *Einschätzung* (kursiv) am Abschnittsende. Schweizer Rechtschreibung (ss statt ß). Keine Code-Blöcke, keine Backticks, keine --- Trennlinien.`,
          messages: [
            { role: 'user', content: `Analysierte Website: ${url}\n\nDer Bericht endet aktuell hier (Ausschnitt):\n\n...${tail}\n\n---\n\nSetze den Bericht GENAU dort fort wo er aufhört. Vervollständige zuerst den angefangenen Satz/Abschnitt, dann schreibe alle noch fehlenden Abschnitte bis und mit Fazit. Die vollständige Struktur ist: 1. Erster Eindruck, 2. Angebot, 3. Zielgruppe, 4. Vertrauen, 5. Kontakt & Conversion, 6. Inhalte & SEO, 7. Navigation, 8. Sprache, 9. Technik & Mobile, 10. Externe Sichtbarkeit, Gesamtbewertung, Empfehlung im Rahmen des Digital Checks, Fazit.` },
          ],
          stream: true,
        })

        for await (const chunk of streamResponse) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            send('chunk', chunk.delta.text)
          }
          if (chunk.type === 'message_delta' && chunk.delta.stop_reason === 'max_tokens') {
            send('truncated', '1')
          }
        }
        send('done', '1')
      } catch (err) {
        send('error', err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
