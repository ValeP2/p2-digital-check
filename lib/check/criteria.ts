import type { CrawlResult } from '../crawl/crawlerTypes'
import type { PageSpeedOutcome } from '../measure/pagespeed'
import type { DimensionKey, Quelle, Urteil } from './types'

// ── Der Kriterienkatalog ─────────────────────────────────────────
//
// Warum Prüfpunkte statt einer Zahl pro Dimension: Ein Modell, das eine Zahl
// frei vergeben soll, nennt die Ankerzahl seines Bandes (im Kompass belegt:
// erst bekam jeder 55, nach der Kalibrierung jeder 80). Der alte Digital Check
// hatte genau das Problem — jeder "Recheck" ergab andere Werte.
//
// Hier urteilt das Modell nur noch über einzelne, konkrete Prüfpunkte mit
// Beleg (erfüllt / teilweise / nicht erfüllt), und die Zahl wird gerechnet.
// Was sich messen lässt, wird gemessen und gar nicht erst gefragt.
//
// Ändert sich etwas an Prüfpunkten, Gewichten oder Schwellen: KALIBRIERUNG
// hochzählen. Sie wird mit jedem Ergebnis gespeichert, damit ein Vergleich
// zwischen zwei Läufen erkennbar nur dann gilt, wenn beide gleich gerechnet
// wurden.
export const KALIBRIERUNG = 'kriterien-v2 (2026-10-09)'

export interface MeasureContext {
  crawl: CrawlResult
  pagespeed: PageSpeedOutcome
}

export interface Measured { urteil: Urteil; beleg: string }

export interface Criterion {
  id: string
  /** Kurzform für die Anzeige. */
  label: string
  gewicht: number
  quelle: Quelle
  /** Was genau zu prüfen ist — für das Modell (bei Messungen: Erklärung für die Anzeige). */
  pruefen: string
  /** Nur bei quelle "messung". */
  measure?: (ctx: MeasureContext) => Measured
}

export interface DimensionDef {
  key: DimensionKey
  label: string
  /** Gewicht im Gesamtscore. Summe über alle Dimensionen: 100. */
  gewicht: number
  /** Leitfrage, wie sie im Bericht steht. */
  frage: string
  kriterien: Criterion[]
}

// ── Hilfen für Messungen ─────────────────────────────────────────

const ok = (beleg: string): Measured => ({ urteil: 'erfuellt', beleg })
const part = (beleg: string): Measured => ({ urteil: 'teilweise', beleg })
const no = (beleg: string): Measured => ({ urteil: 'nicht_erfuellt', beleg })
const na = (beleg: string): Measured => ({ urteil: 'nicht_pruefbar', beleg })

function readablePages(ctx: MeasureContext) {
  return ctx.crawl.pages.filter(p => p.readable)
}

function pathOf(url: string): string {
  try { return new URL(url).pathname || '/' } catch { return url }
}

function stufe(value: number | null, gut: number, mittel: number, label: string, unit = ''): Measured {
  if (value === null) return na(`${label} wurde nicht gemessen`)
  const text = `${label}: ${value}${unit}`
  if (value >= gut) return ok(text)
  if (value >= mittel) return part(text)
  return no(text)
}

// ── Die zehn Dimensionen ─────────────────────────────────────────

export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'positionierung', label: 'Positionierung', gewicht: 12,
    frage: 'Versteht ein Erstbesucher sofort, wer hier was für wen anbietet?',
    kriterien: [
      { id: 'P1', label: 'Angebot und Zielgruppe auf den ersten Blick', gewicht: 3, quelle: 'inhalt',
        pruefen: 'Der erste Abschnitt der Startseite (Hauptüberschrift und erster Text) sagt, WAS angeboten wird und FÜR WEN. Zitiere ihn.' },
      { id: 'P2', label: 'Nutzen statt Selbstbeschreibung', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die Startseite formuliert einen Nutzen für den Kunden (was er davon hat), nicht nur eine Selbstbeschreibung ("Wir sind ein innovatives Team …").' },
      { id: 'P3', label: 'Unterscheidungsmerkmal erkennbar', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Es wird erkennbar, warum man genau diesen Anbieter wählen soll (Spezialisierung, Erfahrung, Arbeitsweise, Garantie …) — etwas, das nicht jeder Mitbewerber genauso schreiben könnte.' },
      { id: 'P4', label: 'Einzugsgebiet klar', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Bei regional tätigen Betrieben: Ort bzw. Einzugsgebiet ist auf der Startseite oder in der Hauptnavigation klar. Bei überregionalen/online Angeboten: "nicht_relevant".' },
    ],
  },
  {
    key: 'angebot', label: 'Angebot', gewicht: 12,
    frage: 'Ist das Angebot vollständig, konkret und verständlich beschrieben?',
    kriterien: [
      { id: 'A1', label: 'Leistungen vollständig und gegliedert', gewicht: 3, quelle: 'inhalt',
        pruefen: 'Die Leistungen/Produkte sind vollständig aufgeführt und sinnvoll gegliedert (Übersicht, Kategorien).' },
      { id: 'A2', label: 'Leistungen konkret beschrieben', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die Kernleistungen sind konkret beschrieben (Umfang, Beispiele, Ablauf, Ergebnis) statt nur als Schlagwortliste.' },
      { id: 'A3', label: 'Eigene Seite je Kernleistung', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Jede Kernleistung hat eine eigene Seite oder einen eigenen, klar abgegrenzten Abschnitt (prüfe auch die Pfadliste).' },
      { id: 'A4', label: 'Orientierung zu Preis oder Ablauf', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Es gibt eine Orientierung zu Preisen (Preise, ab-Preise, Pakete) ODER es wird erklärt, wie ein Angebot zustande kommt und wie die Zusammenarbeit abläuft.' },
    ],
  },
  {
    key: 'zielgruppe', label: 'Zielgruppe', gewicht: 8,
    frage: 'Spricht die Website ihre Kunden und deren Fragen gezielt an?',
    kriterien: [
      { id: 'Z1', label: 'Zielgruppe erkennbar angesprochen', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die Zielgruppe(n) werden erkennbar angesprochen (benannt oder durch ihre Situation/ihr Problem).' },
      { id: 'Z2', label: 'Typische Kundenfragen beantwortet', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die naheliegenden Fragen eines Interessenten werden beantwortet (z.B. Kosten, Dauer, Ablauf, Einsatzgebiet, Voraussetzungen) — als FAQ oder im Text.' },
      { id: 'Z3', label: 'Ansprache passt zur Zielgruppe', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Wortwahl, Beispiele und Detailtiefe passen zur Zielgruppe (Fachpublikum vs. Privatkunden).' },
    ],
  },
  {
    key: 'vertrauen', label: 'Vertrauen', gewicht: 12,
    frage: 'Gibt die Website Gründe, diesem Anbieter zu vertrauen?',
    kriterien: [
      { id: 'V1', label: 'Referenzen oder Kundenstimmen', gewicht: 3, quelle: 'inhalt',
        pruefen: 'Es gibt Referenzen, Kundenstimmen, Fallbeispiele oder Projektbeispiele mit konkretem Inhalt (nicht nur Logos ohne Kontext).' },
      { id: 'V2', label: 'Menschen sichtbar', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Inhaber oder Team sind mit Namen (und idealerweise Funktion/Bild) sichtbar.' },
      { id: 'V3', label: 'Erfahrung und Qualifikation belegt', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Erfahrung oder Qualifikation ist belegt: Gründungsjahr, Geschichte, Zertifikate, Mitgliedschaften, Auszeichnungen, Partner, Garantien.' },
      { id: 'V4', label: 'Impressum mit Firma und Adresse', gewicht: 2, quelle: 'messung',
        pruefen: 'Verantwortliche Firma und Adresse sind auffindbar (Impressum, Kontaktseite oder Seiteninhalt).',
        measure: ({ crawl }) => {
          const i = crawl.identity.imprint
          const where = i.sourceUrl ? ` (${pathOf(i.sourceUrl)})` : ''
          if (i.entity && i.address) return ok(`${i.entity}, ${i.address}${where}`)
          if (i.found) return part(`Nur teilweise gefunden${where}: ${[i.entity, i.address, i.uid].filter(Boolean).join(', ') || 'Angaben unvollständig'}`)
          return no(`In den ${crawl.pages.length} geprüften Seiten keine Firmen- und Adressangabe gefunden`)
        } },
      { id: 'V5', label: 'Datenschutzerklärung verlinkt', gewicht: 1, quelle: 'messung',
        pruefen: 'Eine Datenschutzerklärung ist verlinkt (in der Schweiz seit dem revidierten DSG praktisch Pflicht, sobald Daten erhoben werden).',
        measure: ({ crawl }) => crawl.pages.some(p => p.hasPrivacyLink)
          ? ok('Link zur Datenschutzerklärung vorhanden')
          : no(`In den ${crawl.pages.length} geprüften Seiten kein Link zu einer Datenschutzerklärung gefunden`) },
    ],
  },
  {
    key: 'conversion', label: 'Kontakt & Conversion', gewicht: 14,
    frage: 'Wird ein Interessent zur Kontaktaufnahme geführt, und ist sie einfach?',
    kriterien: [
      { id: 'C1', label: 'Klare Handlungsaufforderung auf der Startseite', gewicht: 3, quelle: 'inhalt',
        pruefen: 'Die Startseite hat eine klare Handlungsaufforderung im oberen Bereich (z.B. "Offerte anfordern", "Termin buchen", "Jetzt anrufen"). Nenne den Wortlaut.' },
      { id: 'C2', label: 'Kontakt von den Leistungsseiten aus', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Auch auf den Leistungs-/Angebotsseiten führt ein Kontakt-Element (Button, Telefonnummer, Formular) direkt weiter.' },
      { id: 'C3', label: 'Niederschwelliger Einstieg', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Es gibt einen niederschwelligen Einstieg neben dem klassischen Kontakt: Online-Termin, Rückrufbitte, Offertanfrage, Konfigurator, WhatsApp, Shop.' },
      { id: 'C4', label: 'Telefon klickbar', gewicht: 2, quelle: 'messung',
        pruefen: 'Eine Telefonnummer ist vorhanden und auf dem Handy direkt anklickbar (tel:-Link).',
        measure: ({ crawl }) => {
          const tel = crawl.pages.reduce((n, p) => n + p.telLinks, 0)
          if (tel > 0) return ok(`Klickbare Telefonnummer vorhanden${crawl.allPhoneNumbers[0] ? ` (${crawl.allPhoneNumbers[0]})` : ''}`)
          if (crawl.allPhoneNumbers.length > 0) return part(`Nummer ${crawl.allPhoneNumbers[0]} steht nur als Text, ist auf dem Handy nicht antippbar`)
          return no('Keine Telefonnummer in den geprüften Seiten gefunden')
        } },
      { id: 'C5', label: 'E-Mail-Adresse auffindbar', gewicht: 1, quelle: 'messung',
        pruefen: 'Eine E-Mail-Adresse ist angegeben.',
        measure: ({ crawl }) => {
          const mailto = crawl.pages.some(p => p.externalLinks.some(l => l.startsWith('mailto:')))
          if (crawl.allEmails.length > 0 || mailto) return ok(`E-Mail vorhanden${crawl.allEmails[0] ? ` (${crawl.allEmails[0]})` : ''}`)
          return no('Keine E-Mail-Adresse in den geprüften Seiten gefunden')
        } },
      { id: 'C6', label: 'Kontaktformular', gewicht: 1, quelle: 'messung',
        pruefen: 'Ein Kontakt- oder Anfrageformular ist vorhanden.',
        measure: ({ crawl }) => {
          const page = crawl.pages.find(p => p.hasContactForm)
          if (page) return ok(`Formular auf ${pathOf(page.url)}`)
          return no(`In den ${crawl.pages.length} geprüften Seiten kein Formular im HTML (per Skript nachgeladene Formulare sind so nicht erkennbar)`)
        } },
    ],
  },
  {
    key: 'seo', label: 'Inhalte & SEO', gewicht: 10,
    frage: 'Ist die Website für Suchmaschinen sauber aufbereitet?',
    kriterien: [
      { id: 'S1', label: 'Suchbegriffe in Titeln und Texten', gewicht: 3, quelle: 'inhalt',
        pruefen: 'Die Begriffe, mit denen Kunden suchen würden (Leistung + ggf. Ort), stehen in Seitentiteln, Hauptüberschriften und Texten der wichtigen Seiten. Nenne Beispiele, die fehlen oder vorhanden sind.' },
      { id: 'S2', label: 'Seitentitel der Startseite', gewicht: 2, quelle: 'messung',
        pruefen: 'Seitentitel vorhanden, 30–65 Zeichen.',
        measure: ({ crawl }) => {
          const len = crawl.technical.metaTitleLength
          const t = crawl.pages[0]?.title ?? ''
          if (len === 0) return no('Seitentitel fehlt')
          const text = `"${t.slice(0, 80)}" (${len} Zeichen)`
          if (len >= 30 && len <= 65) return ok(text)
          return part(`${text} — ${len < 30 ? 'zu kurz, ungenutzter Platz' : 'zu lang, wird in Google abgeschnitten'}`)
        } },
      { id: 'S3', label: 'Meta-Beschreibung der Startseite', gewicht: 1, quelle: 'messung',
        pruefen: 'Meta-Beschreibung vorhanden, 70–160 Zeichen.',
        measure: ({ crawl }) => {
          const len = crawl.technical.metaDescriptionLength
          if (len === 0) return no('Keine Meta-Beschreibung — Google wählt selbst einen Textausschnitt')
          if (len >= 70 && len <= 160) return ok(`${len} Zeichen`)
          return part(`${len} Zeichen — ${len < 70 ? 'zu kurz' : 'zu lang, wird abgeschnitten'}`)
        } },
      { id: 'S4', label: 'Genau eine Hauptüberschrift', gewicht: 1, quelle: 'messung',
        pruefen: 'Die Startseite hat genau eine H1.',
        measure: ({ crawl }) => {
          // Verschiedene Texte zählen, nicht Tags: Baukästen liefern dieselbe
          // H1 für jede Bildschirmgrösse einmal mit (Kompass-Befund 09.10.2026).
          const h1 = crawl.pages[0]?.h1 ?? []
          if (h1.length === 1) return ok(`Eine H1: "${h1[0].slice(0, 80)}"`)
          if (h1.length === 0) return no('Keine H1 auf der Startseite')
          return part(`${h1.length} verschiedene H1-Überschriften auf der Startseite: ${h1.slice(0, 3).map(t => `"${t.slice(0, 40)}"`).join(', ')}`)
        } },
      { id: 'S5', label: 'Individuelle Seitentitel', gewicht: 1, quelle: 'messung',
        pruefen: 'Die Unterseiten haben eigene, unterschiedliche Seitentitel.',
        measure: (ctx) => {
          const pages = readablePages(ctx)
          if (pages.length < 3) return na('Zu wenige Seiten gelesen, um es zu beurteilen')
          const unique = new Set(pages.map(p => p.title.trim().toLowerCase())).size
          const text = `${unique} verschiedene Titel auf ${pages.length} Seiten`
          if (unique / pages.length >= 0.9) return ok(text)
          if (unique / pages.length >= 0.5) return part(text)
          return no(`${text} — viele Seiten tragen denselben Titel`)
        } },
      { id: 'S6', label: 'Sitemap', gewicht: 1, quelle: 'messung',
        pruefen: 'Eine XML-Sitemap ist vorhanden.',
        measure: ({ crawl }) => crawl.technical.hasSitemap ? ok('sitemap.xml vorhanden') : no('Keine Sitemap gefunden (weder /sitemap.xml noch in robots.txt)') },
      { id: 'S7', label: 'Google-SEO-Prüfung', gewicht: 1, quelle: 'messung',
        pruefen: 'Googles Lighthouse-SEO-Prüfung (Mobil): ab 90 erfüllt, ab 70 teilweise.',
        measure: ({ pagespeed }) => pagespeed.measured ? stufe(pagespeed.seo, 90, 70, 'Lighthouse SEO', '/100') : na(pagespeed.reason) },
    ],
  },
  {
    key: 'navigation', label: 'Navigation', gewicht: 8,
    frage: 'Findet man sich schnell zurecht?',
    kriterien: [
      { id: 'N1', label: 'Übersichtliche Hauptnavigation', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die Hauptnavigation ist übersichtlich (etwa 7 Hauptpunkte oder weniger) und verwendet Begriffe, die ein Kunde versteht (keine internen Bezeichnungen).' },
      { id: 'N2', label: 'Wichtiges direkt erreichbar', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Angebot, Über uns und Kontakt sind direkt aus der Navigation erreichbar.' },
      { id: 'N3', label: 'Keine defekten Seiten', gewicht: 1, quelle: 'messung',
        pruefen: 'Unter den geprüften internen Seiten antwortet keine mit einem Fehler.',
        measure: ({ crawl }) => {
          const broken = crawl.pages.filter(p => p.statusCode >= 400)
          if (broken.length === 0) return ok(`Alle ${crawl.pages.length} geprüften Seiten erreichbar`)
          const list = broken.slice(0, 3).map(p => `${pathOf(p.url)} (${p.statusCode})`).join(', ')
          return broken.length === 1 ? part(`Fehlerseite: ${list}`) : no(`${broken.length} Fehlerseiten: ${list}`)
        } },
    ],
  },
  {
    key: 'sprache', label: 'Sprache & Text', gewicht: 8,
    frage: 'Sind die Texte verständlich, sauber und überzeugend?',
    kriterien: [
      { id: 'L1', label: 'Konkret statt Floskeln', gewicht: 2, quelle: 'inhalt',
        pruefen: 'Die Texte sind konkret und verständlich; austauschbare Floskeln ("höchste Qualität", "individuelle Lösungen") prägen sie nicht. Zitiere Beispiele.' },
      { id: 'L2', label: 'Keine Schreibfehler', gewicht: 2, quelle: 'inhalt',
        pruefen: 'In den gelesenen Texten fallen keine Rechtschreib- oder Tippfehler auf. Nenne gefundene Fehler wörtlich mit Seite. Achtung: In der Schweiz ist "ss" statt "ß" korrekt.' },
      { id: 'L3', label: 'Einheitliche Ansprache', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Die Ansprache (Du/Sie) und die Tonalität sind über die Seiten hinweg einheitlich.' },
      { id: 'L4', label: 'Gut lesbar gegliedert', gewicht: 1, quelle: 'inhalt',
        pruefen: 'Längere Texte sind mit Zwischentiteln, Absätzen oder Listen gegliedert, statt als Textblock.' },
    ],
  },
  {
    key: 'technik', label: 'Technik & Mobile', gewicht: 8,
    frage: 'Ist die Website technisch sicher, schnell und mobiltauglich?',
    kriterien: [
      { id: 'T1', label: 'HTTPS mit Weiterleitung', gewicht: 3, quelle: 'messung',
        pruefen: 'Die Seite läuft auf HTTPS mit gültigem Zertifikat, und http:// leitet auf https:// um.',
        measure: ({ crawl }) => {
          const t = crawl.technical
          if (t.certificateInvalid) return no('Zertifikat ungültig — Browser zeigen eine Sicherheitswarnung')
          if (!t.https) return no('Seite läuft ohne HTTPS — Browser markieren sie als "nicht sicher"')
          if (t.httpRedirectsToHttps === false) return part('HTTPS aktiv, aber http:// leitet nicht auf https:// um')
          return ok(t.httpRedirectsToHttps ? 'HTTPS aktiv, http:// leitet um' : 'HTTPS aktiv')
        } },
      { id: 'T2', label: 'Mobilansicht vorgesehen', gewicht: 2, quelle: 'messung',
        pruefen: 'Die Seite ist für Handys eingerichtet (viewport-Angabe).',
        measure: ({ crawl }) => crawl.technical.hasViewport ? ok('Viewport für Mobilgeräte gesetzt') : no('Keine Viewport-Angabe — auf dem Handy wird die Desktop-Ansicht verkleinert') },
      { id: 'T3', label: 'Ladetempo (Mobil)', gewicht: 3, quelle: 'messung',
        pruefen: 'Google-PageSpeed-Leistungswert mobil: ab 90 erfüllt, ab 50 teilweise.',
        measure: ({ pagespeed }) => pagespeed.measured ? stufe(pagespeed.performance, 90, 50, 'PageSpeed mobil', '/100') : na(pagespeed.reason) },
      { id: 'T4', label: 'Hauptinhalt schnell sichtbar', gewicht: 2, quelle: 'messung',
        pruefen: 'Largest Contentful Paint (echte Besuche, sonst Labormessung): bis 2.5 s erfüllt, bis 4 s teilweise.',
        measure: ({ pagespeed }) => {
          if (!pagespeed.measured) return na(pagespeed.reason)
          const field = pagespeed.field?.lcpMs ?? null
          const ms = field ?? pagespeed.lcpMs
          if (ms === null) return na('LCP nicht gemessen')
          const text = `${(ms / 1000).toFixed(1)} s bis der Hauptinhalt steht (${field !== null ? 'echte Besuche' : 'Labormessung'})`
          return ms <= 2500 ? ok(text) : ms <= 4000 ? part(text) : no(text)
        } },
      { id: 'T5', label: 'Bilder mit Alternativtext', gewicht: 1, quelle: 'messung',
        pruefen: 'Bilder haben einen Alternativtext (Barrierefreiheit, Bildersuche): ab 90 % erfüllt, ab 50 % teilweise.',
        measure: (ctx) => {
          const pages = readablePages(ctx)
          const total = pages.reduce((n, p) => n + p.images, 0)
          if (total === 0) return { urteil: 'nicht_relevant', beleg: 'Keine Bilder im HTML gefunden' }
          const alt = pages.reduce((n, p) => n + p.imagesWithAlt, 0)
          const pct = Math.round((alt / total) * 100)
          const text = `${alt} von ${total} Bildern mit Alternativtext (${pct} %)`
          return pct >= 90 ? ok(text) : pct >= 50 ? part(text) : no(text)
        } },
      { id: 'T6', label: 'Strukturierte Daten', gewicht: 1, quelle: 'messung',
        pruefen: 'Strukturierte Daten (JSON-LD) für Suchmaschinen sind vorhanden.',
        measure: ({ crawl }) => crawl.technical.hasStructuredData ? ok('JSON-LD vorhanden') : no('Keine strukturierten Daten (JSON-LD) — Google kennt Firma, Adresse, Öffnungszeiten nicht maschinenlesbar') },
      { id: 'T7', label: 'Linkvorschau (Open Graph)', gewicht: 1, quelle: 'messung',
        pruefen: 'Open-Graph-Angaben für Linkvorschauen in WhatsApp, LinkedIn & Co. sind vorhanden.',
        measure: ({ crawl }) => crawl.technical.hasOpenGraph ? ok('Open-Graph-Angaben vorhanden') : no('Keine Open-Graph-Angaben — geteilte Links zeigen kein gestaltetes Vorschaubild') },
      { id: 'T8', label: 'Barrierefreiheit (Google-Prüfung)', gewicht: 1, quelle: 'messung',
        pruefen: 'Googles Lighthouse-Prüfung zur Barrierefreiheit: ab 90 erfüllt, ab 70 teilweise.',
        measure: ({ pagespeed }) => pagespeed.measured ? stufe(pagespeed.accessibility, 90, 70, 'Lighthouse Barrierefreiheit', '/100') : na(pagespeed.reason) },
    ],
  },
  {
    key: 'externe_sichtbarkeit', label: 'Externe Sichtbarkeit', gewicht: 8,
    frage: 'Ist das Unternehmen ausserhalb der eigenen Website präsent?',
    kriterien: [
      // Gewicht 2 statt 3: Per Websuche ist ein Google-Profil oft nicht eindeutig
      // feststellbar (meist "nicht prüfbar") — es soll den Bereich nicht dominieren.
      { id: 'E1', label: 'Google-Unternehmensprofil mit Bewertungen', gewicht: 2, quelle: 'recherche',
        pruefen: 'Laut Recherche gibt es ein Google-Unternehmensprofil mit Bewertungen. Erfüllt: Profil mit Bewertungen; teilweise: Profil ohne/mit sehr wenigen Bewertungen; nicht_pruefbar, wenn die Recherche dazu nichts Eindeutiges ergab.' },
      { id: 'E2', label: 'Einträge in Verzeichnissen', gewicht: 1, quelle: 'recherche',
        pruefen: 'Laut Recherche ist das Unternehmen in Schweizer Verzeichnissen (local.ch, search.ch) oder relevanten Branchenportalen eingetragen.' },
      { id: 'E3', label: 'Social-Media-Profile verlinkt', gewicht: 1, quelle: 'messung',
        pruefen: 'Die Website verlinkt ihre Social-Media-Profile.',
        measure: ({ crawl }) => crawl.socialProfiles.length > 0
          ? ok(`Verlinkt: ${crawl.socialProfiles.map(s => s.platform).join(', ')}`)
          : no('Die geprüften Seiten verlinken keine Social-Media-Profile') },
      { id: 'E4', label: 'Social Media aktiv', gewicht: 2, quelle: 'recherche',
        pruefen: 'Laut Recherche ist mindestens ein Social-Media-Profil aktiv (sichtbare Beiträge in den letzten drei Monaten). nicht_pruefbar, wenn die Aktivität nicht feststellbar war. nicht_relevant nur, wenn für dieses Geschäft Social Media erkennbar keine Rolle spielt.' },
      { id: 'E5', label: 'Erwähnungen durch Dritte', gewicht: 1, quelle: 'recherche',
        pruefen: 'Laut Recherche wird das Unternehmen von Dritten erwähnt (Presse, Branchenportale, Verbände, Partner). Kein Fund ist nur dann "nicht_erfuellt", wenn gezielt gesucht wurde.' },
    ],
  },
]

export const DIMENSION_BY_KEY = Object.fromEntries(DIMENSIONS.map(d => [d.key, d])) as Record<DimensionKey, DimensionDef>

/** Prüfpunkte, die das Modell beurteilt (alle ausser Messungen). */
export function modelCriteria(dim: DimensionDef): Criterion[] {
  return dim.kriterien.filter(c => c.quelle !== 'messung')
}
