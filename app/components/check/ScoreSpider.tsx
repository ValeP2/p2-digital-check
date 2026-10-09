"use client"

// Aus P2 Kompass übernommen (components/score-spider.tsx), Geometrie in lib/spider.ts.

import { useEffect, useRef, useState } from "react"
import { TrendingUp, TrendingDown, Minus, X } from "lucide-react"
import {
  achsenWinkel, punktAuf, ring, messEcken, pfad, ausrichtung,
  bremsend, achsenFortschritt, beschriftungsFortschritt, gesamtDauer,
} from "@/lib/spider"
import { cn } from "../ui"

// ── Netzdiagramm der Detailwerte ─────────────────────────────────
//
// Ersetzt die frühere Liste aus sechs Balken: Beschriftung und Zahl stehen an
// der Achse, der Vergleich zum Vorlauf und die Erklärung kommen beim Anklicken.
// Der Score sagt, wie gut ein Kanal dasteht — die Form sagt, woran es liegt.
//
// Die Werte kommen fertig von aussen und werden hier NICHT noch einmal
// umgerechnet. Das ist Absicht: Die Risiko-Drehung ("Risikofreiheit") passiert
// an einer einzigen Stelle in der Kanalseite. Zwei Umrechnungen hiessen zwei
// Zahlen für dasselbe — und niemand wüsste, welche stimmt.
//
// Feste Grösse statt w-full: In einer schmalen Spalte schrumpfte das Netz
// mitsamt Beschriftungen auf Unlesbarkeit. Es behält jetzt seine Grösse; passt
// sie nicht mehr neben den Text, rückt es darunter (siehe Kanalseite).

export interface SpiderWert {
  label: string
  /** 0–100. Weiter aussen ist besser. */
  value: number
  /** Wert des vorangegangenen Laufs, falls vorhanden. */
  previous?: number | null
  /** Erklärung beim Anklicken (Digital Check: die Leitfrage der Dimension). */
  erklaerung?: string
}

/** Unter drei Achsen gibt es keine Fläche — dann ist ein Netz sinnlos. */
const MIN_ACHSEN = 3

/** Ringe des Netzes, von innen nach aussen. */
const RINGE = [25, 50, 75, 100]

const RADIUS = 100
const BESCHRIFTUNG_ABSTAND = 16
const ZEILE = 15

// Der Zeichenbereich ist breiter als hoch: Links und rechts steht die längste
// Beschriftung ("Risikofreiheit"), oben und unten nur eine kurze. Gleich viel
// Rand auf allen Seiten liesse oben und unten Luft und schnitte seitlich
// trotzdem ab.
const BREITE = 370
const HOEHE = 310

// Der Zeitverlauf der Animation steht in lib/spider.ts — drei Abschnitte:
// Raster, Fläche achsenweise, danach Beschriftung und Zahl.

function magBewegung(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Aussen nur ein Schlüssel, innen der Zustand.
 *
 * Wechselt der Kanal oder kommt eine neue Analyse, soll die Animation neu
 * anlaufen und ein offenes Kärtchen zugehen. Über den Schlüssel montiert React
 * das Innere neu — der Zustand setzt sich damit von selbst zurück, ohne ihn in
 * einem Effekt zurückzuschreiben.
 */
export function ScoreSpider(props: { werte: SpiderWert[]; color: string; className?: string }) {
  const kennung = props.werte.map(w => `${w.label}:${w.value}`).join("|")
  return <SpiderInnen key={kennung} {...props} />
}

function SpiderInnen({
  werte,
  color,
  className,
}: {
  werte: SpiderWert[]
  color: string
  className?: string
}) {
  const anzahl = werte.length

  // Beginnt bei null — erst steht nur das Raster. Auch auf dem Server, damit
  // die erste Ausgabe im Browser dazu passt.
  const [anteile, setAnteile] = useState<number[]>(() => werte.map(() => 0))
  // Getrennt davon: wie weit Beschriftung und Zahl eingeblendet sind. Sie
  // beginnen erst, wenn die Fläche steht.
  const [schrift, setSchrift] = useState<number[]>(() => werte.map(() => 0))
  const [aktiv, setAktiv] = useState<number | null>(null)
  const rahmen = useRef<number | null>(null)

  useEffect(() => {
    const beginn = performance.now()
    const bewegung = magBewegung()
    const ende = gesamtDauer(anzahl)

    // Gesetzt wird ausschliesslich im Bild-Rückruf, nie gleich im Effekt: Wer
    // im Effekt synchron setzt, löst eine zweite Auswertung aus, bevor
    // überhaupt etwas zu sehen war.
    function schritt(jetzt: number) {
      if (!bewegung) {
        setAnteile(Array.from({ length: anzahl }, () => 1))
        setSchrift(Array.from({ length: anzahl }, () => 1))
        return
      }
      const zeit = jetzt - beginn
      setAnteile(Array.from({ length: anzahl }, (_, i) => bremsend(achsenFortschritt(zeit, i))))
      setSchrift(Array.from({ length: anzahl }, (_, i) => bremsend(beschriftungsFortschritt(zeit, i, anzahl))))
      if (zeit < ende) rahmen.current = requestAnimationFrame(schritt)
    }

    rahmen.current = requestAnimationFrame(schritt)
    return () => { if (rahmen.current) cancelAnimationFrame(rahmen.current) }
  }, [anzahl])

  useEffect(() => {
    if (aktiv === null) return
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setAktiv(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [aktiv])

  if (anzahl < MIN_ACHSEN) return null

  const mitte = { x: BREITE / 2, y: HOEHE / 2 }
  const gezeigt = werte.map((w, i) => w.value * (anteile[i] ?? 0))
  const ecken = messEcken(gezeigt, RADIUS, mitte)

  return (
    // maxWidth: Auf dem Telefon ist weniger Platz als BREITE — dann skaliert
    // das Netz samt Beschriftung über die viewBox, statt abgeschnitten zu werden.
    <div className={cn("relative", className)} style={{ width: BREITE, maxWidth: "100%" }}>
      <svg
        viewBox={`0 0 ${BREITE} ${HOEHE}`}
        width={BREITE}
        height={HOEHE}
        className="max-w-full h-auto overflow-visible"
        role="img"
        aria-label={`Netzdiagramm der Detailwerte: ${werte.map(w => `${w.label} ${Math.round(w.value)}`).join(", ")}`}
      >
        {/* Raster: Ringe von innen nach aussen, der äusserste etwas kräftiger —
            er ist der Rahmen, die inneren sind nur Ablesehilfe. */}
        {RINGE.map(stufe => (
          <path
            key={stufe}
            d={pfad(ring(anzahl, (stufe / 100) * RADIUS, mitte))}
            fill="none"
            stroke="currentColor"
            className={stufe === 100 ? "text-foreground/22" : "text-foreground/10"}
            strokeWidth="1"
          />
        ))}

        {werte.map((w, i) => {
          const aussen = punktAuf(achsenWinkel(i, anzahl), RADIUS, mitte)
          return (
            <line
              key={w.label}
              x1={mitte.x} y1={mitte.y} x2={aussen.x} y2={aussen.y}
              stroke="currentColor" className="text-foreground/10" strokeWidth="1"
            />
          )
        })}

        {/* Die gemessene Fläche in der Kanalfarbe */}
        <path
          d={pfad(ecken)}
          fill={color}
          fillOpacity="0.22"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {ecken.map((p, i) => (
          <circle
            key={werte[i].label}
            cx={p.x} cy={p.y}
            r={aktiv === i ? 5 : 3}
            fill={color}
            className="transition-[r] duration-150"
          />
        ))}

        {/* Beschriftung und Zahl je Achse. Die Zahl steht innen, näher am
            eigenen Eckpunkt — so gehört sie sichtbar zu ihrer Achse und nicht
            zur Nachbarin. */}
        {werte.map((w, i) => {
          const winkel = achsenWinkel(i, anzahl)
          const p = punktAuf(winkel, RADIUS + BESCHRIFTUNG_ABSTAND, mitte)
          const { anchor } = ausrichtung(winkel)
          const oben = Math.sin(winkel) < 0
          const yZahl = p.y
          const yLabel = oben ? p.y - ZEILE : p.y + ZEILE
          const istAktiv = aktiv === i

          return (
            <g
              key={w.label}
              onClick={() => setAktiv(a => (a === i ? null : i))}
              className="cursor-pointer outline-none"
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAktiv(a => (a === i ? null : i)) } }}
              aria-label={`${w.label}: ${Math.round(w.value)} von 100`}
            >
              {/* Unsichtbare Klickfläche: Text allein ist ein zu kleines Ziel. */}
              <rect
                x={anchor === "end" ? p.x - 96 : anchor === "start" ? p.x - 4 : p.x - 50}
                y={Math.min(yZahl, yLabel) - 10}
                width={100} height={ZEILE + 20}
                fill="transparent"
              />
              {/* Beschriftung und Zahl blenden GEMEINSAM ein, und erst wenn
                  die Fläche steht. Vorher erschien die Zahl mit ihrer Achse —
                  dann wanderte der Blick zwischen sechs Stellen hin und her,
                  statt zuerst die Form zu sehen. */}
              <g opacity={schrift[i] ?? 0}>
                <text
                  x={p.x} y={yLabel}
                  textAnchor={anchor} dominantBaseline="middle"
                  className={cn("transition-colors", istAktiv ? "fill-foreground" : "fill-muted-foreground")}
                  style={{ fontSize: 11, fontWeight: 500 }}
                >
                  {w.label}
                </text>
                <text
                  x={p.x} y={yZahl}
                  textAnchor={anchor} dominantBaseline="middle"
                  fill={color}
                  style={{ fontSize: 14, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}
                >
                  {Math.round(w.value)}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      {aktiv !== null && <AchsenKarte wert={werte[aktiv]} color={color} onClose={() => setAktiv(null)} />}
    </div>
  )
}

/**
 * Was beim Klick auf eine Achse erscheint: Zahl, Vergleich zum Vorlauf und
 * eine Erklärung, was dieser Wert überhaupt misst.
 *
 * Liegt mittig über dem Netz statt neben der Achse: Neben einer Achse am Rand
 * stünde sie halb ausserhalb der Karte, und für sechs mögliche Positionen
 * bräuchte es sechs Sonderfälle.
 */
function AchsenKarte({
  wert,
  color,
  onClose,
}: {
  wert: SpiderWert
  color: string
  onClose: () => void
}) {
  const vorher = typeof wert.previous === "number" ? wert.previous : null
  const delta = vorher === null ? null : Math.round(wert.value) - Math.round(vorher)

  return (
    <>
      <div className="absolute inset-0 z-10" onClick={onClose} />
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-20 rounded-lg bg-white text-foreground shadow-xl ring-1 ring-foreground/10 p-4 space-y-2 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[14px] font-semibold">{wert.label}</span>
            <span className="text-[18px] font-bold tabular-nums" style={{ color }}>
              {Math.round(wert.value)}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Der Vergleich zum Vorlauf steht nur da, wenn es einen gibt — sonst
            wäre jede Veränderung gegen null erfunden. */}
        {delta === null ? (
          <p className="text-[12px] text-muted-foreground">Kein Vorlauf zum Vergleichen.</p>
        ) : (
          <p className="text-[12px] flex items-center gap-1.5">
            <span className="text-muted-foreground">Vorher {Math.round(vorher!)}</span>
            <span className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              delta > 0 ? "text-emerald-600 dark:text-emerald-400"
                : delta < 0 ? "text-[#FF6B8A]"
                : "text-muted-foreground"
            )}>
              {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" />
                : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" />
                : <Minus className="w-3.5 h-3.5" />}
              {delta > 0 ? "+" : ""}{delta === 0 ? "unverändert" : delta}
            </span>
          </p>
        )}

        {wert.erklaerung && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground pt-1">{wert.erklaerung}</p>
        )}
      </div>
    </>
  )
}
