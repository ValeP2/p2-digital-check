import { DIMENSIONS } from './criteria'
import type { Basis, CriterionResult, DimensionResult, Urteil } from './types'

// ── Rechnen statt setzen ─────────────────────────────────────────
//
// Dimension = gewichteter Erfüllungsgrad ihrer Prüfpunkte (erfüllt 1,
// teilweise ½, nicht erfüllt 0). "Nicht prüfbar" und "nicht relevant" fallen
// aus der Rechnung — sie dürfen weder Punkte bringen noch kosten.
// Gesamt = gewichteter Durchschnitt der bewerteten Dimensionen, normiert auf
// die, die tatsächlich bewertet wurden (Muster aus dem Kompass).

const WERT: Partial<Record<Urteil, number>> = { erfuellt: 1, teilweise: 0.5, nicht_erfuellt: 0 }

export function isCounted(u: Urteil): boolean {
  return u in WERT
}

export function dimensionScore(kriterien: CriterionResult[]): number | null {
  let sum = 0
  let total = 0
  for (const k of kriterien) {
    const v = WERT[k.urteil]
    if (v === undefined) continue
    sum += v * k.gewicht
    total += k.gewicht
  }
  return total === 0 ? null : Math.round((sum / total) * 100)
}

export function dimensionBasis(kriterien: CriterionResult[]): Basis | null {
  const quellen = new Set(kriterien.filter(k => isCounted(k.urteil)).map(k => k.quelle))
  if (quellen.size === 0) return null
  if (quellen.size > 1) return 'gemischt'
  const [q] = quellen
  return q === 'messung' ? 'gemessen' : q === 'recherche' ? 'web_recherche' : 'inhaltspruefung'
}

export function overallScore(dims: DimensionResult[]): { score: number | null; rechnung: string | null } {
  let weighted = 0
  let total = 0
  const parts: string[] = []
  for (const def of DIMENSIONS) {
    const d = dims.find(x => x.key === def.key)
    if (!d || d.score === null) continue
    weighted += d.score * def.gewicht
    total += def.gewicht
    parts.push(`${def.label} ${d.score} × ${def.gewicht}`)
  }
  if (total === 0) return { score: null, rechnung: null }
  const fehlt = DIMENSIONS.length - parts.length
  return {
    score: Math.round(weighted / total),
    rechnung: `Gewichtetes Mittel: ${parts.join(', ')}${fehlt > 0 ? ` (${fehlt} Dimension${fehlt > 1 ? 'en' : ''} nicht bewertet)` : ''}`,
  }
}

// ── Bänder: dieselben wie im Kompass-Prompt ──────────────────────

export interface Band { label: string; color: string; min: number }

export const BANDS: Band[] = [
  { min: 90, label: 'Vorbildlich', color: '#10b981' },
  { min: 75, label: 'Solide', color: '#10b981' },
  { min: 60, label: 'Ausbaufähig', color: '#7B6FEF' },
  { min: 40, label: 'Deutliche Lücken', color: '#f59e0b' },
  { min: 0, label: 'Kritisch', color: '#FF6B8A' },
]

export function scoreBand(score: number): Band {
  return BANDS.find(b => score >= b.min) ?? BANDS[BANDS.length - 1]
}
