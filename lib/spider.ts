// ── Geometrie des Netzdiagramms ──────────────────────────────────
//
// Reine Rechnerei, getrennt von der Darstellung: Ein Netzdiagramm besteht aus
// Winkeln und Abständen, und beides lässt sich ohne Browser prüfen.
//
// Zwei Festlegungen, die überall gelten:
//
//  · Die erste Achse zeigt nach OBEN, danach geht es im Uhrzeigersinn weiter.
//    So liest sich das Diagramm in derselben Reihenfolge wie die Liste der
//    Detailwerte darunter.
//  · Weiter aussen ist immer besser. Deshalb kommt das Risiko gedreht herein
//    ("Risikofreiheit"); die Drehung passiert beim Aufrufer, damit Diagramm
//    und Liste denselben Wert zeigen und nicht zwei Wahrheiten entstehen.

export interface Punkt {
  x: number
  y: number
}

/**
 * Winkel der Achse `i` von `anzahl` — im Bogenmass, oben beginnend.
 *
 * In SVG wächst y nach unten, deshalb ist "oben" -PI/2 und der Uhrzeigersinn
 * die positive Richtung.
 */
export function achsenWinkel(i: number, anzahl: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / anzahl
}

export function punktAuf(winkel: number, abstand: number, mitte: Punkt): Punkt {
  return {
    x: mitte.x + Math.cos(winkel) * abstand,
    y: mitte.y + Math.sin(winkel) * abstand,
  }
}

/** Die Ecken eines regelmässigen Vielecks — ein Ring des Netzes. */
export function ring(anzahl: number, radius: number, mitte: Punkt): Punkt[] {
  return Array.from({ length: anzahl }, (_, i) =>
    punktAuf(achsenWinkel(i, anzahl), radius, mitte)
  )
}

/**
 * Die Ecken der gemessenen Fläche. Werte von 0 bis 100 liegen auf 0 bis
 * `radius`.
 *
 * Gekappt wird mit Absicht: Kommt aus der Auswertung einmal ein Wert über 100
 * oder unter 0 — und dieses Projekt hat genau damit schon Ärger gehabt —,
 * soll das Diagramm nicht aus seinem Rahmen wachsen. Es zeigt dann den
 * äussersten beziehungsweise innersten Ring, statt die Seite zu zerlegen.
 */
export function messEcken(werte: number[], radius: number, mitte: Punkt): Punkt[] {
  return werte.map((wert, i) => {
    const anteil = Math.min(Math.max(wert, 0), 100) / 100
    return punktAuf(achsenWinkel(i, werte.length), anteil * radius, mitte)
  })
}

/** Geschlossener SVG-Pfad durch die Ecken. */
export function pfad(ecken: Punkt[]): string {
  if (ecken.length === 0) return ''
  const runde = (n: number) => Math.round(n * 100) / 100
  return (
    ecken.map((p, i) => `${i === 0 ? 'M' : 'L'}${runde(p.x)} ${runde(p.y)}`).join(' ') + ' Z'
  )
}

/**
 * Wie eine Beschriftung an dieser Achse auszurichten ist.
 *
 * Ohne das steht jede Beschriftung mittig auf ihrem Achsenende und ragt links
 * und rechts gleich weit hinaus — am linken und rechten Rand läuft sie damit
 * aus dem Bild. Eine Beschriftung rechts der Mitte wird linksbündig gesetzt,
 * eine links der Mitte rechtsbündig, oben und unten bleibt es mittig.
 */
export function ausrichtung(winkel: number): {
  anchor: 'start' | 'middle' | 'end'
  baseline: 'auto' | 'middle' | 'hanging'
} {
  const x = Math.cos(winkel)
  const y = Math.sin(winkel)
  const fastNull = 0.2

  const anchor = Math.abs(x) < fastNull ? 'middle' : x > 0 ? 'start' : 'end'
  const baseline = Math.abs(y) < fastNull ? 'middle' : y > 0 ? 'hanging' : 'auto'
  return { anchor, baseline }
}

// ── Zeitverlauf der Animation ────────────────────────────────────
//
// Drei Abschnitte, bewusst nacheinander statt gleichzeitig:
//
//  1. Kurz steht nur das Raster.
//  2. Jede Achse zieht ihren Wert nach aussen, eine nach der anderen im
//     Uhrzeigersinn.
//  3. Erst wenn die Fläche steht, blenden Beschriftung und Zahl ein — auch
//     sie der Reihe nach rundherum.
//
// Liegt hier und nicht in der Komponente, weil sich Zeit ohne Browser prüfen
// lässt: Ob eine Achse vor ihrer Nachbarin fertig ist, ist eine Rechnung.

export const TAKT = {
  /** Wie lange nur das Raster steht. */
  rasterVorlauf: 180,
  /** Wie lange eine einzelne Achse zum Aufziehen braucht. */
  achseDauer: 480,
  /** Abstand zwischen zwei Achsen. */
  achseVersatz: 85,
  /** Pause zwischen fertiger Fläche und erster Beschriftung. */
  beschriftungPause: 120,
  beschriftungDauer: 320,
  /** Zeitspanne, über die sich alle Einblendungen verteilen. */
  beschriftungSpanne: 440,
}

/**
 * Bremst zum Ende hin ab: schnell los, langsam ankommen.
 *
 * Vorher lief es symmetrisch (erst beschleunigen, dann bremsen), was sich
 * durch die Überlappung der Achsen wie eine gerade Bewegung anfühlte.
 *
 * Bewusst OHNE Überschwingen: Eine Kurve, die kurz über den Zielwert
 * hinausschiesst, zeichnet für einen Moment eine Zahl, die nicht gemessen
 * wurde. Bei einem Messwerkzeug ist das keine Spielerei, sondern falsch.
 */
export function bremsend(t: number): number {
  const x = Math.min(Math.max(t, 0), 1)
  return 1 - Math.pow(1 - x, 3)
}

function anteil(zeit: number, start: number, dauer: number): number {
  return Math.min(Math.max((zeit - start) / dauer, 0), 1)
}

/** Anteil (0–1), zu dem Achse `i` schon aufgezogen ist. */
export function achsenFortschritt(zeit: number, i: number): number {
  return anteil(zeit, TAKT.rasterVorlauf + i * TAKT.achseVersatz, TAKT.achseDauer)
}

/** Wann die letzte Achse ihren Wert erreicht hat. */
export function flaecheFertigNach(anzahl: number): number {
  return TAKT.rasterVorlauf + (anzahl - 1) * TAKT.achseVersatz + TAKT.achseDauer
}

/**
 * Wann die Einblendung der Achse `i` beginnt, gemessen ab der ersten.
 *
 * Nicht in gleichen Abständen: Die Lücken werden nach hinten grösser, damit
 * die Reihe zum Schluss langsamer wird und auf der letzten Beschriftung zur
 * Ruhe kommt. Bei gleichen Abständen tickt sie gleichmässig durch wie ein
 * Metronom — die Bremsung, die die Fläche schon hat, fehlte der Schrift.
 *
 * Bei sechs Achsen ergibt das (gerundet): 0, 18, 70, 158, 282, 440.
 */
export function beschriftungsVersatz(i: number, anzahl: number): number {
  if (anzahl < 2) return 0
  const p = i / (anzahl - 1)
  return TAKT.beschriftungSpanne * p * p
}

/** Anteil (0–1), zu dem Beschriftung und Zahl der Achse `i` eingeblendet sind. */
export function beschriftungsFortschritt(zeit: number, i: number, anzahl: number): number {
  const start =
    flaecheFertigNach(anzahl) + TAKT.beschriftungPause + beschriftungsVersatz(i, anzahl)
  return anteil(zeit, start, TAKT.beschriftungDauer)
}

export function gesamtDauer(anzahl: number): number {
  return (
    flaecheFertigNach(anzahl) +
    TAKT.beschriftungPause +
    beschriftungsVersatz(anzahl - 1, anzahl) +
    TAKT.beschriftungDauer
  )
}
