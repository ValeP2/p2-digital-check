import type { SiteIdentity } from './siteIdentity'

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
  /** Links auf tel: — eine klickbare Nummer zählt mehr als eine abgetippte. */
  telLinks: number
  /** Formular mit Mitteilungsfeld oder E-Mail-Feld (kein Such- oder Login-Formular). */
  hasContactForm: boolean
  /** Verweis auf eine Datenschutzerklärung. */
  hasPrivacyLink: boolean
  /** Text stammt (auch) aus eingebetteten Framework-Daten statt aus dem HTML. */
  usedFrameworkData: boolean
  /** Konnte aus dem ausgelieferten HTML überhaupt Inhalt gelesen werden? */
  readable: boolean
  /** Warum nicht — für die Analyse, damit sie das nicht als Mangel der Seite wertet. */
  unreadableReason: string | null
}

export interface TechnicalData {
  /** Endadresse der Startseite nach Weiterleitungen ist https. */
  https: boolean
  /** http:// leitet auf https:// weiter — null, wenn nicht prüfbar. */
  httpRedirectsToHttps: boolean | null
  /** Zertifikat der Startseite ungültig (abgelaufen, falscher Name, selbstsigniert). */
  certificateInvalid: boolean
  /** <meta name="viewport"> vorhanden — Voraussetzung für eine Mobilansicht. */
  hasViewport: boolean
  /** lang-Attribut des Dokuments, z.B. "de-CH". */
  lang: string | null
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
  /** Adressen, die verlinkt sind, aber nicht abgerufen werden konnten. */
  unreachable: string[]
  /** Betreiberin und eingesetztes System, soweit belegbar. */
  identity: SiteIdentity
  technical: TechnicalData
  allPhoneNumbers: string[]
  allEmails: string[]
  allInternalLinks: string[]
  navigationItems: string[]
  /** Auf der Website verlinkte Social-Media-Profile, je Plattform die erste Adresse. */
  socialProfiles: { platform: string; url: string }[]
}
