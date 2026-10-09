import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { PageData } from './crawlerTypes'
import { readableLines, readableElementText, dedupeOrdered } from './readableText'
import { extractFrameworkText } from './frameworkData'

const PHONE_REGEX = /(?:\+41|0041|0)[\s\-.]?(?:\d[\s\-.]?){8,11}\d/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Unterhalb dieser Wortzahl gilt eine Seite als nicht gelesen statt als dünn.
// Der Unterschied ist entscheidend: "wenig Inhalt" ist ein Befund über die
// Website, "nicht gelesen" ein Befund über unser Werkzeug. Beides zu
// vermischen hat die Bewertung nachweislich verfälscht.
const MIN_READABLE_WORDS = 25

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function extractPageData(html: string, url: string, statusCode: number): PageData {
  const $ = cheerio.load(html)

  // Titel und Meta ZUERST lesen — sie stehen im <head>, den die
  // Textextraktion gleich entfernt. Vorher stand die Reihenfolge andersherum,
  // wodurch für jede Seite jeder Website ein leerer Titel und eine leere
  // Beschreibung in die Analyse gingen; das Modell hat daraus regelmässig
  // "fehlende Seitentitel" gefolgert.
  const title = cleanText($('title').first().text())
  const metaDescription = cleanText($('meta[name="description"]').attr('content') ?? '')

  const headings = (selector: 'h1' | 'h2' | 'h3'): string[] =>
    dedupeOrdered(
      $(selector).map((_, el) => readableElementText($, el as Element)).get().filter(Boolean)
    )

  const h1 = headings('h1')
  const h2 = headings('h2')
  const h3 = headings('h3')

  const base = new URL(url)
  const internalLinks: string[] = []
  const externalLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return
    try {
      const resolved = new URL(href, url)
      if (resolved.hostname === base.hostname) internalLinks.push(resolved.toString())
      else externalLinks.push(resolved.toString())
    } catch { /* ignore */ }
  })

  const formFields: string[] = []
  $('form').each((_, form) => {
    $(form).find('input, textarea, select').each((_, field) => {
      const name = $(field).attr('name') ?? $(field).attr('placeholder') ?? $(field).attr('type') ?? ''
      if (name) formFields.push(name)
    })
  })
  const hasForms = $('form').length > 0
  // Kontaktformular = Formular mit Mitteilungs- oder E-Mail-Feld. Such- und
  // Login-Formulare zählen nicht, sonst hätte jede Seite mit Suchfeld eins.
  const hasContactForm = $('form').toArray().some(form => {
    const f = $(form)
    if (f.find('input[type="password"]').length > 0) return false
    return f.find('textarea, input[type="email"]').length > 0
  })
  const telLinks = $('a[href^="tel:"]').length
  const hasPrivacyLink = $('a[href]').toArray().some(el => {
    const href = ($(el).attr('href') ?? '').toLowerCase()
    const text = $(el).text().toLowerCase()
    return /datenschutz|privacy|privacidad|confidentialit/.test(href + ' ' + text)
  })

  const images = $('img').length
  const imagesWithAlt = $('img[alt]').filter((_, el) => ($(el).attr('alt') ?? '').trim().length > 0).length

  const hasWhatsApp = html.toLowerCase().includes('whatsapp')

  // Ab hier wird der Baum verändert (Skripte/Stile fallen weg) — alles, was
  // Attribute braucht, muss vorher gelesen sein.
  const lines = readableLines($)
  let bodyText = lines.join('\n').slice(0, 8000)
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length

  // Fast leer? Dann die eingebetteten Framework-Daten dazunehmen — aber als
  // solche markiert, und die Wortzahl bleibt die des echten HTML-Textes.
  let usedFrameworkData = false
  if (wordCount < MIN_READABLE_WORDS) {
    const frameworkText = extractFrameworkText(html)
    if (frameworkText) {
      bodyText = `${bodyText}\n[Aus eingebetteten Framework-Daten rekonstruiert:]\n${frameworkText}`.slice(0, 8000)
      usedFrameworkData = true
    }
  }

  const phoneNumbers = [...new Set(bodyText.match(PHONE_REGEX) ?? [])]
  const emails = [...new Set(bodyText.match(EMAIL_REGEX) ?? [])]

  const readable = statusCode < 400 && (wordCount >= MIN_READABLE_WORDS || usedFrameworkData)
  const unreadableReason = readable
    ? null
    : statusCode >= 400
      ? `Server antwortete mit Status ${statusCode}`
      : 'Kein lesbarer Text im ausgelieferten HTML (Inhalt wird vermutlich erst im Browser aufgebaut)'

  return {
    url,
    statusCode,
    title,
    metaDescription,
    h1,
    h2,
    h3,
    bodyText,
    internalLinks: [...new Set(internalLinks)],
    externalLinks: [...new Set(externalLinks)],
    phoneNumbers,
    emails,
    hasForms,
    formFields,
    hasWhatsApp,
    images,
    imagesWithAlt,
    wordCount,
    telLinks,
    hasContactForm,
    hasPrivacyLink,
    usedFrameworkData,
    readable,
    unreadableReason,
  }
}
