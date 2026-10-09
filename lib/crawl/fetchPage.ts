import axios from 'axios'
import https from 'node:https'

export interface FetchedPage {
  html: string
  statusCode: number
  /** Antwort-Header in Kleinschreibung — für die System-/Hosting-Erkennung. */
  headers: Record<string, string>
  /** Adresse nach allen Weiterleitungen — daran wird HTTPS gemessen, nicht an der Eingabe. */
  finalUrl: string
  /** Das Zertifikat war ungültig; gelesen wurde trotzdem (Befund, kein Abbruchgrund). */
  certificateInvalid: boolean
}

// Aus dem alten Digital-Check-Crawler übernommen: Manche Seiten sperren
// unbekannte Programme aus, lassen aber einen Browser oder Googlebot durch.
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; P2DigitalCheck/2.0)',
]

const insecureAgent = new https.Agent({ rejectUnauthorized: false })

function normaliseHeaders(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value
    else if (Array.isArray(value)) out[key.toLowerCase()] = value.join(', ')
  }
  return out
}

function isCertificateError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? ''
  return /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS/i.test(code)
}

async function attempt(url: string, userAgent: string, insecure: boolean): Promise<FetchedPage> {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8',
    },
    maxRedirects: 5,
    // Jede Antwort ist ein Ergebnis — auch 404 oder 500 sagt etwas über die Seite.
    validateStatus: () => true,
    responseType: 'text',
    ...(insecure ? { httpsAgent: insecureAgent } : {}),
  })
  const finalUrl = (response.request as { res?: { responseUrl?: string } })?.res?.responseUrl ?? url
  return {
    html: typeof response.data === 'string' ? response.data : String(response.data ?? ''),
    statusCode: response.status,
    headers: normaliseHeaders(response.headers),
    finalUrl,
    certificateInvalid: insecure,
  }
}

export async function fetchPage(url: string): Promise<FetchedPage | null> {
  let certificateInvalid = false
  for (const ua of USER_AGENTS) {
    try {
      const page = await attempt(url, ua, certificateInvalid)
      // Gesperrt (401/403/429)? Dann mit dem nächsten User-Agent versuchen.
      if ([401, 403, 429].includes(page.statusCode) && ua !== USER_AGENTS.at(-1)) continue
      return page
    } catch (error: unknown) {
      if (!certificateInvalid && isCertificateError(error)) {
        // Ungültiges Zertifikat: einmal ohne Prüfung lesen und es als Befund
        // weitergeben. Früher wurde die Prüfung immer abgeschaltet — damit war
        // ein abgelaufenes Zertifikat unsichtbar.
        certificateInvalid = true
        try { return await attempt(url, ua, true) } catch { /* nächster Versuch */ }
      }
      console.error(`  Fehler beim Abruf von ${url}:`, error instanceof Error ? error.message : String(error))
    }
  }
  return null
}
