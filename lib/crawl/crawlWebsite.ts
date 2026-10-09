import { fetchPage } from './fetchPage'
import { extractInternalLinks, prioritiseLinks } from './extractLinks'
import { extractPageData } from './extractPageData'
import { extractTechnical, checkSitemapAndRobots, checkHttpRedirect } from './extractTechnical'
import { assertPublicUrl } from './safeUrl'
import { findSocialProfiles } from './socialProfiles'
import {
  detectPlatform, detectHosting, pickImprintUrl, extractImprint, EMPTY_IMPRINT, SiteIdentity,
} from './siteIdentity'
import { CrawlResult, PageData } from './crawlerTypes'
import * as cheerio from 'cheerio'

// Deutlich mehr Unterseiten als früher (9): die Analysequalität hängt direkt
// daran, wie viel echten Text das Modell zu sehen bekommt. Seit der Crawl
// parallel läuft, kostet das kaum zusätzliche Zeit.
const MAX_SUBPAGES = 14
// ...aber nicht alle gleichzeitig auf die Kundenseite feuern — in Schüben,
// damit wir uns wie ein Browser verhalten und nicht wie ein Lasttest.
const CRAWL_CONCURRENCY = 6

// Nutzer geben URLs oft ohne Schema ein ("www.port.ch" statt "https://www.port.ch").
// new URL() wirft ohne Schema sofort eine Exception — also hier einmal normalisieren,
// statt an jeder Eingabestelle (Onboarding, Einstellungen) durchzusetzen.
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// Vergleichsform einer Adresse: ohne Anker, ohne abschliessenden Schrägstrich,
// Host in Kleinschreibung. Ohne das galt "https://example.ch" und
// "https://example.ch/" als zwei verschiedene Seiten — ein Anker-Link wie
// "./#kontakt" führte deshalb dazu, dass die Startseite ein zweites Mal als
// vermeintliche Unterseite gecrawlt wurde und doppelt in der Analyse stand.
function canonical(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase()
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${u.host}${path}${u.search}`
  } catch {
    return url
  }
}

/** Was nach der Startseite schon feststeht — genug, um die Recherche parallel zu starten. */
export interface StartInfo { url: string; name: string; title: string; socialProfiles: { platform: string; url: string }[] }

const ORG_TYPES = /Organization|LocalBusiness|Corporation|ProfessionalService|Store|Restaurant|Agency/i

/** Name der Organisation aus JSON-LD, falls die Seite ihn maschinenlesbar angibt. */
function organizationName(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1])
      const nodes = (Array.isArray(data) ? data : [data]).flatMap((n: Record<string, unknown>) => Array.isArray(n?.['@graph']) ? n['@graph'] as Record<string, unknown>[] : [n])
      const org = nodes.find(n => ORG_TYPES.test(String(n?.['@type'] ?? '')) && typeof n?.name === 'string')
      if (org) return String(org.name).trim()
    } catch { /* kaputtes JSON-LD ignorieren */ }
  }
  return null
}

export async function crawlWebsite(
  rawInputUrl: string,
  // Optionale Rückmeldung pro gelesener Seite — der Crawl ist der längste
  // Abschnitt der Analyse, ohne Lebenszeichen wirkt die Anwendung dort tot.
  onProgress?: (message: string) => void,
  onStart?: (info: StartInfo) => void,
): Promise<CrawlResult> {
  const requestedUrl = normalizeUrl(rawInputUrl)
  await assertPublicUrl(requestedUrl)
  console.log(`\nStarte Crawl: ${requestedUrl}`)

  const startResult = await fetchPage(requestedUrl)
  if (!startResult) throw new Error(`Startseite konnte nicht abgerufen werden: ${requestedUrl}`)
  if (startResult.statusCode >= 400) throw new Error(`Startseite antwortet mit Status ${startResult.statusCode}: ${requestedUrl}`)

  // Ab hier zählt die Adresse, auf der die Startseite ankam. Leitet
  // "example.ch" auf "www.example.ch" weiter, sind die Links der Seite auf
  // www — mit der Eingabe verglichen galt sonst keiner als intern.
  const inputUrl = startResult.finalUrl || requestedUrl
  await assertPublicUrl(inputUrl)
  onProgress?.(`Gelesen: Startseite (${new URL(inputUrl).hostname})`)
  const { html: startHtml, statusCode: startStatus, headers: startHeaders } = startResult
  const baseUrl = new URL(inputUrl).origin

  // Startseite extrahieren
  const startPage = extractPageData(startHtml, inputUrl, startStatus)
  {
    const $s = cheerio.load(startHtml)
    const siteName = ($s('meta[property="og:site_name"]').attr('content') ?? '').trim()
    onStart?.({
      url: inputUrl,
      // Firmenname: strukturierte Daten vor og:site_name vor Seitentitel. Der
      // Titel allein trifft oft den Slogan ("Kommunikationsagentur Biel/Bienne
      // für KMU | P2/ Kommunikation" ergab den falschen Teil).
      name: organizationName(startHtml) || siteName || startPage.title.replace(/[-|–—].*$/, '').trim() || new URL(inputUrl).hostname,
      title: startPage.title,
      socialProfiles: findSocialProfiles(startPage.externalLinks),
    })
  }
  const pages: PageData[] = [startPage]
  const unreachable: string[] = []

  // Navigation auslesen
  const $ = cheerio.load(startHtml)
  const navigationItems = $('nav a, header a').map((_, el) => $(el).text().trim()).get().filter(Boolean)

  // Interne Links sammeln und priorisieren
  const allLinks = extractInternalLinks(startHtml, inputUrl)
  const startCanonical = canonical(inputUrl)
  const seen = new Set<string>([startCanonical])
  const candidates: string[] = []
  for (const link of allLinks) {
    const key = canonical(link)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(link)
  }
  const toVisit = prioritiseLinks(candidates, inputUrl, MAX_SUBPAGES)

  // Unterseiten in parallelen Schüben statt streng sequenziell abrufen: bei
  // sequenziellem Crawl summierten sich die Timeouts schnell auf über eine
  // Minute (Vercel maxDuration) und die Funktion brach mit einer Plattform-
  // Fehlerseite statt JSON ab, sobald eine Zielseite langsam war.
  for (let i = 0; i < toVisit.length; i += CRAWL_CONCURRENCY) {
    const batch = toVisit.slice(i, i + CRAWL_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map(async link => {
        console.log(`  Crawle: ${link}`)
        const result = await fetchPage(link)
        try {
          onProgress?.(result ? `Gelesen: ${new URL(link).pathname}` : `Nicht erreichbar: ${new URL(link).pathname}`)
        } catch { /* Fortschrittsmeldung darf den Crawl nie stören */ }
        return result ? { link, result } : { link, result: null }
      })
    )
    for (const entry of batchResults) {
      // Nicht erreichbare Seiten wurden bisher stillschweigend verworfen. Für
      // die Analyse ist der Unterschied wesentlich: Eine Seite, die es gibt,
      // die wir aber nicht lesen konnten, darf nicht als fehlender Inhalt
      // gewertet werden.
      if (!entry.result) { unreachable.push(entry.link); continue }
      pages.push(extractPageData(entry.result.html, entry.link, entry.result.statusCode))
    }
  }

  // Technische Daten
  const technical = extractTechnical(startHtml, startResult)
  const [{ hasSitemap, hasRobots }, httpRedirectsToHttps] = await Promise.all([
    checkSitemapAndRobots(inputUrl),
    checkHttpRedirect(inputUrl),
  ])
  technical.hasSitemap = hasSitemap
  technical.hasRobots = hasRobots
  technical.httpRedirectsToHttps = httpRedirectsToHttps

  // Deduplizierte Kontaktdaten über alle Seiten
  const allPhoneNumbers = [...new Set(pages.flatMap(p => p.phoneNumbers))]
  const allEmails = [...new Set(pages.flatMap(p => p.emails))]
  const allInternalLinks = [...new Set(pages.flatMap(p => p.internalLinks))]

  // ── Wer verantwortet die Seite, womit ist sie gebaut? ──────────
  const identity: SiteIdentity = {
    platform: detectPlatform(startHtml, startHeaders),
    hosting: detectHosting(startHeaders),
    imprint: EMPTY_IMPRINT,
  }

  const imprintTarget = pickImprintUrl([...allInternalLinks, ...toVisit])
  if (imprintTarget) {
    const already = pages.find(p => canonical(p.url) === canonical(imprintTarget.url))
    if (already) {
      identity.imprint = extractImprint(already.bodyText.split('\n'), already.url, imprintTarget.source)
    } else {
      // Gezielt nachladen statt einen der Inhaltsplätze dafür zu opfern —
      // das Impressum trägt zur inhaltlichen Bewertung wenig bei, für die
      // Frage "wer steht dahinter" ist es aber die beste Quelle.
      const imprintResult = await fetchPage(imprintTarget.url)
      if (imprintResult && imprintResult.statusCode < 400) {
        const page = extractPageData(imprintResult.html, imprintTarget.url, imprintResult.statusCode)
        identity.imprint = extractImprint(page.bodyText.split('\n'), imprintTarget.url, imprintTarget.source)
        onProgress?.(`Gelesen: ${new URL(imprintTarget.url).pathname} (Impressum)`)
      }
    }
  }

  // Kein Impressum, keine Kontaktseite — in der Schweiz ist das keine
  // Seltenheit, eine Impressumspflicht wie in Deutschland gibt es hier nicht.
  // Dann werden die gelesenen Seiten selbst durchsucht. Das Ergebnis wird als
  // "aus dem Seiteninhalt" gekennzeichnet: es ist eine Fundstelle, keine
  // Selbstauskunft, und die Anzeige muss den Unterschied machen.
  if (!identity.imprint.found) {
    for (const page of pages) {
      const candidate = extractImprint(page.bodyText.split('\n'), page.url, 'inhalt')
      if (candidate.entity && candidate.address) { identity.imprint = candidate; break }
    }
  }

  const companyName = startPage.title.replace(/[-|–—].*$/, '').trim() || new URL(inputUrl).hostname

  return {
    inputUrl,
    baseUrl,
    companyName,
    crawledAt: new Date().toISOString(),
    pages,
    unreachable,
    identity,
    technical,
    allPhoneNumbers,
    allEmails,
    allInternalLinks,
    navigationItems: [...new Set(navigationItems)],
    socialProfiles: findSocialProfiles(pages.flatMap(p => p.externalLinks)),
  }
}
