import PptxGenJS from 'pptxgenjs'
import { DIMENSION_BY_KEY } from '../check/criteria'
import { scoreBand } from '../check/score'
import type { CheckResult, DimensionResult, Massnahme, Urteil } from '../check/types'

// ── PowerPoint aus dem strukturierten Check ──────────────────────
//
// Der alte Export las den Markdown-Bericht mit einem dritten, eigenen
// Markdown-Leser wieder ein und rechnete Zeilenumbrüche nach Zeichenzahl. Hier
// kommt alles aus denselben Feldern wie die Webansicht — eine Abweichung
// zwischen Bericht und Folien ist damit ausgeschlossen.
//
// Heller Look wie die Webansicht. Schrift Arial: Sie ist auf jedem Rechner
// vorhanden; eine fehlende Schrift ersetzt PowerPoint sonst nach eigenem
// Geschmack, und die Umbrüche stimmen nicht mehr.

const FONT = 'Arial'
const INK = '1C1C1E'
const MUTED = '6B7280'
const LINE = 'E5E7EB'
const SOFT = 'F5F5F7'
const ACCENT = '7B6FEF'
const X = 0.7
const W = 11.93

const URTEIL: Record<Urteil, { mark: string; color: string; label: string }> = {
  erfuellt: { mark: '✓', color: '10B981', label: 'erfüllt' },
  teilweise: { mark: '◐', color: 'F59E0B', label: 'teilweise' },
  nicht_erfuellt: { mark: '✗', color: 'FF6B8A', label: 'nicht erfüllt' },
  nicht_pruefbar: { mark: '?', color: '9CA3AF', label: 'nicht prüfbar' },
  nicht_relevant: { mark: '–', color: '9CA3AF', label: 'nicht relevant' },
}

const BASIS_LABEL = { gemessen: 'Gemessen', inhaltspruefung: 'Inhaltsprüfung', web_recherche: 'Einschätzung via Web-Recherche', gemischt: 'Messung + Inhaltsprüfung' } as const

function color(score: number | null): string {
  return score === null ? '9CA3AF' : scoreBand(score).color.replace('#', '').toUpperCase()
}

function cut(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')} …`
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function footer(slide: PptxGenJS.Slide, r: CheckResult, nr: number) {
  slide.addText(`P2 Digital Check · ${r.firma.name}`, { x: X, y: 7.0, w: W - 1, h: 0.3, fontSize: 8, color: MUTED, fontFace: FONT })
  slide.addText(String(nr), { x: X + W - 1, y: 7.0, w: 1, h: 0.3, fontSize: 8, color: MUTED, fontFace: FONT, align: 'right' })
}

function ring(slide: PptxGenJS.Slide, score: number | null, x: number, y: number, d: number, fontSize: number) {
  const c = color(score)
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color: c, transparency: 92 }, line: { color: c, width: Math.max(2, d * 2.2) } })
  slide.addText(score === null ? '–' : String(score), { x, y, w: d, h: d, fontSize, bold: true, color: c, fontFace: FONT, align: 'center', valign: 'middle' })
}

function bar(slide: PptxGenJS.Slide, label: string, score: number | null, y: number) {
  const trackX = X + 3.2
  const trackW = W - 3.2 - 0.8
  slide.addText(label, { x: X, y, w: 3.1, h: 0.34, fontSize: 12, color: INK, fontFace: FONT, valign: 'middle' })
  slide.addShape('roundRect', { x: trackX, y: y + 0.13, w: trackW, h: 0.08, rectRadius: 0.04, fill: { color: SOFT }, line: { type: 'none' } })
  if (score !== null && score > 0) {
    slide.addShape('roundRect', { x: trackX, y: y + 0.13, w: Math.max(0.08, (trackW * score) / 100), h: 0.08, rectRadius: 0.04, fill: { color: color(score) }, line: { type: 'none' } })
  }
  slide.addText(score === null ? '–' : String(score), { x: X + W - 0.7, y, w: 0.7, h: 0.34, fontSize: 13, bold: true, color: color(score), fontFace: FONT, align: 'right', valign: 'middle' })
}

function dimensionSlide(pptx: PptxGenJS, r: CheckResult, d: DimensionResult, nr: number) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }
  s.addText(d.label, { x: X, y: 0.45, w: W - 1.4, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT })
  s.addText(`${DIMENSION_BY_KEY[d.key].frage}${d.basis ? `   ·   ${BASIS_LABEL[d.basis]}` : ''}`, { x: X, y: 1.02, w: W - 1.4, h: 0.35, fontSize: 11, color: MUTED, fontFace: FONT })
  ring(s, d.score, X + W - 1.1, 0.4, 1.0, 24)
  s.addText(cut(d.befund, 480), { x: X, y: 1.55, w: W, h: 1.15, fontSize: 13, color: INK, fontFace: FONT, valign: 'top', paraSpaceAfter: 4 })

  const rows = d.kriterien.slice(0, 8)
  const top = 2.85
  const rowH = Math.min(0.52, 4.0 / Math.max(rows.length, 1))
  s.addShape('line', { x: X, y: top - 0.08, w: W, h: 0, line: { color: LINE, width: 0.75 } })
  rows.forEach((k, i) => {
    const u = URTEIL[k.urteil]
    const y = top + i * rowH
    s.addText(u.mark, { x: X, y, w: 0.35, h: rowH, fontSize: 14, bold: true, color: u.color, fontFace: FONT, valign: 'middle' })
    s.addText([
      { text: k.label, options: { bold: true, color: INK, fontSize: 11 } },
      { text: `  ${u.label}`, options: { color: u.color, fontSize: 9 } },
      { text: `\n${cut(k.beleg, 170)}`, options: { color: MUTED, fontSize: 9.5 } },
    ], { x: X + 0.4, y, w: W - 0.4, h: rowH, fontFace: FONT, valign: 'middle' })
  })
  footer(s, r, nr)
}

function massnahmenSlides(pptx: PptxGenJS, r: CheckResult, start: number): number {
  let nr = start
  const items: Massnahme[] = [...r.massnahmen]
  for (let page = 0; page * 3 < items.length; page++) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    s.addText(page === 0 ? 'Empfohlene Massnahmen' : 'Empfohlene Massnahmen (Fortsetzung)', { x: X, y: 0.45, w: W, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT })
    items.slice(page * 3, page * 3 + 3).forEach((m, i) => {
      const y = 1.35 + i * 1.85
      s.addShape('roundRect', { x: X, y, w: W, h: 1.7, rectRadius: 0.12, fill: { color: SOFT }, line: { type: 'none' } })
      s.addText(String(page * 3 + i + 1), { x: X + 0.25, y: y + 0.2, w: 0.4, h: 0.4, fontSize: 16, bold: true, color: ACCENT, fontFace: FONT })
      s.addText(cut(m.titel, 110), { x: X + 0.75, y: y + 0.15, w: W - 1.0, h: 0.4, fontSize: 15, bold: true, color: INK, fontFace: FONT, valign: 'middle' })
      s.addText(`${m.zeithorizont}  ·  Priorität ${m.prioritaet}  ·  Wirkung ${m.wirkung}  ·  ${DIMENSION_BY_KEY[m.dimension]?.label ?? ''}`, { x: X + 0.75, y: y + 0.52, w: W - 1.0, h: 0.28, fontSize: 9.5, color: MUTED, fontFace: FONT })
      const steps = m.schritte.length ? `\n${m.schritte.map((st, j) => `${j + 1}. ${st}`).join('   ')}` : ''
      s.addText(cut(m.beschreibung, 240) + cut(steps, 260), { x: X + 0.75, y: y + 0.82, w: W - 1.0, h: 0.8, fontSize: 10.5, color: INK, fontFace: FONT, valign: 'top' })
    })
    footer(s, r, nr++)
  }
  return nr
}

export async function generateCheckPptx(r: CheckResult): Promise<{ buffer: Buffer; filename: string }> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = `Digital Check – ${r.firma.name}`
  pptx.company = 'P2/ Kommunikation AG'
  const datum = new Date(r.checkedAt).toLocaleDateString('de-CH')
  let nr = 1

  // 1 · Titel
  const t = pptx.addSlide()
  t.background = { color: 'FFFFFF' }
  t.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: ACCENT }, line: { type: 'none' } })
  t.addText('Digital Check', { x: X, y: 1.6, w: 8, h: 0.5, fontSize: 16, color: ACCENT, bold: true, fontFace: FONT })
  t.addText(r.firma.name, { x: X, y: 2.1, w: 8.5, h: 1.2, fontSize: 40, bold: true, color: INK, fontFace: FONT, valign: 'top' })
  t.addText(`${host(r.finalUrl)}  ·  ${datum}`, { x: X, y: 3.4, w: 8.5, h: 0.4, fontSize: 14, color: MUTED, fontFace: FONT })
  if (r.fazit) t.addText(cut(r.fazit, 420), { x: X, y: 4.2, w: 8.3, h: 1.8, fontSize: 13, color: INK, fontFace: FONT, valign: 'top' })
  ring(t, r.overall, 9.9, 1.9, 2.4, 54)
  if (r.overall !== null) t.addText(`${scoreBand(r.overall).label} · von 100`, { x: 9.4, y: 4.45, w: 3.4, h: 0.4, fontSize: 13, color: MUTED, fontFace: FONT, align: 'center' })
  t.addText('P2/ Kommunikation AG · Biel/Bienne · p-zwei.ch', { x: X, y: 6.8, w: W, h: 0.3, fontSize: 9, color: MUTED, fontFace: FONT })
  nr++

  // 2 · Überblick
  const o = pptx.addSlide()
  o.background = { color: 'FFFFFF' }
  o.addText('Die zehn Bereiche auf einen Blick', { x: X, y: 0.45, w: W, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT })
  r.dimensionen.forEach((d, i) => bar(o, d.label, d.score, 1.45 + i * 0.5))
  o.addText('Jeder Bereich wird an festen Prüfpunkten gemessen oder mit Fundstelle beurteilt; die Zahlen werden daraus gerechnet.', { x: X, y: 6.5, w: W, h: 0.3, fontSize: 9.5, color: MUTED, fontFace: FONT })
  footer(o, r, nr++)

  // 3 · Stärken
  if (r.staerken.length) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    s.addText('Was bereits trägt', { x: X, y: 0.45, w: W, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT })
    s.addText(r.staerken.slice(0, 6).map(st => ({ text: cut(st, 200), options: { bullet: { code: '2713' }, color: INK, paraSpaceAfter: 10 } })), { x: X, y: 1.45, w: W, h: 5, fontSize: 15, fontFace: FONT, valign: 'top' })
    footer(s, r, nr++)
  }

  // 4 · Bereiche
  for (const d of r.dimensionen) dimensionSlide(pptx, r, d, nr++)

  // 5 · Massnahmen
  nr = massnahmenSlides(pptx, r, nr)

  // 6 · Textbeispiele
  if (r.textbeispiele.length) {
    const s = pptx.addSlide()
    s.background = { color: 'FFFFFF' }
    s.addText('Texte: vorher und nachher', { x: X, y: 0.45, w: W, h: 0.6, fontSize: 26, bold: true, color: INK, fontFace: FONT })
    r.textbeispiele.slice(0, 3).forEach((tb, i) => {
      const y = 1.4 + i * 1.8
      s.addText(tb.seite, { x: X, y, w: W, h: 0.25, fontSize: 9, color: MUTED, fontFace: FONT })
      s.addShape('roundRect', { x: X, y: y + 0.3, w: 5.8, h: 1.3, rectRadius: 0.1, fill: { color: 'FFF1F4' }, line: { type: 'none' } })
      s.addShape('roundRect', { x: X + 6.13, y: y + 0.3, w: 5.8, h: 1.3, rectRadius: 0.1, fill: { color: 'ECFDF5' }, line: { type: 'none' } })
      s.addText([{ text: 'HEUTE\n', options: { fontSize: 8, bold: true, color: 'FF6B8A' } }, { text: `«${cut(tb.vorher, 200)}»`, options: { fontSize: 11, color: INK } }], { x: X + 0.15, y: y + 0.35, w: 5.5, h: 1.2, fontFace: FONT, valign: 'top' })
      s.addText([{ text: 'VORSCHLAG\n', options: { fontSize: 8, bold: true, color: '10B981' } }, { text: `«${cut(tb.nachher, 200)}»`, options: { fontSize: 11, color: INK } }], { x: X + 6.28, y: y + 0.35, w: 5.5, h: 1.2, fontFace: FONT, valign: 'top' })
    })
    footer(s, r, nr++)
  }

  // 7 · Abschluss
  const e = pptx.addSlide()
  e.background = { color: 'FFFFFF' }
  e.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.18, fill: { color: ACCENT }, line: { type: 'none' } })
  e.addText('Nächster Schritt', { x: X, y: 2.2, w: W, h: 0.7, fontSize: 32, bold: true, color: INK, fontFace: FONT })
  e.addText('Gemeinsam die Massnahmen priorisieren und einen Umsetzungsplan festlegen.', { x: X, y: 3.0, w: W, h: 0.5, fontSize: 16, color: MUTED, fontFace: FONT })
  e.addText('P2/ Kommunikation AG · Silbergasse 6 · 2502 Biel/Bienne · hello@p-zwei.ch · p-zwei.ch', { x: X, y: 4.2, w: W, h: 0.4, fontSize: 13, color: INK, fontFace: FONT })

  const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
  const slug = r.firma.name.replace(/[^\wäöüÄÖÜ-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return { buffer, filename: `Digital-Check-${slug || host(r.finalUrl)}-${r.checkedAt.slice(0, 10)}.pptx` }
}
