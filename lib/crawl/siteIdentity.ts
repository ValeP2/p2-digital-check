import * as cheerio from 'cheerio'

// ── Wer betreibt die Seite, und womit ist sie gebaut? ────────────
//
// Zwei Angaben, die vor jeder Bewertung stehen sollten:
//   · Verantwortlich — aus Impressum/Kontakt, mit Fundstelle.
//   · System — Baukasten oder CMS hinter der Seite.
//
// Beides wird ausschliesslich aus Belegen gebildet. Findet sich nichts, steht
// das auch so da: "nicht gefunden" ist eine Information, eine geratene Angabe
// wäre eine Behauptung.

export interface PlatformInfo {
  /** Erkanntes System, z.B. "WordPress" — null, wenn nichts Belastbares. */
  name: string | null
  /** Woran es erkannt wurde, im Klartext für die Anzeige. */
  evidence: string | null
  confidence: 'sicher' | 'wahrscheinlich' | null
}

export interface ImprintInfo {
  found: boolean
  /** Seite, aus der die Angaben stammen. */
  sourceUrl: string | null
  /**
   * Woher die Angaben kommen — die Anzeige muss den Unterschied machen:
   * ein Impressum ist eine Selbstauskunft, ein Fund im Fliesstext nicht.
   */
  source: 'impressum' | 'kontakt' | 'inhalt' | null
  entity: string | null
  address: string | null
  responsible: string | null
  uid: string | null
  email: string | null
  phone: string | null
}

export interface SiteIdentity {
  platform: PlatformInfo
  hosting: string | null
  imprint: ImprintInfo
}

// Fingerabdrücke, absteigend nach Eindeutigkeit geprüft. Die Liste ist
// bewusst eine Tabelle und keine Verzweigung im Code: ein neues System
// einzutragen ist damit eine Zeile, kein Eingriff in die Logik.
const PLATFORM_FINGERPRINTS: { name: string; needles: string[]; label: string }[] = [
  { name: 'WordPress',    needles: ['/wp-content/', '/wp-includes/', '/wp-json/'], label: 'WordPress-Pfade im Quelltext' },
  { name: 'Framer',       needles: ['framerusercontent.com', 'data-framer-name'],  label: 'Framer-Auslieferung im Quelltext' },
  { name: 'Webflow',      needles: ['assets.website-files.com', 'uploads-ssl.webflow.com', '.webflow.io', 'data-wf-page'], label: 'Webflow-Kennungen im Quelltext' },
  { name: 'Shopify',      needles: ['cdn.shopify.com', 'Shopify.theme'],           label: 'Shopify-Auslieferung im Quelltext' },
  { name: 'Wix',          needles: ['static.parastorage.com', 'wix-code', 'X-Wix'], label: 'Wix-Auslieferung im Quelltext' },
  { name: 'Squarespace',  needles: ['static1.squarespace.com', 'squarespace.com/universal'], label: 'Squarespace-Auslieferung im Quelltext' },
  { name: 'TYPO3',        needles: ['typo3conf/', 'typo3temp/'],                   label: 'TYPO3-Pfade im Quelltext' },
  { name: 'Drupal',       needles: ['/sites/default/files/', 'drupal-settings-json'], label: 'Drupal-Kennungen im Quelltext' },
  { name: 'Joomla',       needles: ['/media/jui/', '/components/com_'],            label: 'Joomla-Pfade im Quelltext' },
  { name: 'Contao',       needles: ['/files/contao/', 'contao/'],                  label: 'Contao-Pfade im Quelltext' },
  { name: 'Jimdo',        needles: ['jimdo-storage', 'jimstatic.com'],             label: 'Jimdo-Auslieferung im Quelltext' },
  { name: 'HubSpot CMS',  needles: ['hs-sites.com', 'hubspot.net/hub/'],           label: 'HubSpot-Auslieferung im Quelltext' },
  { name: 'Shopware',     needles: ['/bundles/storefront/', 'shopware'],           label: 'Shopware-Pfade im Quelltext' },
  { name: 'Next.js',      needles: ['/_next/static/'],                             label: 'Next.js-Bundle im Quelltext' },
  { name: 'Nuxt',         needles: ['/_nuxt/'],                                    label: 'Nuxt-Bundle im Quelltext' },
]

// Hosting-Erkennung aus Antwort-Headern. Zusatzinformation, nie ein Ersatz für
// die Systemerkennung: Vercel sagt nichts darüber, womit gebaut wurde.
const HOSTING_HEADERS: { header: string; contains: string; name: string }[] = [
  { header: 'server',          contains: 'vercel',     name: 'Vercel' },
  { header: 'x-vercel-id',     contains: '',           name: 'Vercel' },
  { header: 'server',          contains: 'cloudflare', name: 'Cloudflare' },
  { header: 'server',          contains: 'netlify',    name: 'Netlify' },
  { header: 'x-nf-request-id', contains: '',           name: 'Netlify' },
  { header: 'server',          contains: 'nginx',      name: 'nginx' },
  { header: 'server',          contains: 'apache',     name: 'Apache' },
  { header: 'server',          contains: 'microsoft-iis', name: 'IIS' },
]

export function detectPlatform(html: string, headers: Record<string, string> = {}): PlatformInfo {
  // 1. Die Seite sagt es selbst — das ist die stärkste Auskunft.
  const $ = cheerio.load(html)
  const generator = ($('meta[name="generator"]').attr('content') ?? '').trim()
  if (generator) {
    // "Framer 56ce7df" oder "WordPress 6.5.2" — der Name steht vorn, die
    // Build-Kennung dahinter interessiert niemanden.
    const name = generator.split(/[\s\d]/)[0] || generator
    return {
      name: name.replace(/[!.,;]$/, ''),
      evidence: `Angabe der Seite selbst (meta generator: "${generator}")`,
      confidence: 'sicher',
    }
  }

  const poweredBy = headers['x-powered-by'] ?? ''
  if (/wordpress/i.test(poweredBy)) {
    return { name: 'WordPress', evidence: `Antwort-Header x-powered-by: "${poweredBy}"`, confidence: 'sicher' }
  }

  // 2. Sonst an der Auslieferung erkennen.
  for (const fp of PLATFORM_FINGERPRINTS) {
    const hit = fp.needles.find(n => html.includes(n))
    if (hit) {
      return { name: fp.name, evidence: `${fp.label} ("${hit}")`, confidence: 'wahrscheinlich' }
    }
  }

  return { name: null, evidence: null, confidence: null }
}

export function detectHosting(headers: Record<string, string> = {}): string | null {
  for (const h of HOSTING_HEADERS) {
    const value = headers[h.header]
    if (value === undefined) continue
    if (!h.contains || value.toLowerCase().includes(h.contains)) return h.name
  }
  return null
}

// ── Impressum ────────────────────────────────────────────────────

// Nach Eignung sortiert: ein echtes Impressum schlägt eine Kontaktseite,
// diese schlägt ein "Über uns". In der Schweiz gibt es die deutsche
// Impressumspflicht so nicht — bei vielen Auftritten stehen die
// Verantwortlichen nur auf der Kontaktseite. Deshalb beide Wege.
const IMPRINT_PATH_PRIORITY: { pattern: RegExp; rank: number }[] = [
  { pattern: /impressum|imprint|mentions-legales|legal-notice|colophon/i, rank: 0 },
  { pattern: /\blegal\b|rechtliches|agb|datenschutz/i, rank: 1 },
  { pattern: /kontakt|contact|contatto/i, rank: 2 },
  { pattern: /ueber-uns|über-uns|about|unternehmen|firma/i, rank: 3 },
]

/** Wählt aus bekannten Adressen die aussichtsreichste Impressumsseite. */
export function pickImprintUrl(urls: string[]): { url: string; source: 'impressum' | 'kontakt' } | null {
  let best: { url: string; rank: number } | null = null
  for (const url of urls) {
    let path: string
    try { path = new URL(url).pathname } catch { continue }
    for (const { pattern, rank } of IMPRINT_PATH_PRIORITY) {
      if (!pattern.test(path)) continue
      if (!best || rank < best.rank) best = { url, rank }
      break
    }
  }
  if (!best) return null
  return { url: best.url, source: best.rank <= 1 ? 'impressum' : 'kontakt' }
}

/**
 * Schneidet den Firmennamen aus einer Zeile heraus, statt die ganze Zeile zu
 * nehmen. Nötig, weil die Angabe oft mitten im Fliesstext steht
 * ("Veranstalterin des Wettbewerbs ist die Muster AG, Bielstrasse 98, …") —
 * die ganze Zeile als Firmennamen anzuzeigen wäre schlicht falsch.
 */
function entityFromLine(line: string): string | null {
  const match = LEGAL_FORM.exec(line)
  if (!match) return null
  const before = line.slice(0, match.index).trim()
  const tokens = before.split(/\s+/).filter(Boolean)
  const picked: string[] = []
  // Rückwärts alles einsammeln, was zum Namen gehören kann: Eigennamen
  // beginnen gross, "&" und Bindestriche verbinden sie. Beim ersten
  // kleingeschriebenen Wort ("ist die …") endet der Name.
  for (let i = tokens.length - 1; i >= 0 && picked.length < 6; i--) {
    const token = tokens[i]
    if (token === '&' || token === '-' || /^[A-ZÄÖÜ0-9][\wäöüéèàÄÖÜ&.'’\-]*$/.test(token)) picked.unshift(token)
    else break
  }
  if (picked.length === 0) return null
  return `${picked.join(' ')} ${match[0]}`.replace(/\s{2,}/g, ' ').trim()
}

const UID_REGEX = /CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}/i
const LEGAL_FORM = /\b(AG|GmbH|SA|Sàrl|Sarl|SAGL|S\.A\.|KlG|KG|Kollektivgesellschaft|Genossenschaft|Stiftung|Verein|e\.V\.|Ltd\.?|Inc\.?|UG)\b/
const SWISS_PLACE = /\b(?:CH[- ])?\d{4}\s+[A-ZÄÖÜ][\wäöüéèàï.\- ]{2,30}/
const STREET = /\b[A-ZÄÖÜ][\wäöüéèà.\- ]{2,40}(?:strasse|str\.|straße|weg|platz|gasse|allee|ring|rue|route|via|chemin)\s*\d+[a-z]?\b/i
const RESPONSIBLE_LABEL = /(verantwortlich(?:e[rn]?)?(?:\s+für\s+den\s+Inhalt)?|inhaltlich\s+verantwortlich|redaktion|herausgeber(?:in)?|vertreten\s+durch)\s*[:\-–]\s*(.{3,80})/i

/**
 * Liest die belegbaren Angaben aus dem Text einer Impressums- oder
 * Kontaktseite. Jedes Feld ist einzeln optional — eine Seite, auf der nur die
 * Firma steht, liefert eben nur die Firma.
 */
export function extractImprint(
  lines: string[],
  sourceUrl: string,
  source: 'impressum' | 'kontakt' | 'inhalt' = 'impressum'
): ImprintInfo {
  const text = lines.join('\n')

  const uidMatch = text.match(UID_REGEX)
  const responsibleMatch = text.match(RESPONSIBLE_LABEL)

  // Firma: erste Zeile mit einer Rechtsform. Die Zeile wird als Ganzes
  // genommen, aber vorne beschnitten, wenn ein Label davorsteht.
  const entity = lines.map(entityFromLine).find(Boolean) ?? null

  // Adresse: Strasse und Ort dürfen auf einer oder auf zwei Zeilen stehen.
  const streetLine = lines.find(l => STREET.test(l) && l.length <= 120)
  const placeLine = lines.find(l => SWISS_PLACE.test(l) && l.length <= 120)
  let address: string | null = null
  if (streetLine && placeLine && streetLine === placeLine) {
    const street = streetLine.match(STREET)?.[0] ?? ''
    const place = placeLine.match(SWISS_PLACE)?.[0] ?? ''
    address = [street, place].filter(Boolean).join(', ')
  }
  else if (streetLine && placeLine) address = `${streetLine.match(STREET)?.[0] ?? streetLine}, ${placeLine.match(SWISS_PLACE)?.[0] ?? placeLine}`
  else if (placeLine) address = placeLine.match(SWISS_PLACE)?.[0] ?? placeLine
  else if (streetLine) address = streetLine.match(STREET)?.[0] ?? streetLine

  const email = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] ?? null
  const phone = text.match(/(?:\+41|0041|0)[\s\-.]?(?:\d[\s\-.]?){8,11}\d/)?.[0] ?? null

  const found = Boolean(entity || address || responsibleMatch || uidMatch)

  return {
    found,
    sourceUrl,
    source,
    entity: entity ?? null,
    address: address ? address.replace(/\s{2,}/g, ' ').replace(/[.,;]+$/, '').trim() : null,
    responsible: responsibleMatch ? responsibleMatch[2].trim().replace(/[.;]$/, '') : null,
    uid: uidMatch ? uidMatch[0].toUpperCase().replace(/\s/g, '-') : null,
    email,
    phone,
  }
}

export const EMPTY_IMPRINT: ImprintInfo = {
  found: false, sourceUrl: null, source: null, entity: null, address: null,
  responsible: null, uid: null, email: null, phone: null,
}
