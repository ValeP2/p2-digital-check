'use client'

export interface Scores {
  positionierung: number; angebot: number; zielgruppe: number; vertrauen: number
  conversion: number; seo: number; navigation: number; sprache: number
  technik: number; externe_sichtbarkeit: number; gesamt: number
}

const CREAM = '#EBEACC'
const CREAM_90 = 'rgba(235,234,204,0.9)'
const CREAM_60 = 'rgba(235,234,204,0.6)'
const CREAM_40 = 'rgba(235,234,204,0.4)'
const CREAM_15 = 'rgba(235,234,204,0.15)'

const SCORE_LABELS: { key: keyof Omit<Scores, 'gesamt'>; label: string; id: string }[] = [
  { key: 'positionierung',       label: 'Erster Eindruck & Positionierung',  id: 'section-positionierung' },
  { key: 'angebot',              label: 'Angebot & Verständlichkeit',         id: 'section-angebot' },
  { key: 'zielgruppe',           label: 'Zielgruppe & Kundenbedürfnis',       id: 'section-zielgruppe' },
  { key: 'vertrauen',            label: 'Vertrauen & Glaubwürdigkeit',        id: 'section-vertrauen' },
  { key: 'conversion',           label: 'Kontakt & Conversion',               id: 'section-conversion' },
  { key: 'seo',                  label: 'Inhalte & SEO',                      id: 'section-seo' },
  { key: 'navigation',           label: 'Navigation & Struktur',              id: 'section-navigation' },
  { key: 'sprache',              label: 'Sprache & Textqualität',             id: 'section-sprache' },
  { key: 'technik',              label: 'Technik & Mobile',                   id: 'section-technik' },
  { key: 'externe_sichtbarkeit', label: 'Externe Sichtbarkeit',               id: 'section-externe_sichtbarkeit' },
]

const HEADING_SCORE_MAP: { keywords: string[]; key: keyof Omit<Scores, 'gesamt'>; label: string; id: string }[] = [
  { keywords: ['positionierung', 'eindruck'],       key: 'positionierung',       label: 'Erster Eindruck & Positionierung',  id: 'section-positionierung' },
  { keywords: ['angebot', 'verständlichkeit'],      key: 'angebot',              label: 'Angebot & Verständlichkeit',         id: 'section-angebot' },
  { keywords: ['zielgruppe', 'kundenbedürfnis'],    key: 'zielgruppe',           label: 'Zielgruppe & Kundenbedürfnis',       id: 'section-zielgruppe' },
  { keywords: ['vertrauen', 'glaubwürdigkeit'],     key: 'vertrauen',            label: 'Vertrauen & Glaubwürdigkeit',        id: 'section-vertrauen' },
  { keywords: ['kontakt', 'conversion'],            key: 'conversion',           label: 'Kontakt & Conversion',               id: 'section-conversion' },
  { keywords: ['seo', 'inhalte'],                   key: 'seo',                  label: 'Inhalte & SEO',                      id: 'section-seo' },
  { keywords: ['navigation', 'struktur'],           key: 'navigation',           label: 'Navigation & Struktur',              id: 'section-navigation' },
  { keywords: ['sprache', 'textqualität'],          key: 'sprache',              label: 'Sprache & Textqualität',             id: 'section-sprache' },
  { keywords: ['technik', 'mobile'],                key: 'technik',              label: 'Technik & Mobile',                   id: 'section-technik' },
  { keywords: ['extern', 'sichtbarkeit', 'social'], key: 'externe_sichtbarkeit', label: 'Externe Sichtbarkeit',               id: 'section-externe_sichtbarkeit' },
]

function barColor(s: number) {
  if (s <= 3) return '#ef4444'
  if (s <= 5) return '#f97316'
  if (s <= 7) return '#eab308'
  return '#22c55e'
}
function scoreLabel(s: number) {
  if (s <= 3) return 'Kritisch'
  if (s <= 5) return 'Verbesserungsbedarf'
  if (s <= 7) return 'Gut'
  return 'Sehr gut'
}
function findScoreForHeading(h: string) {
  const lower = h.toLowerCase()
  return HEADING_SCORE_MAP.find(e => e.keywords.some(kw => lower.includes(kw))) ?? null
}

export function ScoreDashboard({ scores }: { scores: Scores }) {
  const circ = 2 * Math.PI * 42
  const ringFill = (scores.gesamt / 10) * circ
  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return (
    <div className="mb-12">
      <div className="flex flex-col items-center mb-10">
        <svg width="150" height="150" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke={CREAM_15} strokeWidth="5" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={barColor(scores.gesamt)} strokeWidth="5"
            strokeDasharray={`${ringFill} ${circ}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          <text x="50" y="47" textAnchor="middle" dominantBaseline="central" fontSize="28" fontWeight="700" fontFamily="Avenir Next, sans-serif" fill={CREAM}>{scores.gesamt}</text>
          <text x="50" y="68" textAnchor="middle" fontSize="9" fontFamily="Avenir Next, sans-serif" fill={CREAM_40}>von 10</text>
        </svg>
        <p className="text-base font-semibold mt-3" style={{ color: barColor(scores.gesamt) }}>{scoreLabel(scores.gesamt)}</p>
      </div>
      <div className="space-y-3 max-w-3xl mx-auto">
        {SCORE_LABELS.map(({ key, label, id }) => {
          const s = scores[key], c = barColor(s)
          return (
            <button key={key} onClick={() => scrollTo(id)} className="w-full flex items-center gap-4 group rounded-xl px-3 py-2 -mx-3 transition-all hover:bg-white/5">
              <span className="w-56 text-sm text-right shrink-0" style={{ color: CREAM_90 }}>{label}</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: CREAM_15 }}>
                <div className="h-full rounded-full" style={{ width: `${s * 10}%`, backgroundColor: c }} />
              </div>
              <span className="w-6 text-sm font-semibold shrink-0 text-right" style={{ color: CREAM }}>{s}</span>
            </button>
          )
        })}
      </div>
      <div className="flex justify-center flex-wrap gap-5 mt-8">
        {[['#ef4444','1–3 Kritisch'],['#f97316','4–5 Schwach'],['#eab308','6–7 Gut'],['#22c55e','8–10 Sehr gut']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
            <span className="text-sm" style={{ color: CREAM_60 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  const clean = text.replace(/`/g, '')
  return clean.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: CREAM, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  )
}

export function MarkdownRenderer({ content, scores }: { content: string; scores: Scores | null }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0, i = 0, lastWasH2 = false

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const headingText = line.replace(/^#{2,4}\s+/, '')
      const isMain = /website analyse/i.test(headingText)
      if (isMain) {
        elements.push(<h2 key={key++} style={{ color: CREAM, borderColor: CREAM_15 }} className="text-2xl font-bold mt-6 mb-5 pb-4 border-b tracking-wide">{headingText}</h2>)
        lastWasH2 = true
      } else {
        const entry = scores ? findScoreForHeading(headingText) : null
        const showDivider = !lastWasH2
        lastWasH2 = false
        elements.push(
          <div key={key++} id={entry ? entry.id : undefined} style={{ scrollMarginTop: '32px' }}>
            {showDivider && <div className="mt-0 mb-8" style={{ borderTop: `1px solid ${CREAM_15}` }} />}
            {entry && scores && (
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm shrink-0" style={{ color: CREAM_60 }}>{entry.label}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: CREAM_15 }}>
                  <div className="h-full rounded-full" style={{ width: `${scores[entry.key] * 10}%`, backgroundColor: barColor(scores[entry.key]) }} />
                </div>
                <span className="text-sm font-semibold shrink-0" style={{ color: CREAM }}>{scores[entry.key]}</span>
              </div>
            )}
            <h3 style={{ color: CREAM }} className="text-xl font-semibold mb-3">{headingText}</h3>
          </div>
        )
      }
      i++
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) { items.push(lines[i].slice(2)); i++ }
      elements.push(<ul key={key++} className="space-y-2 my-3 ml-1">{items.map((it, idx) => (
        <li key={idx} className="flex gap-3 text-base leading-relaxed" style={{ color: CREAM_90 }}>
          <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CREAM_40 }} /><span>{renderInline(it)}</span>
        </li>))}</ul>)
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length) {
        if (/^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
        else if (lines[i].trim() === '' && i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1])) i++
        else break
      }
      elements.push(<ol key={key++} className="space-y-2.5 my-3 ml-1 list-none">{items.map((it, idx) => (
        <li key={idx} className="flex gap-4 text-base leading-relaxed" style={{ color: CREAM_90 }}>
          <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5" style={{ background: CREAM_15, color: CREAM }}>{idx + 1}</span>
          <span>{renderInline(it)}</span>
        </li>))}</ol>)
    } else if (line.trim().startsWith('```')) { i++ }
    else if (line.trim() === '---' || line.trim() === '***') { i++ }
    else if (line.startsWith('*') && line.endsWith('*') && line.length > 2 && !line.startsWith('**')) {
      elements.push(<p key={key++} className="text-base font-semibold my-4" style={{ color: CREAM }}>{line.slice(1, -1)}</p>); i++
    } else if (line.trim() === '') { elements.push(<div key={key++} className="h-2" />); i++ }
    else { lastWasH2 = false; elements.push(<p key={key++} className="text-base leading-loose" style={{ color: CREAM_90 }}>{renderInline(line)}</p>); i++ }
  }
  return <div className="space-y-1">{elements}</div>
}
