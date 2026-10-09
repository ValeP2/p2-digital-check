import * as cheerio from 'cheerio'
import { TechnicalData } from './crawlerTypes'
import { fetchPage, FetchedPage } from './fetchPage'

export function extractTechnical(html: string, start: FetchedPage): TechnicalData {
  const $ = cheerio.load(html)

  const metaTitle = $('title').first().text().trim()
  const metaDesc = $('meta[name="description"]').attr('content') ?? ''

  return {
    // Gemessen an der Adresse, auf der die Startseite tatsächlich ankam.
    // Vorher galt die Eingabe — und weil jeder Eingabe "https://" vorangestellt
    // wurde, stand hier praktisch immer "Ja".
    https: start.finalUrl.startsWith('https://') && !start.certificateInvalid,
    httpRedirectsToHttps: null, // wird separat geprüft
    certificateInvalid: start.certificateInvalid,
    hasViewport: $('meta[name="viewport"]').length > 0,
    lang: ($('html').attr('lang') ?? '').trim() || null,
    hasSitemap: false, // wird separat geprüft
    hasRobots: false,  // wird separat geprüft
    metaTitleLength: metaTitle.length,
    metaDescriptionLength: metaDesc.trim().length,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    h1Count: $('h1').length,
  }
}

export async function checkSitemapAndRobots(baseUrl: string): Promise<{ hasSitemap: boolean; hasRobots: boolean }> {
  const base = new URL(baseUrl).origin

  const [sitemap, robots] = await Promise.all([
    fetchPage(`${base}/sitemap.xml`),
    fetchPage(`${base}/robots.txt`),
  ])

  // Eine 200 allein reicht nicht: Viele Baukästen beantworten jede unbekannte
  // Adresse mit der Startseite. Gezählt wird nur, was nach Sitemap bzw.
  // robots.txt aussieht.
  const robotsOk = !!robots && robots.statusCode < 400 && !/<html/i.test(robots.html.slice(0, 500))
  const sitemapInRobots = robotsOk && /^\s*sitemap:/im.test(robots!.html)
  const sitemapOk = !!sitemap && sitemap.statusCode < 400 && /<(urlset|sitemapindex)/i.test(sitemap.html.slice(0, 2000))

  return { hasSitemap: sitemapOk || sitemapInRobots, hasRobots: robotsOk }
}

/** Leitet die http-Variante auf https weiter? `null`, wenn sie nicht erreichbar war. */
export async function checkHttpRedirect(baseUrl: string): Promise<boolean | null> {
  const u = new URL(baseUrl)
  u.protocol = 'http:'
  const page = await fetchPage(u.toString())
  if (!page) return null
  return page.finalUrl.startsWith('https://')
}
