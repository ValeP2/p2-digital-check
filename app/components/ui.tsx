import type { ReactNode } from 'react'
import { Gauge, FileSearch, Globe, Layers } from 'lucide-react'
import { scoreBand } from '@/lib/check/score'
import type { Basis } from '@/lib/check/types'

// ── Gemeinsame Bausteine im Kompass-Look ─────────────────────────

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// Wie im Kompass (anmelde-rahmen.tsx): Feld grau, Knopf schwarz.
export const FELD = 'w-full px-4 pt-3 pb-2.5 rounded-md border border-black/10 bg-[#F5F5F7] text-[14px] text-foreground placeholder:text-[#9CA3AF] outline-none focus:border-foreground transition-colors'
// Violetter Verlauf wie der Grund der Kompass-Anmeldung — die Farbe des Digital Check.
export const VERLAUF = 'radial-gradient(circle at 12% 8%, #9C8FFF 0%, #7B6FEF 38%, #5B4FD1 72%, #4238A8 100%)'
export const VERLAUF_KNOPF = 'linear-gradient(135deg, #8F84F7 0%, #7B6FEF 45%, #5B4FD1 100%)'
export const KNOPF = 'inline-flex items-center justify-center gap-2 pt-3 pb-2.5 px-5 rounded-md text-white text-[14px] font-medium shadow-[0_4px_14px_rgba(91,79,209,0.35)] hover:brightness-110 transition-[filter,opacity] disabled:opacity-50 disabled:shadow-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [background:linear-gradient(135deg,#8F84F7_0%,#7B6FEF_45%,#5B4FD1_100%)]'
export const KNOPF_LEISE = 'inline-flex items-center justify-center gap-2 pt-2.5 pb-2 px-4 rounded-md border border-black/10 bg-white text-[13px] font-medium text-foreground hover:bg-[#F5F5F7] transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('bg-card rounded-xl card-shadow', className)}>{children}</div>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[18px] font-semibold text-foreground">{children}</h2>
      {hint && <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{hint}</p>}
    </div>
  )
}

/** Farbe zu einem Score — dieselben Bänder wie in Prompt und Bericht. */
export function scoreColor(score: number | null): string {
  return score === null ? '#9CA3AF' : scoreBand(score).color
}

/** Runder Score wie im Kompass (ScoreBadge lg), in drei Grössen. */
export function ScoreRing({ score, size = 'md', color: colorProp }: { score: number | null; size?: 'xs' | 'sm' | 'md' | 'lg'; color?: string }) {
  const color = colorProp ?? scoreColor(score)
  const dim = size === 'lg' ? 'w-[96px] h-[96px] text-[36px] border-[4px]' : size === 'md' ? 'w-[60px] h-[60px] text-[22px] border-[3px]' : size === 'sm' ? 'w-[40px] h-[40px] text-[14px] border-2' : 'w-[34px] h-[34px] text-[12.5px] border-2'
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full font-bold tabular-nums shrink-0', dim)}
      style={{ color, borderColor: color, backgroundColor: `${color}14`, letterSpacing: '-0.5px' }}
      aria-label={score === null ? 'nicht bewertet' : `${score} von 100`}
    >
      {score ?? '–'}
    </span>
  )
}

export function ScoreBar({ score, className }: { score: number | null; className?: string }) {
  const color = scoreColor(score)
  return (
    <div className={cn('w-full rounded-full h-1.5 overflow-hidden', className)} style={{ backgroundColor: `${color}25` }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score ?? 0}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }} />
    </div>
  )
}

const BASIS: Record<Basis, { label: string; title: string; icon: typeof Gauge }> = {
  gemessen: { label: 'Gemessen', title: 'Ausschliesslich aus Messungen (Crawl, Google PageSpeed)', icon: Gauge },
  inhaltspruefung: { label: 'Inhaltsprüfung', title: 'Von der KI am gelesenen Seiteninhalt beurteilt, jeder Punkt mit Fundstelle', icon: FileSearch },
  web_recherche: { label: 'Einschätzung via Web-Recherche', title: 'Beruht auf einer Websuche — eine Einschätzung, keine Messung', icon: Globe },
  gemischt: { label: 'Messung + Prüfung', title: 'Teils gemessen, teils von der KI am Inhalt beurteilt', icon: Layers },
}

/** Worauf eine Bewertung fusst — Muster aus dem Kompass (Bewertungsstufen). */
export function BasisBadge({ basis }: { basis: Basis | null }) {
  if (!basis) return null
  const b = BASIS[basis]
  const Icon = b.icon
  return (
    <span title={b.title} className="inline-flex items-center gap-1 rounded-xs bg-[#F5F5F7] px-2 pt-[3px] pb-[2px] text-[11px] font-medium text-muted-foreground whitespace-nowrap">
      <Icon className="w-3 h-3" /> {b.label}
    </span>
  )
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-xs px-2 pt-[3px] pb-[2px] text-[11px] font-semibold whitespace-nowrap"
      style={color ? { color, backgroundColor: `${color}18` } : { color: '#6B7280', backgroundColor: '#F5F5F7' }}
    >
      {children}
    </span>
  )
}
