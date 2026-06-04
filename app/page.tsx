'use client'

import { useState, useRef, useEffect } from 'react'
import LogoP2 from './components/LogoP2'

type Phase = 'idle' | 'crawling' | 'generating' | 'done' | 'error'

interface CostInfo { inputTokens: number; outputTokens: number; chf: string }

interface Scores {
  positionierung: number; angebot: number; zielgruppe: number; vertrauen: number
  conversion: number; seo: number; navigation: number; sprache: number
  technik: number; externe_sichtbarkeit: number; gesamt: number
}

interface SavedAnalysis {
  id: string
  url: string
  companyName: string
  date: string
  scores: Scores
  report: string
  cost: CostInfo | null
}

const STORAGE_KEY = 'p2-analyses'

function loadHistory(): SavedAnalysis[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    // Nur valide Einträge behalten (schützt vor altem/kaputtem Format → kein Crash)
    return raw.filter((a): a is SavedAnalysis =>
      a && typeof a.url === 'string' && typeof a.id === 'string' &&
      a.scores && typeof a.scores.gesamt === 'number' && typeof a.report === 'string'
    )
  } catch { return [] }
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function normalizeUrl(u: string): string {
  let s = u.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  return s
}

function saveToHistory(analysis: SavedAnalysis, keepExisting = false) {
  const all = loadHistory()
  // keepExisting=false → vorhandenen Eintrag mit gleicher URL überschreiben (entfernen)
  const base = keepExisting ? all : all.filter(a => normalizeUrl(a.url) !== normalizeUrl(analysis.url))
  const updated = [analysis, ...base].slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

function deleteFromHistory(id: string) {
  const updated = loadHistory().filter(a => a.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

function extractCompanyName(report: string): string {
  const match = report.match(/##\s+Website Analyse\s*[–-]\s*(.+)/i)
  return match ? match[1].trim() : ''
}

const CREAM = '#EBEACC'
const CREAM_90 = 'rgba(235,234,204,0.9)'
const CREAM_60 = 'rgba(235,234,204,0.6)'
const CREAM_40 = 'rgba(235,234,204,0.4)'
const CREAM_15 = 'rgba(235,234,204,0.15)'
const CREAM_08 = 'rgba(235,234,204,0.08)'

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

// ─── Archive Modal ─────────────────────────────────────────────────────────────
function ArchiveModal({ onClose, onLoad }: { onClose: () => void; onLoad: (a: SavedAnalysis) => void }) {
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [sort, setSort] = useState<'date' | 'score' | 'name'>('date')

  useEffect(() => { setHistory(loadHistory()) }, [])

  const sorted = [...history].sort((a, b) => {
    if (sort === 'score') return b.scores.gesamt - a.scores.gesamt
    if (sort === 'name') return (a.companyName || a.url).localeCompare(b.companyName || b.url)
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  function handleDelete(id: string) {
    deleteFromHistory(id)
    setHistory(h => h.filter(a => a.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#293263', border: '1px solid rgba(235,234,204,0.15)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(235,234,204,0.1)' }}>
          <h2 className="text-base font-semibold" style={{ color: '#EBEACC' }}>Analyse-Archiv ({history.length})</h2>
          <div className="flex items-center gap-3">
            <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
              className="text-sm rounded-lg px-3 py-1.5 outline-none"
              style={{ background: 'rgba(235,234,204,0.1)', color: '#EBEACC', border: '1px solid rgba(235,234,204,0.15)' }}>
              <option value="date">Datum</option>
              <option value="score">Score</option>
              <option value="name">Name</option>
            </select>
            <button onClick={onClose} className="text-sm opacity-50 hover:opacity-100 transition-opacity" style={{ color: '#EBEACC' }}>✕</button>
          </div>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto flex-1">
          {sorted.length === 0 && (
            <p className="text-center py-12 text-sm" style={{ color: 'rgba(235,234,204,0.4)' }}>Noch keine Analysen gespeichert</p>
          )}
          {sorted.map(a => (
            <div key={a.id} className="flex items-center gap-4 px-6 py-3 group transition-colors cursor-pointer"
              style={{ borderBottom: '1px solid rgba(235,234,204,0.06)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(235,234,204,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onLoad(a); onClose() }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'rgba(235,234,204,0.1)', color: '#EBEACC' }}>
                {a.scores.gesamt}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#EBEACC' }}>{a.companyName || a.url}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(235,234,204,0.4)' }}>{a.url} · {new Date(a.date).toLocaleDateString('de-CH')}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-xs transition-opacity px-2 py-1 rounded"
                style={{ color: '#EBEACC' }}>Löschen</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Score Dashboard ───────────────────────────────────────────────────────────
function ScoreDashboard({ scores }: { scores: Scores }) {
  const circ = 2 * Math.PI * 42
  const [animated, setAnimated] = useState(false)
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setAnimated(true), 80)
    let current = 0
    const target = scores.gesamt
    const t2 = setInterval(() => {
      current += 1
      setDisplayScore(Math.min(current, target))
      if (current >= target) clearInterval(t2)
    }, 600 / target)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [scores.gesamt])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const ringFill = animated ? (scores.gesamt / 10) * circ : 0

  return (
    <div className="mb-12 fade-in-up">
      {/* Gesamtscore – Ring */}
      <div className="flex flex-col items-center mb-10">
        <svg width="150" height="150" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke={CREAM_15} strokeWidth="5" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={barColor(scores.gesamt)} strokeWidth="5"
            strokeDasharray={`${ringFill} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
          />
          <text x="50" y="47" textAnchor="middle" dominantBaseline="central"
            fontSize="28" fontWeight="700" fontFamily="Avenir Next, Avenir, sans-serif"
            fill={CREAM}>{displayScore}</text>
          <text x="50" y="68" textAnchor="middle"
            fontSize="9" fontFamily="Avenir Next, Avenir, sans-serif"
            fill={CREAM_40}>von 10</text>
        </svg>
        <p className="text-base font-semibold mt-3" style={{ color: barColor(scores.gesamt) }}>
          {scoreLabel(scores.gesamt)}
        </p>
      </div>

      {/* Balken – animiert wachsend */}
      <div className="space-y-3 max-w-3xl mx-auto">
        {SCORE_LABELS.map(({ key, label, id }, idx) => {
          const s = scores[key]
          const c = barColor(s)
          return (
            <button
              key={key}
              onClick={() => scrollTo(id)}
              className="w-full flex items-center gap-4 group rounded-xl px-3 py-2 -mx-3 transition-all"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = CREAM_08)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="w-56 text-sm text-right shrink-0" style={{ color: CREAM_90 }}>{label}</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: CREAM_15 }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: animated ? `${s * 10}%` : '0%',
                    backgroundColor: c,
                    transition: `width 0.7s cubic-bezier(0.4,0,0.2,1) ${idx * 60}ms`,
                  }}
                />
              </div>
              <span className="w-6 text-sm font-semibold shrink-0 text-right" style={{ color: CREAM }}>{s}</span>
              <span className="text-sm opacity-0 group-hover:opacity-30 transition-opacity shrink-0" style={{ color: CREAM }}>↓</span>
            </button>
          )
        })}
      </div>

      {/* Legende */}
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

// ─── Inline Score Bar (in Report-Headings) ─────────────────────────────────────
function InlineScoreBar({ scoreKey, label, scores }: { scoreKey: keyof Omit<Scores, 'gesamt'>; label: string; scores: Scores }) {
  const s = scores[scoreKey]
  const c = barColor(s)
  return (
    <div className="flex items-center gap-4 mb-4">
      <span className="text-sm shrink-0" style={{ color: CREAM_60 }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: CREAM_15 }}>
        <div className="h-full rounded-full" style={{ width: `${s * 10}%`, backgroundColor: c }} />
      </div>
      <span className="text-sm font-semibold shrink-0" style={{ color: CREAM }}>{s}</span>
    </div>
  )
}

// ─── Markdown Renderer ─────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  // einzelne Backticks (Inline-Code) entfernen – wir zeigen reinen Text
  const clean = text.replace(/`/g, '')
  return clean.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: CREAM, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  )
}

function MarkdownRenderer({ content, scores }: { content: string; scores: Scores | null }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0
  let i = 0

  let lastWasH2 = false

  while (i < lines.length) {
    const line = lines[i]

    // Überschrift (## oder ### – Haiku ist inkonsistent, beide gleich behandeln)
    if (line.startsWith('## ') || line.startsWith('### ')) {
      const headingText = line.replace(/^#{2,4}\s+/, '')
      const isMainTitle = /website analyse/i.test(headingText)

      if (isMainTitle) {
        // Haupttitel – grosse Überschrift, kein Score-Bar
        elements.push(
          <h2 key={key++} style={{ color: CREAM, borderColor: CREAM_15 }}
            className="text-2xl font-bold mt-6 mb-5 pb-4 border-b tracking-wide">
            {headingText}
          </h2>
        )
        lastWasH2 = true
      } else {
        // Abschnitts-Heading – mit Score-Bar wenn erkannt
        const entry = scores ? findScoreForHeading(headingText) : null
        const showDivider = !lastWasH2
        lastWasH2 = false
        elements.push(
          <div key={key++} id={entry ? entry.id : undefined} style={{ scrollMarginTop: '32px' }}>
            {showDivider && <div className="mt-0 mb-8" style={{ borderTop: `1px solid ${CREAM_15}` }} />}
            {entry && scores && <InlineScoreBar scoreKey={entry.key} label={entry.label} scores={scores} />}
            <h3 style={{ color: CREAM }} className="text-xl font-semibold mb-3">
              {headingText}
            </h3>
          </div>
        )
      }
      i++

    } else if (line.startsWith('- ')) {
      lastWasH2 = false
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2)); i++
      }
      elements.push(
        <ul key={key++} className="space-y-2 my-3 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-3 text-base leading-relaxed" style={{ color: CREAM_90 }}>
              <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CREAM_40 }} />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )

    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      // Leerzeilen zwischen den Punkten tolerieren (Haiku setzt sie oft)
      while (i < lines.length) {
        if (/^\d+\.\s/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+\.\s/, '')); i++
        } else if (lines[i].trim() === '' && i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1])) {
          i++ // Leerzeile überspringen, nächste Zeile ist wieder nummeriert
        } else {
          break
        }
      }
      elements.push(
        <ol key={key++} className="space-y-2.5 my-3 ml-1 list-none">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-4 text-base leading-relaxed" style={{ color: CREAM_90 }}>
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5"
                style={{ background: CREAM_15, color: CREAM }}>{idx + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      )

    // Code-Fence: nur die ```-Zeile ignorieren, Inhalt normal weiterrendern
    // (verhindert dass ein ungeschlossener Block den Rest verschluckt)
    } else if (line.trim().startsWith('```')) {
      i++

    // Tabelle
    } else if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]); i++
      }
      const rows = tableLines.filter(l => !l.match(/^\|[-| :]+\|$/))
      elements.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            {rows.map((row, ridx) => {
              const cells = row.split('|').filter(c => c.trim())
              return (
                <tr key={ridx} style={{ borderBottom: `1px solid ${CREAM_15}` }}>
                  {cells.map((cell, cidx) => (
                    <td key={cidx} className="py-1.5 pr-4 text-left align-top"
                      style={{ color: ridx === 0 ? CREAM : CREAM_90, fontWeight: ridx === 0 ? 600 : 400 }}>
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </table>
        </div>
      )

    // Horizontale Linie vom LLM ignorieren (wir setzen eigene Trennlinien vor jedem Abschnitt)
    } else if (line.trim() === '---' || line.trim() === '***') {
      i++

    // Einschätzung (kursiv)
    } else if (line.startsWith('*') && line.endsWith('*') && line.length > 2 && !line.startsWith('**')) {
      elements.push(
        <p key={key++} className="text-base font-semibold my-4" style={{ color: CREAM }}>
          {line.slice(1, -1)}
        </p>
      )
      i++
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
      i++
    } else {
      lastWasH2 = false
      elements.push(
        <p key={key++} className="text-base leading-loose" style={{ color: CREAM_90 }}>
          {renderInline(line)}
        </p>
      )
      i++
    }
  }

  return <div className="space-y-1">{elements}</div>
}

// ─── Export Button ─────────────────────────────────────────────────────────────
function ExportButton({ report, scores, inputUrl }: { report: string; scores: Scores; inputUrl: string }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, scores, url: inputUrl }),
      })
      if (!res.ok) throw new Error('Export-Request fehlgeschlagen: ' + res.status)
      const blob = await res.blob()
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ?? 'P2-Digitalcheck.pptx'
      const dlUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000)
    } catch (err) {
      console.error('Export fehlgeschlagen:', err)
      alert('PowerPoint-Export fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 text-sm rounded-full px-5 py-2 transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{ background: CREAM_15, color: CREAM, border: `1px solid rgba(235,234,204,0.2)` }}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      {exporting ? 'Wird erstellt…' : 'Als PowerPoint exportieren'}
    </button>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [statusText, setStatusText] = useState('')
  const [report, setReport] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [cost, setCost] = useState<CostInfo | null>(null)
  const [scores, setScores] = useState<Scores | null>(null)
  const [history, setHistory] = useState<SavedAnalysis[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [totalCost, setTotalCost] = useState<{ chf: number; count: number } | null>(null)
  const [dupAnalysis, setDupAnalysis] = useState<SavedAnalysis | null>(null)
  const [dupStep, setDupStep] = useState<'first' | 'overwrite' | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHistory(loadHistory()) }, [])

  async function refreshTotalCost() {
    try {
      const res = await fetch('/api/total-cost')
      if (res.ok) {
        const d = await res.json()
        if (!d.unavailable) setTotalCost({ chf: Number(d.chf), count: Number(d.count) })
      }
    } catch { /* ignore */ }
  }
  useEffect(() => { refreshTotalCost() }, [])
  // Nach Abschluss einer Analyse aktualisieren
  useEffect(() => { if (phase === 'done') refreshTotalCost() }, [phase])

  function loadAnalysis(a: SavedAnalysis) {
    setUrl(a.url)
    setReport(a.report)
    setScores(a.scores)
    setCost(a.cost)
    setPhase('done')
    setErrorMsg('')
  }

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    // Duplikat-Check: schon analysiert?
    const existing = loadHistory().find(a => normalizeUrl(a.url) === normalizeUrl(url))
    if (existing) {
      setDupAnalysis(existing)
      setDupStep('first')
      return
    }
    runAnalysis(false)
  }

  async function runAnalysis(keepExisting: boolean) {
    setDupStep(null); setDupAnalysis(null)
    setPhase('crawling'); setStatusText('Crawle Website...')
    setReport(''); setErrorMsg(''); setCost(null); setScores(null); setTruncated(false)

    const res = await fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    })
    if (!res.ok || !res.body) {
      setPhase('error'); setErrorMsg('Analyse fehlgeschlagen. Bitte URL prüfen.')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = '', fullText = ''
    // Lokale Sammler für sauberes Speichern am Ende
    let finalScores: Scores | null = null
    let finalCost: CostInfo | null = null
    let hadError = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const evLine = event.split('\n').find(l => l.startsWith('event:'))
        const dataLine = event.split('\n').find(l => l.startsWith('data:'))
        if (!evLine || !dataLine) continue
        const evType = evLine.slice(7).trim()
        const data = JSON.parse(dataLine.slice(5)) as string
        if (evType === 'status') { setStatusText(data); if (data.includes('Generiere')) setPhase('generating') }
        else if (evType === 'scores') { finalScores = JSON.parse(data) as Scores; setScores(finalScores) }
        else if (evType === 'chunk') { fullText += data; setReport(fullText) }
        else if (evType === 'cost') { finalCost = JSON.parse(data) as CostInfo; setCost(finalCost) }
        else if (evType === 'truncated') setTruncated(true)
        else if (evType === 'done') setPhase('done')
        else if (evType === 'error') { hadError = true; setPhase('error'); setErrorMsg(data) }
      }
    }

    // Stream beendet – Phase finalisieren + in History speichern
    if (!hadError) {
      setPhase('done')
      if (fullText && finalScores) {
        const entry: SavedAnalysis = {
          id: Date.now().toString(),
          url,
          companyName: extractCompanyName(fullText),
          date: new Date().toISOString(),
          scores: finalScores,
          report: fullText,
          cost: finalCost,
        }
        saveToHistory(entry, keepExisting)
        setHistory(loadHistory())
      }
    }
  }

  async function handleContinue() {
    setContinuing(true)
    setTruncated(false)
    try {
      const res = await fetch('/api/continue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, url }),
      })
      if (!res.ok || !res.body) throw new Error('Fortsetzung fehlgeschlagen')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', fullText = report
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          const evLine = event.split('\n').find(l => l.startsWith('event:'))
          const dataLine = event.split('\n').find(l => l.startsWith('data:'))
          if (!evLine || !dataLine) continue
          const evType = evLine.slice(7).trim()
          const data = JSON.parse(dataLine.slice(5)) as string
          if (evType === 'chunk') { fullText += data; setReport(fullText) }
          else if (evType === 'truncated') setTruncated(true)
        }
      }
      // Fortgesetzten Bericht in History aktualisieren
      if (scores) {
        const entry: SavedAnalysis = {
          id: Date.now().toString(), url,
          companyName: extractCompanyName(fullText),
          date: new Date().toISOString(), scores, report: fullText, cost,
        }
        saveToHistory(entry); setHistory(loadHistory())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setContinuing(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  const busy = phase === 'crawling' || phase === 'generating'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#293263', color: CREAM }}>

      {/* Header – fixiert, scrollt mit, fadet nach unten aus */}
      <header className="no-print px-8 pt-7 pb-10 flex items-center justify-between sticky top-0 z-20"
        style={{ background: 'linear-gradient(to bottom, #293263 0%, #293263 45%, rgba(41,50,99,0.85) 70%, rgba(41,50,99,0) 100%)' }}>
        <button onClick={() => { window.location.href = '/' }} className="transition-opacity hover:opacity-80 cursor-pointer" title="Zur Startseite">
          <LogoP2 height={30} />
        </button>
        <button onClick={handleLogout} className="text-sm transition-opacity hover:opacity-80"
          style={{ color: CREAM_40 }}>
          Abmelden
        </button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-24">

        {/* Hero */}
        <div className="text-center pt-14 pb-12 no-print">
          <h1 className="text-6xl font-bold tracking-tight mb-4" style={{ color: CREAM }}>
            P2/ Digitalcheck
          </h1>
          <p className="text-base" style={{ color: CREAM_40 }}>
            URL eingeben – das Tool crawlt die Seite automatisch und erstellt einen vollständigen Digital Check Bericht.
          </p>

          <form onSubmit={handleAnalyze} className="mt-8 flex gap-3">
            <input
              type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://www.beispiel.ch"
              disabled={busy}
              className="flex-1 rounded-full px-7 py-[11px] text-base outline-none disabled:opacity-50"
              style={{ background: CREAM, color: '#293263', fontFamily: 'inherit' }}
            />
            <button type="submit" disabled={!url.trim() || busy}
              className="rounded-full px-7 py-[11px] text-base font-semibold transition-opacity disabled:opacity-40 shrink-0"
              style={{ background: CREAM_15, color: CREAM, border: `1px solid rgba(235,234,204,0.25)` }}>
              {busy ? 'Läuft…' : 'Analysieren'}
            </button>
          </form>

          {busy && (
            <div className="mt-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: CREAM, animationDelay: `${i*0.15}s`, opacity: 0.5 }} />
                ))}
              </div>
              <p className="text-base font-semibold" style={{ color: CREAM }}>{statusText}</p>
              <p className="text-sm mt-1" style={{ color: CREAM_40 }}>
                Die Analyse dauert ca. 30–60 Sekunden – bitte nicht die Seite verlassen.
              </p>
            </div>
          )}
        {/* Recent + Archiv */}
        {phase === 'idle' && history.length > 0 && (
          <div className="mt-6 no-print">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest" style={{ color: 'rgba(235,234,204,0.35)' }}>Zuletzt analysiert</span>
              <button onClick={() => setShowArchive(true)} className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'rgba(235,234,204,0.45)' }}>
                Alle anzeigen ({history.length}) →
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {history.slice(0, 10).map(a => (
                <button key={a.id} onClick={() => loadAnalysis(a)}
                  className="flex items-center gap-3 text-sm rounded-xl px-4 py-2.5 transition-all w-full text-left"
                  style={{ background: 'rgba(235,234,204,0.06)', border: '1px solid rgba(235,234,204,0.1)', color: '#EBEACC' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(235,234,204,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(235,234,204,0.06)')}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: barColor(a.scores.gesamt), color: '#293263' }}>
                    {a.scores.gesamt}
                  </span>
                  <span className="flex-1 truncate font-medium">{a.companyName || safeHostname(a.url)}</span>
                  <span className="text-xs truncate hidden sm:block" style={{ color: 'rgba(235,234,204,0.4)' }}>
                    {safeHostname(a.url)}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: 'rgba(235,234,204,0.4)' }}>
                    {new Date(a.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>

        {/* Fehler */}
        {phase === 'error' && (
          <div className="no-print rounded-xl p-5 mb-8 text-base"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
            {errorMsg}
          </div>
        )}

        {/* Score Dashboard */}
        {scores && <ScoreDashboard scores={scores} />}

        {/* Report */}
        {report && (
          <div ref={reportRef} className="pb-8 fade-in-up">
            <MarkdownRenderer content={report} scores={scores} />
          </div>
        )}

        {/* Weiter-Button bei abgeschnittenem Bericht */}
        {(truncated || continuing) && phase === 'done' && (
          <div className="no-print flex flex-col items-center gap-3 py-6 mb-4">
            <p className="text-sm text-center" style={{ color: CREAM_60 }}>
              Der Bericht wurde wegen seiner Länge unterbrochen.
            </p>
            <button onClick={handleContinue} disabled={continuing}
              className="rounded-full px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: CREAM, color: '#293263' }}>
              {continuing ? 'Setze fort…' : 'Analyse fortsetzen →'}
            </button>
          </div>
        )}
      </main>

      <footer className="no-print pb-10 px-8" style={{ color: 'rgba(235,234,204,0.18)' }}>
        {phase === 'done' && (
          <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4 pt-6 mb-6"
            style={{ borderTop: '1px solid rgba(235,234,204,0.1)' }}>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-sm" style={{ color: '#22c55e' }}>
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Analyse abgeschlossen
              </span>
              {cost && (
                <span className="text-sm" style={{ color: CREAM_40 }}>
                  CHF {cost.chf} · {((cost.inputTokens + cost.outputTokens)/1000).toFixed(1)}k Tokens
                </span>
              )}
            </div>
            {scores && (
              <ExportButton report={report} scores={scores} inputUrl={url} />
            )}
          </div>
        )}
        <div className="max-w-4xl mx-auto text-center text-sm flex items-center justify-center gap-3">
          <span>v1.0.0</span>
          {totalCost && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span title={`${totalCost.count} Analysen insgesamt`}>
                Gesamtkosten: CHF {totalCost.chf.toFixed(2)} ({totalCost.count} Analysen)
              </span>
            </>
          )}
        </div>
      </footer>

      {showArchive && (
        <ArchiveModal
          onClose={() => setShowArchive(false)}
          onLoad={a => { loadAnalysis(a); setShowArchive(false) }}
        />
      )}

      {/* Duplikat-Dialog */}
      {dupStep && dupAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => { setDupStep(null); setDupAnalysis(null) }}>
          <div className="w-full max-w-md rounded-2xl p-7" style={{ background: '#293263', border: '1px solid rgba(235,234,204,0.15)' }}
            onClick={e => e.stopPropagation()}>

            {dupStep === 'first' ? (
              <>
                <h2 className="text-lg font-semibold mb-2" style={{ color: CREAM }}>Bereits analysiert</h2>
                <p className="text-sm mb-6" style={{ color: CREAM_60 }}>
                  Für <strong style={{ color: CREAM }}>{dupAnalysis.companyName || safeHostname(dupAnalysis.url)}</strong> existiert
                  bereits eine Analyse vom {new Date(dupAnalysis.date).toLocaleDateString('de-CH')} (Score {dupAnalysis.scores.gesamt}/10).
                </p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => { loadAnalysis(dupAnalysis); setDupStep(null); setDupAnalysis(null) }}
                    className="rounded-full px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: CREAM, color: '#293263' }}>
                    Vorhandene Analyse öffnen
                  </button>
                  <button onClick={() => setDupStep('overwrite')}
                    className="rounded-full px-5 py-3 text-sm transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(235,234,204,0.1)', color: CREAM, border: '1px solid rgba(235,234,204,0.2)' }}>
                    Neu analysieren
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold mb-2" style={{ color: CREAM }}>Neu analysieren</h2>
                <p className="text-sm mb-6" style={{ color: CREAM_60 }}>
                  Soll die bestehende Analyse überschrieben oder eine zusätzliche angelegt werden?
                </p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => runAnalysis(false)}
                    className="rounded-full px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: CREAM, color: '#293263' }}>
                    Überschreiben
                  </button>
                  <button onClick={() => runAnalysis(true)}
                    className="rounded-full px-5 py-3 text-sm transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(235,234,204,0.1)', color: CREAM, border: '1px solid rgba(235,234,204,0.2)' }}>
                    Zusätzliche Analyse anlegen
                  </button>
                  <button onClick={() => setDupStep('first')}
                    className="text-xs mt-1 transition-opacity hover:opacity-100" style={{ color: CREAM_40 }}>
                    ← Zurück
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
