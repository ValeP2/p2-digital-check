import type { CrawlResult } from '../crawl/crawlerTypes'
import { DIMENSIONS, modelCriteria } from './criteria'
import type { CriterionResult, DimensionKey } from './types'

// Die Regeln stammen aus dem Kompass, wo jede einzelne nach einem belegten
// Fehlurteil entstanden ist (Belegpflicht, keine falschen "fehlt"-Meldungen,
// HTML-Fallen, am Zweck messen). Für den Digital Check angepasst: Leser ist
// ein KMU-Inhaber im Gespräch mit P2, kein Kommunikationsprofi.

export const SYSTEM_PROMPT = `Du bist der P2 Digital Check, ein Analysewerkzeug der P2 Kommunikation AG. Du prüfst die Website eines Schweizer KMU aus Marketingsicht und beurteilst sie anhand eines festen Kriterienkatalogs. Du urteilst reproduzierbar: Dieselbe Datenlage ergibt dieselben Urteile. Du antwortest ausschliesslich im vorgegebenen JSON-Format.

Schreibe in Schweizer Rechtschreibung (ss statt ß), sachlich, verständlich für einen Firmeninhaber ohne Fachjargon. Erkläre Fachbegriffe in einem Halbsatz, wenn du sie brauchst.`

function pathOf(url: string): string {
  try { return new URL(url).pathname || '/' } catch { return url }
}

function pagesBlock(crawl: CrawlResult): string {
  return crawl.pages.map(p => {
    const head = `### ${pathOf(p.url)} (HTTP ${p.statusCode}, ${p.wordCount} Wörter${p.usedFrameworkData ? ', Text teilweise aus Framework-Daten rekonstruiert' : ''})`
    if (!p.readable) return `${head}\nNICHT GELESEN: ${p.unreadableReason}. Daraus folgt nichts über den Inhalt dieser Seite.`
    return [
      head,
      `Titel: ${p.title || '(leer)'}`,
      `Meta-Beschreibung: ${p.metaDescription || '(keine)'}`,
      `H1: ${p.h1.join(' | ') || '(keine)'}`,
      `H2: ${p.h2.slice(0, 10).join(' | ') || '(keine)'}`,
      `Formular: ${p.hasContactForm ? `ja (${p.formFields.slice(0, 10).join(', ')})` : 'nein'} · Telefon-Links: ${p.telLinks} · WhatsApp erwähnt: ${p.hasWhatsApp ? 'ja' : 'nein'}`,
      `Text:\n${p.bodyText}`,
    ].join('\n')
  }).join('\n\n')
}

function existingPaths(crawl: CrawlResult): string {
  const paths = [...new Set(crawl.allInternalLinks.map(pathOf))]
    .filter(p => !/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4)$/i.test(p))
    .sort()
    .slice(0, 120)
  return paths.join(', ')
}

function measuredBlock(measured: Record<DimensionKey, CriterionResult[]>): string {
  return DIMENSIONS.map(d => {
    const rows = measured[d.key]
    if (!rows.length) return null
    return `${d.label}:\n${rows.map(r => `- ${r.id} ${r.label}: ${r.urteil} — ${r.beleg}`).join('\n')}`
  }).filter(Boolean).join('\n')
}

function criteriaBlock(): string {
  return DIMENSIONS.map(d => {
    const crits = modelCriteria(d)
    const lines = crits.map(c => `- ${c.id} (${c.quelle === 'recherche' ? 'aus der Recherche' : 'aus dem Seiteninhalt'}): ${c.pruefen}`)
    return `### ${d.key} — ${d.label}\nLeitfrage: ${d.frage}\n${lines.length ? lines.join('\n') : '- (nur Messungen; schreibe nur den Befund)'}`
  }).join('\n\n')
}

export function buildUserPrompt(args: {
  crawl: CrawlResult
  measured: Record<DimensionKey, CriterionResult[]>
  research: string | null
}): string {
  const { crawl, measured, research } = args
  const i = crawl.identity
  return `Prüfe die folgende Website für den P2 Digital Check.

## Website
Adresse: ${crawl.inputUrl}
System: ${i.platform.name ?? 'nicht erkannt'}${i.hosting ? ` · Hosting: ${i.hosting}` : ''}
Impressum/Betreiber: ${i.imprint.found ? [i.imprint.entity, i.imprint.address].filter(Boolean).join(', ') : 'nicht gefunden'}
Navigation: ${crawl.navigationItems.slice(0, 40).join(' | ') || '(nicht erkannt)'}
Auf der Website vorhandene Bereiche (verlinkte Pfade, auch ungelesene): ${existingPaths(crawl) || '(keine)'}
Verlinkte Social-Media-Profile: ${crawl.socialProfiles.map(s => `${s.platform} ${s.url}`).join(', ') || 'keine'}
Gelesene Seiten: ${crawl.pages.length}${crawl.unreachable.length ? ` · nicht erreichbar: ${crawl.unreachable.map(pathOf).join(', ')}` : ''}

## Bereits gemessen (nicht erneut beurteilen, aber im Befund verwenden)
${measuredBlock(measured)}

## Externe Recherche
${research ?? 'Keine Recherche verfügbar. Beurteile die Recherche-Prüfpunkte als "nicht_pruefbar".'}

## Seiteninhalte
${pagesBlock(crawl)}

## Kriterienkatalog
Beurteile JEDEN der folgenden Prüfpunkte mit genau einem Urteil:
- "erfuellt": klar erfüllt, mit Beleg
- "teilweise": im Ansatz vorhanden, aber mit erkennbarer Lücke
- "nicht_erfuellt": in den Daten belegbar nicht erfüllt
- "nicht_pruefbar": die Daten reichen nicht für ein Urteil (z.B. Seite nicht gelesen, Recherche ohne eindeutiges Ergebnis)
- "nicht_relevant": für dieses Geschäft und dieses Format ohne Bedeutung

${criteriaBlock()}

## Regeln (verbindlich)

### Belegpflicht
Jedes Urteil stützt sich auf etwas, das oben tatsächlich steht. Im Beleg nennst du die Seite (Pfad) und zitierst kurz die Formulierung oder nennst die konkrete Beobachtung. Ein Satz, der auf jede beliebige Firma zuträfe, ist kein Beleg.

### Keine falschen "fehlt"-Meldungen
Gelesen wurde nur eine Auswahl der Seiten. Prüfe vor jedem "fehlt" die Liste der vorhandenen Bereiche und die Navigation. Taucht ein passender Pfad dort auf, existiert der Bereich — dann ist das Urteil höchstens "nicht_pruefbar" und nie "nicht_erfuellt". Formuliere "in den geprüften Seiten nicht gefunden", nie "nicht vorhanden". Eine falsche Fehlt-Meldung zerstört das Vertrauen in den ganzen Bericht.

### Das HTML ist nicht der Browser
Du liest das ausgelieferte HTML. Animierte Zähler stehen dort oft auf 0, Baukästen liefern Kopf- und Fusszeile pro Bildschirmgrösse mehrfach mit. Beides ist kein Fehler der Website. Seiten mit "NICHT GELESEN" dürfen keinem Prüfpunkt schaden.

### Am Zweck messen
Ein Einmannbetrieb, ein Handwerker und ein Onlineshop haben verschiedene Aufgaben. Was für dieses Geschäft keine Rolle spielt, ist "nicht_relevant" — und kostet nichts.

### Konsequent urteilen
"teilweise" ist kein Ausweichurteil. Ist ein Prüfpunkt im Wesentlichen erfüllt, ist er "erfuellt". Fehlt er belegbar, ist er "nicht_erfuellt".

### Brauchbar statt alarmierend
Der Bericht wird im Gespräch mit dem Inhaber verwendet. Nenne im Befund zuerst, was trägt, dann die Lücke. Unterscheide wichtig von dringend. Keine Dramatisierung, keine Superlative ohne Beleg.

### Massnahmen: umsetzbar und abgewogen
- 6–10 Massnahmen, die wichtigsten zuerst. Jede mit 2–4 konkreten Schritten (was genau, wo genau).
- Leite sie aus den nicht oder teilweise erfüllten Prüfpunkten ab. Sofortmassnahmen sind Dinge, die in Tagen erledigt sind (z.B. Telefonnummer klickbar machen); strategische brauchen Konzeptarbeit.
- Prioritaet "Hoch" nur, wenn heute messbar Anfragen oder Vertrauen verloren gehen.
- Prüfe jede Empfehlung auf Nebenwirkungen. Beispiel für eine schlechte Empfehlung: Firmen- und Ortsnamen in jeden Seitentitel stopfen — das verbraucht knappen Platz und lässt das Angebot kleiner wirken.

### Textbeispiele
Nur echte, wörtlich zitierte Stellen von der Website, deren Verbesserung sich lohnt. Lieber keines als ein konstruiertes.

### Befunde zu gemessenen Dimensionen
Bei Technik und den gemessenen Punkten erklärst du im Befund, was die Messwerte für das Geschäft bedeuten — die Zahlen selbst stehen schon in der Anzeige.`
}
