import { NextRequest } from 'next/server'
import { getActiveUser } from '@/lib/session'
import { runCheck } from '@/lib/check/run'
import { BEISPIEL_DEPS } from '@/lib/check/beispiel'
import { fehlerText } from '@/lib/check/anthropic'
import { appendHistory, getCheck, historyEntry, newCheckId, saveCheck } from '@/lib/checkStore'
import { addCost } from '@/lib/costStore'

export const maxDuration = 600

// Ein Check als Ereignisstrom: "progress" während der Arbeit, am Ende
// "result" mit dem gespeicherten Check — oder "error" mit verständlichem Text.
// Mit previousId wird es eine Nachprüfung: gleiche Pipeline, Verweis auf den
// früheren Check für den Vergleich.
export async function POST(req: NextRequest) {
  const user = await getActiveUser(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { url, previousId, beispiel } = await req.json() as { url?: string; previousId?: string; beispiel?: boolean }
  // Beispiel-Modus (echter Crawl, feste KI-Texte) nur in der lokalen Entwicklung
  const deps = beispiel && process.env.NODE_ENV === 'development' ? BEISPIEL_DEPS : {}
  if (!url?.trim()) return Response.json({ error: 'Keine Adresse angegeben' }, { status: 400 })
  const previous = previousId ? await getCheck(previousId) : null

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      // Lebenszeichen, damit Proxys die Verbindung in den stillen Phasen
      // (Opus denkt nach) nicht als hängend schliessen.
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 15000)
      try {
        const result = await runCheck(url.trim(), msg => send('progress', msg), deps)
        const id = newCheckId()
        const stored = { id, createdBy: user.email, previousId: previous?.id ?? null, result }
        const saved = await saveCheck(stored)
        if (saved) await appendHistory(user.email, historyEntry(id, result))
        await addCost(result.meta.costChf)
        send('result', { ...stored, saved })
      } catch (err) {
        console.error('[check] fehlgeschlagen:', err)
        send('error', fehlerText(err))
      } finally {
        clearInterval(keepAlive)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' },
  })
}
