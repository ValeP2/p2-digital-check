// ── Ladezeit und Mobiltauglichkeit über Google PageSpeed Insights ─
//
// Googles eigene Messung (Lighthouse, Mobilprofil) plus — falls Google genug
// echte Besuche kennt — Felddaten aus dem Chrome-Nutzerbericht. Das ist die
// einzige Stelle, an der Ladezeit wirklich gemessen und nicht geschätzt wird.
//
// Braucht PAGESPEED_API_KEY (kostenlos, Google Cloud). Ohne Schlüssel lässt
// Google keine einzige Abfrage zu; dann steht im Ergebnis "nicht gemessen"
// mit Grund, statt dass eine Zahl erfunden wird.

export interface PageSpeedResult {
  measured: true
  strategy: 'mobile'
  /** Lighthouse-Kategorien, 0–100. */
  performance: number | null
  seo: number | null
  accessibility: number | null
  bestPractices: number | null
  /** Labormesswerte (simuliertes Mittelklasse-Handy). */
  lcpMs: number | null
  cls: number | null
  tbtMs: number | null
  /** Felddaten echter Besuche — null, wenn Google zu wenige kennt. */
  field: { category: string; lcpMs: number | null; inpMs: number | null; cls: number | null } | null
}

export type PageSpeedOutcome = PageSpeedResult | { measured: false; reason: string }

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

function category(lr: Record<string, any>, key: string): number | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const score = lr?.categories?.[key]?.score
  return typeof score === 'number' ? Math.round(score * 100) : null
}

function audit(lr: Record<string, any>, key: string): number | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const v = lr?.audits?.[key]?.numericValue
  return typeof v === 'number' ? v : null
}

export async function measurePageSpeed(url: string): Promise<PageSpeedOutcome> {
  const key = process.env.PAGESPEED_API_KEY
  if (!key) return { measured: false, reason: 'Kein PageSpeed-Schlüssel eingerichtet' }

  const params = new URLSearchParams({ url, strategy: 'mobile', locale: 'de', key })
  for (const c of ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES']) params.append('category', c)

  try {
    // Lighthouse braucht für schwere Seiten bis gegen eine Minute.
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(75_000) })
    const data = await res.json()
    if (!res.ok || data.error) {
      return { measured: false, reason: `Google PageSpeed: ${data?.error?.message?.slice(0, 160) ?? `Status ${res.status}`}` }
    }
    const lr = data.lighthouseResult
    const le = data.loadingExperience
    const m = le?.metrics ?? {}
    const field = le?.overall_category && le.overall_category !== 'NONE'
      ? {
          category: le.overall_category as string,
          lcpMs: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          inpMs: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          // Google liefert CLS mal 100
          cls: typeof m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === 'number' ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
        }
      : null
    return {
      measured: true,
      strategy: 'mobile',
      performance: category(lr, 'performance'),
      seo: category(lr, 'seo'),
      accessibility: category(lr, 'accessibility'),
      bestPractices: category(lr, 'best-practices'),
      lcpMs: audit(lr, 'largest-contentful-paint'),
      cls: audit(lr, 'cumulative-layout-shift'),
      tbtMs: audit(lr, 'total-blocking-time'),
      field,
    }
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'TimeoutError'
    return { measured: false, reason: timeout ? 'Google PageSpeed hat nicht rechtzeitig geantwortet' : 'Google PageSpeed nicht erreichbar' }
  }
}
