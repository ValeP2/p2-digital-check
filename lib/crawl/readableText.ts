import * as cheerio from 'cheerio'
import type { AnyNode, Element } from 'domhandler'

// ── Lesbaren Text aus HTML gewinnen ──────────────────────────────
//
// Vorher stand hier ein einzelnes `$('body').text()`. Das ist bei modernen
// Baukästen (Framer, Webflow, Elementor, Divi …) unbrauchbar, aus drei
// Gründen, die alle NICHTS mit einem bestimmten System zu tun haben:
//
//   1. `.text()` kennt keine Blockgrenzen. Überschrift und Fliesstext kleben
//      aneinander: "1. VeranstalterinVeranstalterin des Wettbewerbs ist …".
//      Das Modell bewertet danach Klarheit an einem Wortsalat.
//   2. Responsive-Baukästen liefern ALLE Breakpoint-Varianten im selben HTML
//      und blenden die unpassenden per CSS aus. Da die Textextraktion das CSS
//      vorher entfernt, steht anschliessend jeder Satz zwei- bis dreimal da —
//      die Seite liest sich, als wiederhole sie sich ständig.
//   3. Text-Animationen zerlegen Wörter buchstabenweise in <span>. Ohne
//      Leerzeichen-Spans dazwischen wird daraus eine Buchstabenkette; der
//      Wortzähler fällt auf nahezu null und die Seite gilt als leer. Genau so
//      ist am 27.08.2026 eine vollständig gefüllte Seite als leer in die
//      Analyse gegangen.
//
// Die Gegenmittel sind bewusst allgemein formuliert: Blockelemente trennen,
// per Attribut/Inline-Style versteckte Teile weglassen, wiederholte Blöcke
// einmal zählen. Ein WordPress- oder TYPO3-Auftritt profitiert davon genauso.

// Elemente, deren Inhalt kein Seitentext ist.
const DROP_TAGS = 'script, style, noscript, head, template, svg, iframe, object, canvas'

// Wenn eines dieser Elemente endet, endet ein Textblock. Alles andere
// (span, strong, em, a …) gilt als inline und wird nahtlos angehängt —
// nur so werden buchstabenweise animierte Wörter wieder zu Wörtern.
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'details', 'dialog',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main',
  'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td',
  'tfoot', 'th', 'thead', 'tr', 'ul',
])

// Ab dieser Länge gilt eine Zeile als eigenständige Aussage und darf auf einer
// Seite nur einmal zählen. Kurze Zeilen ("Mehr erfahren", "Kontakt") dürfen
// sich dagegen legitim wiederholen — die werden nur zusammengefasst, wenn sie
// unmittelbar aufeinander folgen.
const DUPLICATE_MIN_LENGTH = 25

/**
 * Versteckt im Sinne von "steht nicht auf der Seite" — geprüft wird nur, was
 * ohne Stylesheet erkennbar ist. Bewusst NICHT als versteckt gilt `opacity:0`:
 * das ist in aller Regel der Startwert einer Einblend-Animation, der Text
 * gehört zur Seite und wird Sekundenbruchteile später sichtbar.
 */
function isHidden(el: Element): boolean {
  const attribs = el.attribs ?? {}
  if ('hidden' in attribs) return true
  if (attribs['aria-hidden'] === 'true') return true
  const style = (attribs.style ?? '').replace(/\s+/g, '').toLowerCase()
  return style.includes('display:none') || style.includes('visibility:hidden')
}

function walk(node: AnyNode, parts: string[]): void {
  if (node.type === 'text') {
    parts.push((node as unknown as { data: string }).data)
    return
  }
  if (node.type !== 'tag') return

  const el = node as Element
  const tag = el.tagName?.toLowerCase() ?? ''
  if (isHidden(el)) return

  const isBlock = BLOCK_TAGS.has(tag)
  if (isBlock) parts.push('\n')
  for (const child of el.children) walk(child, parts)
  if (isBlock) parts.push('\n')
}

/** Zeilenweise aufbereiten: leeren, normalisieren, Wiederholungen entfernen. */
function toLines(raw: string): string[] {
  const lines = raw
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    // Unmittelbare Wiederholung: immer nur einmal (Breakpoint-Varianten stehen
    // im Markup direkt hintereinander).
    if (out.length > 0 && out[out.length - 1] === line) continue
    // Längere Aussagen seitenweit nur einmal — Varianten desselben Abschnitts
    // stehen nicht zwingend benachbart, wenn sie mehrere Zeilen umfassen.
    if (line.length >= DUPLICATE_MIN_LENGTH) {
      if (seen.has(line)) continue
      seen.add(line)
    }
    out.push(line)
  }
  return out
}

/**
 * Liest den sichtbaren Text einer Seite als Zeilen. Der Aufrufer entscheidet,
 * ob er sie als Fliesstext (`\n`) oder einzeln weiterverarbeitet.
 */
export function readableLines($: cheerio.CheerioAPI): string[] {
  $(DROP_TAGS).remove()
  const body = $('body').get(0)
  if (!body) return []
  const parts: string[] = []
  walk(body as unknown as AnyNode, parts)
  return toLines(parts.join(''))
}

/** Text eines einzelnen Elements (z.B. einer Überschrift), inline-sicher. */
export function readableElementText($: cheerio.CheerioAPI, el: Element): string {
  const parts: string[] = []
  walk(el as unknown as AnyNode, parts)
  return toLines(parts.join('')).join(' ')
}

/** Reihenfolge-erhaltendes Dedupe für Überschriften-Listen. */
export function dedupeOrdered(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter(v => {
    if (seen.has(v)) return false
    seen.add(v)
    return true
  })
}
