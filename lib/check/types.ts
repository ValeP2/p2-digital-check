import type { TechnicalData } from '../crawl/crawlerTypes'
import type { PageSpeedOutcome } from '../measure/pagespeed'
import type { PlatformInfo, ImprintInfo } from '../crawl/siteIdentity'

export const DIMENSION_KEYS = [
  'positionierung', 'angebot', 'zielgruppe', 'vertrauen', 'conversion',
  'seo', 'navigation', 'sprache', 'technik', 'externe_sichtbarkeit',
] as const
export type DimensionKey = typeof DIMENSION_KEYS[number]

/** Urteil je Prüfpunkt. Die letzten beiden zählen nicht in den Score. */
export const URTEILE = ['erfuellt', 'teilweise', 'nicht_erfuellt', 'nicht_pruefbar', 'nicht_relevant'] as const
export type Urteil = typeof URTEILE[number]

/** Worauf ein Prüfpunkt beruht. */
export type Quelle = 'messung' | 'inhalt' | 'recherche'

export interface CriterionResult {
  id: string
  label: string
  gewicht: number
  quelle: Quelle
  urteil: Urteil
  beleg: string
}

/**
 * Bewertungsgrundlage einer Dimension, abgeleitet aus den Quellen ihrer
 * gezählten Prüfpunkte — vom Server gesetzt, nie vom Modell (Kompass-Regel).
 */
export type Basis = 'gemessen' | 'inhaltspruefung' | 'web_recherche' | 'gemischt'

export interface DimensionResult {
  key: DimensionKey
  label: string
  /** 0–100, gerechnet. null = nichts Bewertbares. */
  score: number | null
  basis: Basis | null
  befund: string
  kriterien: CriterionResult[]
}

export const LEVELS = ['Hoch', 'Mittel', 'Tief'] as const
export const HORIZONTE = ['Sofort', 'Kurzfristig', 'Strategisch'] as const

export interface Massnahme {
  titel: string
  beschreibung: string
  dimension: DimensionKey
  prioritaet: typeof LEVELS[number]
  wirkung: typeof LEVELS[number]
  zeithorizont: typeof HORIZONTE[number]
  schritte: string[]
}

export interface Textbeispiel {
  seite: string
  vorher: string
  nachher: string
}

export interface CheckResult {
  version: 2
  url: string
  finalUrl: string
  checkedAt: string
  firma: { name: string; branche: string; angebot: string; zielgruppe: string; region: string }
  overall: number | null
  overallRechnung: string | null
  fazit: string
  staerken: string[]
  dimensionen: DimensionResult[]
  massnahmen: Massnahme[]
  textbeispiele: Textbeispiel[]
  messungen: {
    pagespeed: PageSpeedOutcome
    technik: TechnicalData
    plattform: PlatformInfo
    impressum: ImprintInfo
    socialProfiles: { platform: string; url: string }[]
    seiten: { url: string; status: number; woerter: number; lesbar: boolean }[]
    nichtErreichbar: string[]
  }
  recherche: { text: string; suchen: number } | null
  meta: {
    model: string
    researchModel: string
    kalibrierung: string
    costUsd: number
    costChf: number
    inputTokens: number
    outputTokens: number
    webSearches: number
    durationMs: number
  }
}
