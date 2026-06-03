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

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'num'; text: string }
  | { kind: 'note'; text: string }

interface Section {
  title: string
  scoreKey?: keyof Omit<Scores, 'gesamt'>
  scoreLabel?: string
  blocks: Block[]
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

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,4})\s+(.+)/)
    if (headingMatch) {
      const text = stripMd(headingMatch[2].trim())
      if (/website analyse/i.test(text)) {
        companyName = text.replace(/Website Analyse\s*[–-]\s*/i, '').trim()
      } else {
        const scoreEntry = findScoreKey(text)
        current = { title: text, scoreKey: scoreEntry?.key, scoreLabel: scoreEntry?.label, blocks: [] }
        sections.push(current)
      }
    } else if (current) {
      const t = line.trim()
      if (t === '' || t === '---' || t === '***') continue // Leerzeilen & Trenner überspringen
      if (line.startsWith('- ') || line.startsWith('* ')) {
        current.blocks.push({ kind: 'bullet', text: stripMd(line.slice(2)) })
      } else if (/^\d+\.\s/.test(line)) {
        current.blocks.push({ kind: 'num', text: stripMd(line.replace(/^\d+\.\s/, '')) })
      } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && line.length > 2) {
        current.blocks.push({ kind: 'note', text: stripMd(line.slice(1, -1)) })
      } else {
        current.blocks.push({ kind: 'p', text: stripMd(line) })
      }
    }
  }
  return { companyName, sections }
}

function addScoreBar(slide: PptxGenJS.Slide, score: number, label: string, x: number, y: number, w: number) {
  const c = barColor(score)
  const trackW = w - 3.4 - 0.5
  // Label
  slide.addText(label, { x, y, w: 3.2, h: 0.3, fontSize: 10, color: DIM, fontFace: 'Avenir Next', valign: 'middle' })
  // Track (dünn, abgerundet)
  slide.addShape('roundRect', { x: x + 3.4, y: y + 0.12, w: trackW, h: 0.06, rectRadius: 0.03, fill: { color: FAINT }, line: { type: 'none' } })
  // Fill
  const fillW = Math.max(0.06, trackW * score / 10)
  slide.addShape('roundRect', { x: x + 3.4, y: y + 0.12, w: fillW, h: 0.06, rectRadius: 0.03, fill: { color: c }, line: { type: 'none' } })
  // Score
  slide.addText(`${score}`, { x: x + w - 0.4, y, w: 0.4, h: 0.3, fontSize: 13, bold: true, color: CREAM, fontFace: 'Avenir Next', align: 'right', valign: 'middle' })
}

function addFooter(slide: PptxGenJS.Slide, companyName: string) {
  slide.addText(`P2/ Digitalcheck  ·  ${companyName}`, {
    x: CX, y: 7.1, w: CW, h: 0.25, align: 'right',
    fontSize: 8, color: DIM, fontFace: 'Avenir Next',
  })
}

export async function generatePptx(markdown: string, scores: Scores, inputUrl: string): Promise<{ buffer: Buffer; filename: string }> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const { companyName: parsedName, sections } = parseReport(markdown)
  const hostname = (() => { try { return new URL(inputUrl).hostname.replace(/^www\./, '') } catch { return inputUrl } })()
  const companyName = parsedName || hostname
  const today = new Date().toLocaleDateString('de-CH')

  // ── Slide 1: Titelfolie ──────────────────────────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: BG }
  s1.addText('P2/ Digitalcheck', { x: CX, y: 2.5, w: CW, h: 1.3, fontSize: 54, bold: true, color: CREAM, fontFace: 'Avenir Next' })
  s1.addText(companyName, { x: CX, y: 3.85, w: CW, h: 0.7, fontSize: 24, color: CREAM, fontFace: 'Avenir Next' })
  s1.addText(inputUrl, { x: CX, y: 4.55, w: CW, h: 0.4, fontSize: 14, color: DIM, fontFace: 'Avenir Next' })
  s1.addShape('rect', { x: CX, y: 6.4, w: CW, h: 0.012, fill: { color: FAINT }, line: { type: 'none' } })
  s1.addText(today, { x: CX, y: 6.55, w: CW / 2, h: 0.35, fontSize: 11, color: DIM, fontFace: 'Avenir Next' })
  s1.addText('P2/ Kommunikation AG', { x: CX + CW / 2, y: 6.55, w: CW / 2, h: 0.35, fontSize: 11, color: DIM, fontFace: 'Avenir Next', align: 'right' })

  // ── Slide 2: Score-Übersicht ─────────────────────────────────────────────────
  const s2 = pptx.addSlide()
  s2.background = { color: BG }
  s2.addText('Gesamtbewertung', { x: CX, y: 0.65, w: CW - 2, h: 0.55, fontSize: 22, bold: true, color: CREAM, fontFace: 'Avenir Next' })
  s2.addText(`${scores.gesamt}/10`, { x: CX + CW - 2, y: 0.5, w: 2, h: 0.8, fontSize: 38, bold: true, color: barColor(scores.gesamt), fontFace: 'Avenir Next', align: 'right' })
  const barStartY = 1.55, barRowH = 0.46
  SCORE_MAP.forEach(({ key, label }, idx) => {
    addScoreBar(s2, scores[key], label, CX, barStartY + idx * barRowH, CW)
  })
  addFooter(s2, companyName)

  // ── Slides 3+: Abschnitte (mit automatischem Splitting bei zu viel Inhalt) ────
  const CONTENT_TOP = 1.85
  const CONTENT_BOT = 6.9
  const CONTENT_H = CONTENT_BOT - CONTENT_TOP
  const FONT = 12
  const CHARS_PER_LINE = 95   // bei 12pt Avenir, CW 10.5"
  const MAX_LINES = 22        // wieviele Zeilen passen in CONTENT_H bei 12pt

  // Geschätzte Zeilenzahl eines Blocks (Text-Umbruch + Absatzabstand)
  const blockLines = (b: Block): number => {
    const wrapped = Math.max(1, Math.ceil(b.text.length / CHARS_PER_LINE))
    return wrapped + 0.4 // Absatzabstand
  }

  // Blocks in Slide-Portionen aufteilen (an Block-Grenzen)
  function splitBlocks(blocks: Block[]): Block[][] {
    const pages: Block[][] = []
    let cur: Block[] = []
    let lines = 0
    for (const b of blocks) {
      const bl = blockLines(b)
      if (lines + bl > MAX_LINES && cur.length > 0) {
        pages.push(cur); cur = []; lines = 0
      }
      cur.push(b); lines += bl
    }
    if (cur.length > 0) pages.push(cur)
    return pages.length ? pages : [[]]
  }

  for (const section of sections) {
    const pages = splitBlocks(section.blocks)
    let numCounter = 0

    pages.forEach((pageBlocks, pageIdx) => {
      const slide = pptx.addSlide()
      slide.background = { color: BG }

      // Score-Bar-Header
      if (section.scoreKey && section.scoreLabel) {
        addScoreBar(slide, scores[section.scoreKey], section.scoreLabel, CX, 0.4, CW)
        slide.addShape('rect', { x: CX, y: 0.78, w: CW, h: 0.012, fill: { color: FAINT }, line: { type: 'none' } })
      }

      // Titel (Folge-Slides: "(Fortsetzung)")
      const titleText = pageIdx === 0 ? section.title : `${section.title} (Fortsetzung)`
      slide.addText(titleText, { x: CX, y: 1.0, w: CW, h: 0.7, fontSize: 26, bold: true, color: CREAM, fontFace: 'Avenir Next' })

      const para = pageBlocks.map(b => {
        if (b.kind === 'bullet') {
          return { text: b.text, options: { bullet: { code: '2013', indent: 18 }, color: CREAM, fontSize: FONT, fontFace: 'Avenir Next', breakLine: true, paraSpaceAfter: 4 } }
        }
        if (b.kind === 'num') {
          numCounter++
          return { text: `${numCounter}.  ${b.text}`, options: { color: CREAM, fontSize: FONT, fontFace: 'Avenir Next', breakLine: true, paraSpaceAfter: 4, indent: 18 } }
        }
        if (b.kind === 'note') {
          return { text: b.text, options: { bold: true, color: CREAM, fontSize: FONT, fontFace: 'Avenir Next', breakLine: true, paraSpaceBefore: 8, paraSpaceAfter: 4 } }
        }
        return { text: b.text, options: { color: CREAM, fontSize: FONT, fontFace: 'Avenir Next', breakLine: true, paraSpaceAfter: 6 } }
      })

      if (para.length > 0) {
        slide.addText(para, { x: CX, y: CONTENT_TOP, w: CW, h: CONTENT_H, valign: 'top', wrap: true })
      }

      addFooter(slide, companyName)
    })
  }

  // ── Letzter Slide: P2-Kontakt ────────────────────────────────────────────────
  const sEnd = pptx.addSlide()
  sEnd.background = { color: BG }
  // Logo als Schriftzug (zuverlässig in PowerPoint)
  sEnd.addText(
    [
      { text: 'P2', options: { fontSize: 60, bold: true, color: CREAM } },
      { text: '/', options: { fontSize: 60, bold: true, color: CREAM } },
    ],
    { x: CX, y: 2.4, w: CW, h: 1.0, fontFace: 'Avenir Next', align: 'center' }
  )
  sEnd.addText('einfach kommunikation', {
    x: CX, y: 3.45, w: CW, h: 0.4, fontSize: 14, color: DIM, fontFace: 'Avenir Next',
    align: 'center', charSpacing: 2,
  })
  sEnd.addText(
    [
      { text: 'Silbergasse 6', options: { breakLine: true } },
      { text: '2502 Biel/Bienne', options: { breakLine: true } },
      { text: ' ', options: { breakLine: true, fontSize: 8 } },
      { text: 'hello@p-zwei.ch', options: { breakLine: true } },
      { text: 'www.p-zwei.ch', options: { breakLine: true } },
    ],
    { x: CX, y: 4.4, w: CW, h: 2.0, fontSize: 14, color: CREAM, fontFace: 'Avenir Next', align: 'center', lineSpacingMultiple: 1.3 }
  )

  const safeName = companyName.replace(/[^a-zA-Z0-9äöüÄÖÜ]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'Analyse'
  const dateStamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const filename = `P2-Digitalcheck_${safeName}_${dateStamp}.pptx`

  // Serverseitig: als Node-Buffer zurückgeben (pptxgenjs läuft nativ in Node)
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return { buffer, filename }
}
