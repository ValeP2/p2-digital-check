import axios from 'axios'
import * as cheerio from 'cheerio'

export interface PageData {
  url: string
  statusCode: number
  title: string
  metaDescription: string
  h1: string[]
  h2: string[]
  h3: string[]
  bodyText: string
  internalLinks: string[]
  externalLinks: string[]
  phoneNumbers: string[]
  emails: string[]
  hasForms: boolean
  formFields: string[]
  hasWhatsApp: boolean
  images: number
  imagesWithAlt: number
  wordCount: number
}

export interface TechnicalData {
  https: boolean
  hasSitemap: boolean
  hasRobots: boolean
  metaTitleLength: number
  metaDescriptionLength: number
  hasOpenGraph: boolean
  hasStructuredData: boolean
  h1Count: number
}

export interface CrawlResult {
  inputUrl: string
  baseUrl: string
  companyName: string
  crawledAt: string
  pages: PageData[]
  technical: TechnicalData
  allPhoneNumbers: string[]
  allEmails: string[]
  navigationItems: string[]
}

const PHONE_REGEX = /(?:\+41|0041|0)[\s\-.]?(?:\d[\s\-.]?){8,11}\d/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

async function fetchPage(url: string): Promise<{ html: string; statusCode: number } | null> {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; P2DigitalCheck/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8',
      },
      maxRedirects: 5,
    })
    return { html: response.data as string, statusCode: response.status }
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return { html: error.response.data as string, statusCode: error.response.status }
    }
    return null
  }
}

function extractPageData(html: string, url: string, statusCode: number): PageData {
  const $ = cheerio.load(html)
  $('script, style, noscript').remove()

  const title = cleanText($('title').text())
  const metaDescription = cleanText($('meta[name="description"]').attr('content') ?? '')
  const h1 = $('h1').map((_, el) => cleanText($(el).text())).get().filter(Boolean)
  const h2 = $('h2').map((_, el) => cleanText($(el).text())).get().filter(Boolean)
  const h3 = $('h3').map((_, el) => cleanText($(el).text())).get().filter(Boolean)
  const bodyText = cleanText($('body').text()).slice(0, 6000)
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length

  const base = new URL(url)
  const internalLinks: string[] = []
  const externalLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    try {
      const resolved = new URL(href, url)
      if (resolved.hostname === base.hostname) internalLinks.push(resolved.toString())
      else externalLinks.push(resolved.toString())
    } catch { /* ignore */ }
  })

  const phoneNumbers = [...new Set(bodyText.match(PHONE_REGEX) ?? [])]
  const emails = [...new Set(bodyText.match(EMAIL_REGEX) ?? [])]

  const formFields: string[] = []
  $('form').each((_, form) => {
    $(form).find('input, textarea, select').each((_, field) => {
      const name = $(field).attr('name') ?? $(field).attr('placeholder') ?? $(field).attr('type') ?? ''
      if (name) formFields.push(name)
    })
  })

  return {
    url, statusCode, title, metaDescription, h1, h2, h3, bodyText,
    internalLinks: [...new Set(internalLinks)],
    externalLinks: [...new Set(externalLinks)],
    phoneNumbers, emails,
    hasForms: $('form').length > 0,
    formFields,
    hasWhatsApp: html.toLowerCase().includes('whatsapp'),
    images: $('img').length,
    imagesWithAlt: $('img[alt]').filter((_, el) => ($(el).attr('alt') ?? '').trim().length > 0).length,
    wordCount,
  }
}

function prioritiseLinks(links: string[], maxLinks: number): string[] {
  const keywords = ['service', 'reparatur', 'angebot', 'leistung', 'ueber', 'uber', 'team', 'kontakt', 'referenz', 'partner', 'verkauf', 'produkt', 'about', 'contact', 'offer']
  const scored = links.map(link => {
    const path = new URL(link).pathname.toLowerCase()
    let score = 0
    for (const kw of keywords) { if (path.includes(kw)) score += 2 }
    return { link, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxLinks).map(s => s.link)
}

export async function crawlWebsite(inputUrl: string): Promise<CrawlResult> {
  const startResult = await fetchPage(inputUrl)
  if (!startResult) throw new Error('Startseite konnte nicht abgerufen werden')

  const { html: startHtml, statusCode: startStatus } = startResult
  const baseUrl = new URL(inputUrl).origin
  const $ = cheerio.load(startHtml)

  const startPage = extractPageData(startHtml, inputUrl, startStatus)
  const pages: PageData[] = [startPage]

  const navigationItems = $('nav a, header a').map((_, el) => $(el).text().trim()).get().filter(Boolean)

  const base = new URL(inputUrl)
  const allLinks = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    try {
      const resolved = new URL(href, inputUrl)
      resolved.hash = ''
      if (resolved.hostname === base.hostname && resolved.toString() !== inputUrl) {
        allLinks.add(resolved.toString())
      }
    } catch { /* ignore */ }
  })

  const toVisit = prioritiseLinks(Array.from(allLinks), 9)
  const visited = new Set<string>([inputUrl])

  for (const link of toVisit) {
    if (visited.has(link)) continue
    visited.add(link)
    const result = await fetchPage(link)
    if (!result) continue
    pages.push(extractPageData(result.html, link, result.statusCode))
    await new Promise(r => setTimeout(r, 300))
  }

  // Technische Daten
  const technical: TechnicalData = {
    https: inputUrl.startsWith('https://'),
    hasSitemap: false,
    hasRobots: false,
    metaTitleLength: startPage.title.length,
    metaDescriptionLength: startPage.metaDescription.length,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    h1Count: $('h1').length,
  }

  const [sitemapRes, robotsRes] = await Promise.all([
    fetchPage(`${baseUrl}/sitemap.xml`),
    fetchPage(`${baseUrl}/robots.txt`),
  ])
  technical.hasSitemap = !!sitemapRes && sitemapRes.statusCode < 400
  technical.hasRobots = !!robotsRes && robotsRes.statusCode < 400

  return {
    inputUrl,
    baseUrl,
    companyName: startPage.title.replace(/[-|–—].*$/, '').trim() || base.hostname,
    crawledAt: new Date().toISOString(),
    pages,
    technical,
    allPhoneNumbers: [...new Set(pages.flatMap(p => p.phoneNumbers))],
    allEmails: [...new Set(pages.flatMap(p => p.emails))],
    navigationItems: [...new Set(navigationItems)],
  }
}
