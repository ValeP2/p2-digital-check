import PptxGenJS from 'pptxgenjs'

// pptxgenjs braucht Hex-Farben – kein rgba!
const BG      = '293263'
const CREAM   = 'EBEACC'
const DIM     = '8C8B7A'   // gedimmtes Cream (~60%)
const FAINT   = '4A4F6A'   // Balken-Track

// Zentrierter Content-Block: Folie ist 13.33" breit, Inhalt 10.5", Rand je 1.42"
const CX = 1.42   // Content X (linker Rand)
const CW = 10.5   // Content Width

interface Scores {
  positionierung: number; angebot: number; zielgruppe: number; vertrauen: number
  conversion: number; seo: number; navigation: number; sprache: number
  technik: number; externe_sichtbarkeit: number; gesamt: number
}

interface Section {
  title: string
  scoreKey?: keyof Omit<Scores, 'gesamt'>
  scoreLabel?: string
  body: string
  bullets: string[]
  numbered: string[]
  einschaetzung: string
}

const SCORE_MAP: { key: keyof Omit<Scores, 'gesamt'>; label: string }[] = [
  { key: 'positionierung',       label: 'Erster Eindruck & Positionierung' },
  { key: 'angebot',              label: 'Angebot & Verständlichkeit' },
  { key: 'zielgruppe',           label: 'Zielgruppe & Kundenbedürfnis' },
  { key: 'vertrauen',            label: 'Vertrauen & Glaubwürdigkeit' },
  { key: 'conversion',           label: 'Kontakt & Conversion' },
  { key: 'seo',                  label: 'Inhalte & SEO' },
  { key: 'navigation',           label: 'Navigation & Struktur' },
  { key: 'sprache',              label: 'Sprache & Textqualität' },
  { key: 'technik',              label: 'Technik & Mobile' },
  { key: 'externe_sichtbarkeit', label: 'Externe Sichtbarkeit' },
]

function barColor(s: number): string {
  if (s <= 3) return 'ef4444'
  if (s <= 5) return 'f97316'
  if (s <= 7) return 'eab308'
  return '22c55e'
}

function findScoreKey(title: string): { key: keyof Omit<Scores, 'gesamt'>; label: string } | null {
  const lower = title.toLowerCase()
  const checks: [string[], keyof Omit<Scores, 'gesamt'>][] = [
    [['positionierung', 'eindruck'],    'positionierung'],
    [['angebot', 'verständlichkeit'],   'angebot'],
    [['zielgruppe', 'kundenbedürfnis'], 'zielgruppe'],
    [['vertrauen', 'glaubwürdigkeit'],  'vertrauen'],
    [['kontakt', 'conversion'],         'conversion'],
    [['seo', 'inhalte'],                'seo'],
    [['navigation', 'struktur'],        'navigation'],
    [['sprache', 'textqualität'],       'sprache'],
    [['technik', 'mobile'],             'technik'],
    [['extern', 'sichtbarkeit'],        'externe_sichtbarkeit'],
  ]
  for (const [kws, key] of checks) {
    if (kws.some(kw => lower.includes(kw))) {
      return { key, label: SCORE_MAP.find(s => s.key === key)?.label ?? title }
    }
  }
  return null
}

function stripMd(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}

function parseReport(markdown: string): { companyName: string; sections: Section[] } {
  const lines = markdown.split('\n')
  let companyName = ''
  const sections: Section[] = []
  let current: Section | null = null
  const bodyLines: string[] = []

  const flush = () => {
    if (current) {
      current.body = bodyLines.join(' ').trim()
      sections.push(current)
      bodyLines.length = 0
    }
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      companyName = line.slice(3).replace(/Website Analyse\s*[–-]\s*/i, '').trim()
    } else if (line.startsWith('### ')) {
      flush()
      const title = stripMd(line.slice(4).trim())
      const scoreEntry = findScoreKey(title)
      current = { title, scoreKey: scoreEntry?.key, scoreLabel: scoreEntry?.label, body: '', bullets: [], numbered: [], einschaetzung: '' }
    } else if (current) {
      if (line.startsWith('- ')) {
        current.bullets.push(stripMd(line.slice(2)))
      } else if (/^\d+\.\s/.test(line)) {
        current.numbered.push(stripMd(line.replace(/^\d+\.\s/, '')))
      } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        current.einschaetzung = stripMd(line.slice(1, -1))
      } else if (line.trim()) {
        bodyLines.push(stripMd(line))
      }
    }
  }
  flush()
  return { companyName, sections }
}

function addScoreBar(slide: PptxGenJS.Slide, score: number, label: string, x: number, y: number, w: number) {
  const c = barColor(score)
  // Label
  slide.addText(label, { x, y, w: 3.2, h: 0.3, fontSize: 10, color: DIM, fontFace: 'Avenir Next', valign: 'middle' })
  // Track
  slide.addShape(PptxGenJS.ShapeType.rect, { x: x + 3.4, y: y + 0.07, w: w - 3.4 - 0.5, h: 0.15, fill: { color: FAINT }, line: { color: FAINT, width: 0 } })
  // Fill
  const fillW = Math.max(0.08, (w - 3.4 - 0.5) * score / 10)
  slide.addShape(PptxGenJS.ShapeType.rect, { x: x + 3.4, y: y + 0.07, w: fillW, h: 0.15, fill: { color: c }, line: { color: c, width: 0 } })
  // Score
  slide.addText(`${score}`, { x: x + w - 0.4, y, w: 0.4, h: 0.3, fontSize: 13, bold: true, color: CREAM, fontFace: 'Avenir Next', align: 'right', valign: 'middle' })
}

function addFooter(slide: PptxGenJS.Slide, companyName: string) {
  slide.addText(`P2/ Digitalcheck  ·  ${companyName}`, {
    x: CX, y: 7.1, w: CW, h: 0.25, align: 'right',
    fontSize: 8, color: DIM, fontFace: 'Avenir Next',
  })
}

export async function generatePptx(markdown: string, scores: Scores, inputUrl: string) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const { companyName, sections } = parseReport(markdown)
  const today = new Date().toLocaleDateString('de-CH')

  // ── Slide 1: Titelfolie (vertikal zentriert) ────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: BG }
  // Hauptblock vertikal zentriert: Block ~2.4" hoch, zentriert bei 7.5" → y=2.55
  s1.addText('P2/ Digitalcheck', { x: CX, y: 2.3, w: CW, h: 0.5, fontSize: 13, color: DIM, fontFace: 'Avenir Next', bold: false })
  s1.addText(companyName,        { x: CX, y: 2.85, w: CW, h: 1.2, fontSize: 42, bold: true, color: CREAM, fontFace: 'Avenir Next' })
  s1.addText(inputUrl,           { x: CX, y: 4.1,  w: CW, h: 0.4, fontSize: 13, color: DIM, fontFace: 'Avenir Next' })
  // Footer-Leiste unten fixiert
  s1.addShape(PptxGenJS.ShapeType.rect, { x: CX, y: 6.3, w: CW, h: 0.03, fill: { color: FAINT }, line: { color: FAINT, width: 0 } })
  s1.addText(today,                { x: CX,            y: 6.5, w: CW / 2, h: 0.35, fontSize: 11, color: DIM, fontFace: 'Avenir Next' })
  s1.addText('P2/ Kommunikation AG', { x: CX + CW / 2, y: 6.5, w: CW / 2, h: 0.35, fontSize: 11, color: DIM, fontFace: 'Avenir Next', align: 'right' })

  // ── Slide 2: Score-Übersicht (vertikal zentriert) ───────────────────────────
  // 10 Zeilen × 0.48" = 4.8", Header 0.7", Footer 0.4" → total ~6.0" → start y=0.75
  const s2 = pptx.addSlide()
  s2.background = { color: BG }
  s2.addText('Gesamtbewertung', { x: CX, y: 0.65, w: CW - 2, h: 0.55, fontSize: 22, bold: true, color: CREAM, fontFace: 'Avenir Next' })
  s2.addText(`${scores.gesamt}/10`, { x: CX + CW - 2, y: 0.5, w: 2, h: 0.8, fontSize: 38, bold: true, color: barColor(scores.gesamt), fontFace: 'Avenir Next', align: 'right' })

  const barStartY = 1.45
  const barRowH = 0.48
  SCORE_MAP.forEach(({ key, label }, idx) => {
    addScoreBar(s2, scores[key], label, CX, barStartY + idx * barRowH, CW)
  })
  addFooter(s2, companyName)

  // ── Slides 3+: Abschnitte ───────────────────────────────────────────────────
  // Verfügbarer Bereich: Score-Header ~0.85", Footer ~0.35" → Content: 0.85" – 6.9" = 6.05"
  // Inhalt wird innerhalb dieses Bereichs vertikal zentriert
  const CONTENT_TOP = 1.1    // nach Score-Bar-Header
  const CONTENT_BOT = 6.75   // vor Footer
  const CONTENT_H   = CONTENT_BOT - CONTENT_TOP

  for (const section of sections) {
    const slide = pptx.addSlide()
    slide.background = { color: BG }

    // Score-Bar-Header – immer oben fixiert
    if (section.scoreKey && section.scoreLabel) {
      addScoreBar(slide, scores[section.scoreKey], section.scoreLabel, CX, 0.38, CW)
      slide.addShape(PptxGenJS.ShapeType.rect, { x: CX, y: 0.75, w: CW, h: 0.03, fill: { color: FAINT }, line: { color: FAINT, width: 0 } })
    }

    // Inhaltshöhe schätzen für vertikale Zentrierung
    const titleH   = 0.85
    const bodyH    = section.body ? 1.3 : 0
    const bulletH  = section.bullets.length  > 0 ? Math.min(2.4, section.bullets.length  * 0.38) : 0
    const numbH    = section.numbered.length > 0 ? Math.min(2.6, section.numbered.length * 0.40) : 0
    const einschH  = section.einschaetzung ? 0.55 : 0
    const gaps     = [bodyH, bulletH, numbH, einschH].filter(h => h > 0).length * 0.18

    const totalH = titleH + bodyH + bulletH + numbH + einschH + gaps
    // Zentriert im verfügbaren Raum
    const startY = CONTENT_TOP + Math.max(0, (CONTENT_H - totalH) / 2)
    let y = startY

    // Titel
    slide.addText(section.title, { x: CX, y, w: CW, h: titleH, fontSize: 26, bold: true, color: CREAM, fontFace: 'Avenir Next' })
    y += titleH + 0.18

    // Fliesstext
    if (section.body) {
      slide.addText(section.body, { x: CX, y, w: CW, h: bodyH, fontSize: 15, color: CREAM, fontFace: 'Avenir Next', wrap: true, valign: 'top' })
      y += bodyH + 0.18
    }

    // Bullets
    if (section.bullets.length > 0) {
      const items = section.bullets.slice(0, 7).map(b => ({
        text: b,
        options: { bullet: { code: '2013', indent: 12 }, color: CREAM, fontSize: 14, fontFace: 'Avenir Next' },
      }))
      slide.addText(items, { x: CX, y, w: CW, h: bulletH, wrap: true })
      y += bulletH + 0.18
    }

    // Nummerierte Liste
    if (section.numbered.length > 0) {
      const items = section.numbered.slice(0, 8).map((n, i) => ({
        text: `${i + 1}.   ${n}`,
        options: { color: CREAM, fontSize: 14, fontFace: 'Avenir Next' },
      }))
      slide.addText(items, { x: CX, y, w: CW, h: numbH, wrap: true })
      y += numbH + 0.18
    }

    // Einschätzung (fett, leicht abgesetzt)
    if (section.einschaetzung) {
      slide.addText(section.einschaetzung, { x: CX, y, w: CW, h: einschH, fontSize: 14, bold: true, color: CREAM, fontFace: 'Avenir Next', wrap: true })
    }

    addFooter(slide, companyName)
  }

  const filename = `P2-Digitalcheck-${companyName.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, '-').slice(0, 40)}-${today.replace(/\./g, '-')}.pptx`
  await pptx.writeFile({ fileName: filename })
}
