import * as cheerio from 'cheerio'

export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const links = new Set<string>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
    try {
      const resolved = new URL(href, baseUrl)
      if (resolved.hostname === base.hostname) {
        resolved.hash = ''
        links.add(resolved.toString())
      }
    } catch {
      // ungültige URL ignorieren
    }
  })

  return Array.from(links)
}

// Gewichtung für einen Marketing-Check (anders als im Kompass, der
// Kommunikation über Zeit beobachtet und deshalb Blog/News bevorzugt): Hier
// zählt zuerst, was ein Interessent sucht — Angebot, Vertrauen, Kontakt.
const KEYWORD_WEIGHTS: { weight: number; keywords: string[] }[] = [
  // Angebot: der Kern jeder Bewertung von Positionierung und Verständlichkeit
  { weight: 5, keywords: ['leistung', 'angebot', 'service', 'dienstleistung', 'produkt', 'loesung', 'losung', 'sortiment', 'preis', 'tarif', 'offerte'] },
  // Vertrauen und Kontakt
  { weight: 4, keywords: ['ueber', 'uber', 'about', 'unternehmen', 'team', 'referenz', 'projekt', 'kunde', 'portfolio', 'kontakt', 'contact', 'standort'] },
  // Ergänzend: Aktualität, Arbeitgeber, Fragen
  { weight: 2, keywords: ['blog', 'news', 'aktuell', 'faq', 'fragen', 'karriere', 'jobs', 'partner', 'geschichte'] },
]

const LEGAL_PATH = /datenschutz|privacy|agb|nutzungsbedingungen|impressum|imprint|cookie|rechtliches|legal|statut/

export function prioritiseLinks(links: string[], baseUrl: string, maxLinks: number): string[] {
  // Rechtstexte sagen über Marketing nichts und kosten nur Plätze. Das
  // Impressum wird ohnehin gezielt nachgeladen, wenn es gebraucht wird.
  const relevant = links.filter(link => !LEGAL_PATH.test(new URL(link).pathname.toLowerCase()))
  const scored = relevant.map(link => {
    const path = new URL(link).pathname.toLowerCase()
    let score = 0
    for (const { weight, keywords } of KEYWORD_WEIGHTS) {
      for (const kw of keywords) {
        if (path.includes(kw)) score += weight
      }
    }
    // Flache Seiten bevorzugen: /blog schlägt /blog/2019/alter-beitrag — die
    // Übersichtsseite zeigt Frequenz und Bandbreite, ein Einzelbeitrag nicht.
    const depth = path.split('/').filter(Boolean).length
    score -= Math.max(0, depth - 1)
    if (path === '/' || path === '') score -= 5
    return { link, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxLinks).map(s => s.link)
}
