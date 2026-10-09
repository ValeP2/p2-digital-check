import { CheckCircle2, CircleDashed, XCircle, HelpCircle, MinusCircle, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import type { StoredCheck } from '@/lib/checkStore'
import { DIMENSION_BY_KEY } from '@/lib/check/criteria'
import { scoreBand } from '@/lib/check/score'
import type { CriterionResult, DimensionResult, Massnahme, Urteil } from '@/lib/check/types'
import { BasisBadge, Card, Pill, ScoreBar, ScoreRing, SectionTitle, cn, scoreColor } from '../ui'
import { ScoreSpider } from './ScoreSpider'

// ── Der Bericht ──────────────────────────────────────────────────
//
// EINE Darstellung für App und öffentlichen Link. Vorher gab es drei: die
// Hauptseite, die Teilen-Seite (ReportView) und den PPT-Export — jede mit
// eigenem Markdown-Leser, und jede ging anders mit Abweichungen um.
//
// Alles kommt strukturiert aus dem Check; nichts wird aus Text herausgelesen.

const URTEIL: Record<Urteil, { label: string; icon: typeof CheckCircle2; color: string }> = {
  erfuellt: { label: 'Erfüllt', icon: CheckCircle2, color: '#10b981' },
  teilweise: { label: 'Teilweise', icon: CircleDashed, color: '#f59e0b' },
  nicht_erfuellt: { label: 'Nicht erfüllt', icon: XCircle, color: '#FF6B8A' },
  nicht_pruefbar: { label: 'Nicht prüfbar', icon: HelpCircle, color: '#9CA3AF' },
  nicht_relevant: { label: 'Nicht relevant', icon: MinusCircle, color: '#9CA3AF' },
}

const QUELLE_LABEL = { messung: 'gemessen', inhalt: 'Seiteninhalt', recherche: 'Recherche' } as const

const LEVEL_COLOR = { Hoch: '#FF6B8A', Mittel: '#f59e0b', Tief: '#6B7280' } as const

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function Delta({ now, before }: { now: number | null; before: number | null | undefined }) {
  if (now === null || before === null || before === undefined) return null
  const d = now - before
  const Icon = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums',
      d > 0 ? 'text-good' : d < 0 ? 'text-bad' : 'text-muted-foreground')}>
      <Icon className="w-3.5 h-3.5" /> {d > 0 ? '+' : ''}{d === 0 ? '±0' : d}
    </span>
  )
}

function CriterionRow({ k }: { k: CriterionResult }) {
  const u = URTEIL[k.urteil]
  const Icon = u.icon
  return (
    <li className="flex gap-3 py-2.5 border-t border-black/5 first:border-t-0">
      <Icon className="w-[18px] h-[18px] mt-[1px] shrink-0" style={{ color: u.color }} aria-label={u.label} />
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-foreground leading-snug">
          {k.label}
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">{QUELLE_LABEL[k.quelle]}{k.gewicht > 1 ? ` · Gewicht ${k.gewicht}` : ''}</span>
        </p>
        <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">{k.beleg}</p>
      </div>
    </li>
  )
}

function DimensionCard({ d, before }: { d: DimensionResult; before?: DimensionResult }) {
  const counted = d.kriterien.filter(k => ['erfuellt', 'teilweise', 'nicht_erfuellt'].includes(k.urteil))
  const erfuellt = counted.filter(k => k.urteil === 'erfuellt').length
  return (
    <Card className="p-6 break-inside-avoid">
      <div className="flex items-start gap-4">
        <ScoreRing score={d.score} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[16px] font-semibold text-foreground">{d.label}</h3>
            <Delta now={d.score} before={before?.score} />
          </div>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">{DIMENSION_BY_KEY[d.key].frage}</p>
          <div className="mt-2"><BasisBadge basis={d.basis} /></div>
        </div>
      </div>
      {d.befund && <p className="text-[14px] text-foreground/85 leading-relaxed mt-4">{d.befund}</p>}
      <details className="group mt-4">
        <summary className="cursor-pointer list-none text-[13px] font-medium text-primary hover:underline select-none">
          {counted.length > 0 ? `${erfuellt} von ${counted.length} Prüfpunkten erfüllt` : 'Prüfpunkte'}
          <span className="text-muted-foreground font-normal group-open:hidden"> · anzeigen</span>
          <span className="text-muted-foreground font-normal hidden group-open:inline"> · ausblenden</span>
        </summary>
        <ul className="mt-2">{d.kriterien.map(k => <CriterionRow key={k.id} k={k} />)}</ul>
      </details>
    </Card>
  )
}

function MassnahmeCard({ m, nr }: { m: Massnahme; nr: number }) {
  return (
    <Card className="p-5 break-inside-avoid">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-xs bg-[#F5F5F7] text-[13px] font-semibold text-muted-foreground flex items-center justify-center shrink-0 tabular-nums">{nr}</span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[15px] font-semibold text-foreground leading-snug">{m.titel}</h4>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Pill color={LEVEL_COLOR[m.prioritaet]}>Priorität {m.prioritaet}</Pill>
            <Pill>Wirkung {m.wirkung}</Pill>
            <Pill>{DIMENSION_BY_KEY[m.dimension]?.label ?? m.dimension}</Pill>
          </div>
          <p className="text-[13.5px] text-foreground/80 leading-relaxed mt-3">{m.beschreibung}</p>
          {m.schritte.length > 0 && (
            <ol className="mt-3 space-y-1.5">
              {m.schritte.map((s, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-muted-foreground leading-relaxed">
                  <span className="text-primary font-semibold tabular-nums">{i + 1}.</span><span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  )
}

function Messwert({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2.5 border-t border-black/5 first:border-t-0 flex items-baseline justify-between gap-4">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground text-right" title={hint}>{value}</span>
    </div>
  )
}

export function CheckReport({ check, previous, internal }: { check: StoredCheck; previous?: StoredCheck | null; internal: boolean }) {
  const r = check.result
  const p = previous?.result
  const vergleichbar = !!p && p.meta.kalibrierung === r.meta.kalibrierung
  const band = r.overall !== null ? scoreBand(r.overall) : null
  const ps = r.messungen.pagespeed
  const horizonte = (['Sofort', 'Kurzfristig', 'Strategisch'] as const)
    .map(h => ({ h, items: r.massnahmen.filter(m => m.zeithorizont === h) }))
    .filter(g => g.items.length > 0)
  let nr = 0

  return (
    <div className="space-y-10">
      {/* ── Kopf ── */}
      <Card className="p-7 md:p-9 fade-in-up">
        <div className="flex flex-col md:flex-row md:items-start gap-7">
          <div className="flex items-center gap-5 shrink-0">
            <ScoreRing score={r.overall} size="lg" />
            <div>
              {band && <p className="text-[15px] font-semibold" style={{ color: band.color }}>{band.label}</p>}
              <p className="text-[13px] text-muted-foreground">von 100 Punkten</p>
              {vergleichbar && <div className="mt-1"><Delta now={r.overall} before={p!.overall} /> <span className="text-[12px] text-muted-foreground">seit {formatDate(p!.checkedAt)}</span></div>}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] md:text-[30px] font-semibold text-foreground leading-tight">{r.firma.name}</h1>
            <a href={r.finalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mt-1">
              {host(r.finalUrl)} <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-[13px] text-muted-foreground"> · Digital Check vom {formatDate(r.checkedAt)}</span>
            {(r.firma.branche || r.firma.angebot) && (
              <p className="text-[14px] text-foreground/80 mt-4 leading-relaxed">
                {r.firma.branche && <strong className="font-semibold text-foreground">{r.firma.branche}. </strong>}
                {r.firma.angebot} {r.firma.zielgruppe && <>Zielgruppe: {r.firma.zielgruppe}.</>} {r.firma.region && <>Region: {r.firma.region}.</>}
              </p>
            )}
            {r.fazit && <p className="text-[15px] text-foreground leading-relaxed mt-4">{r.fazit}</p>}
          </div>
        </div>
        {r.overallRechnung && (
          <details className="mt-6 text-[12.5px] text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">Wie die Zahl entsteht</summary>
            <p className="mt-2 leading-relaxed">
              Jeder Bereich wird an festen Prüfpunkten gemessen oder beurteilt (erfüllt = 1, teilweise = ½, nicht erfüllt = 0, gewichtet).
              Nicht prüfbare und nicht relevante Punkte zählen nicht. Der Gesamtwert ist das gewichtete Mittel der Bereiche. {r.overallRechnung}.
            </p>
          </details>
        )}
        {p && !vergleichbar && (
          <p className="mt-4 text-[12.5px] text-muted-foreground">Der Vorgängercheck vom {formatDate(p.checkedAt)} wurde nach einem anderen Kriterienstand bewertet — die Zahlen sind deshalb nicht direkt vergleichbar.</p>
        )}
      </Card>

      {/* ── Überblick ── */}
      <div className="grid xl:grid-cols-2 gap-6">
        <Card className="p-6 flex flex-col items-center justify-center">
          <ScoreSpider
            color="#7B6FEF"
            werte={r.dimensionen.filter(d => d.score !== null).map(d => ({
              label: d.label,
              value: d.score!,
              previous: vergleichbar ? p!.dimensionen.find(x => x.key === d.key)?.score ?? null : null,
              erklaerung: DIMENSION_BY_KEY[d.key].frage,
            }))}
          />
        </Card>
        <Card className="p-6">
          <h2 className="text-[16px] font-semibold text-foreground mb-3">Was bereits trägt</h2>
          <ul className="space-y-2.5">
            {r.staerken.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[14px] text-foreground/85 leading-relaxed">
                <CheckCircle2 className="w-[18px] h-[18px] mt-[2px] shrink-0 text-good" />{s}
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2.5">
            {r.dimensionen.map(d => (
              <div key={d.key} className="flex items-center gap-3">
                <span className="text-[12.5px] text-muted-foreground w-[140px] shrink-0 truncate">{d.label}</span>
                <ScoreBar score={d.score} className="flex-1" />
                <span className="text-[12.5px] font-semibold tabular-nums w-7 text-right" style={{ color: scoreColor(d.score) }}>{d.score ?? '–'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Bereiche ── */}
      <section>
        <SectionTitle hint="Zu jedem Bereich: was trägt, wo die Lücke liegt, und die einzelnen Prüfpunkte mit Fundstelle.">Die zehn Bereiche im Detail</SectionTitle>
        <div className="grid xl:grid-cols-2 gap-5">
          {r.dimensionen.map(d => (
            <DimensionCard key={d.key} d={d} before={vergleichbar ? p!.dimensionen.find(x => x.key === d.key) : undefined} />
          ))}
        </div>
      </section>

      {/* ── Massnahmen ── */}
      {horizonte.length > 0 && (
        <section className="print-break">
          <SectionTitle hint="Abgeleitet aus den nicht oder nur teilweise erfüllten Prüfpunkten — Sofortmassnahmen sind in Tagen erledigt, strategische brauchen Konzeptarbeit.">Empfohlene Massnahmen</SectionTitle>
          <div className="space-y-8">
            {horizonte.map(g => (
              <div key={g.h}>
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">{g.h}</h3>
                <div className="grid xl:grid-cols-2 gap-4">
                  {g.items.map(m => <MassnahmeCard key={m.titel} m={m} nr={++nr} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Textbeispiele ── */}
      {r.textbeispiele.length > 0 && (
        <section>
          <SectionTitle hint="Echte Stellen der Website mit einem Vorschlag.">Texte: vorher und nachher</SectionTitle>
          <div className="space-y-4">
            {r.textbeispiele.map((t, i) => (
              <Card key={i} className="p-6 break-inside-avoid">
                <p className="text-[12px] text-muted-foreground mb-3">{t.seite}</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[#FFF1F4] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-bad mb-1.5">Heute</p>
                    <p className="text-[14px] text-foreground/85 leading-relaxed">«{t.vorher}»</p>
                  </div>
                  <div className="rounded-lg bg-[#ECFDF5] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-good mb-1.5">Vorschlag</p>
                    <p className="text-[14px] text-foreground/85 leading-relaxed">«{t.nachher}»</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Messwerte ── */}
      <section>
        <SectionTitle hint="Was direkt gemessen wurde — Grundlage der als «gemessen» markierten Prüfpunkte.">Messwerte</SectionTitle>
        <div className="grid md:grid-cols-2 gap-5">
          <Card className="p-6">
            <h3 className="text-[14px] font-semibold mb-2">Ladezeit und Google-Prüfung (Mobil)</h3>
            {ps.measured ? (
              <div>
                <Messwert label="Leistung" value={`${ps.performance ?? '–'} / 100`} />
                <Messwert label="SEO" value={`${ps.seo ?? '–'} / 100`} />
                <Messwert label="Barrierefreiheit" value={`${ps.accessibility ?? '–'} / 100`} />
                <Messwert label="Best Practices" value={`${ps.bestPractices ?? '–'} / 100`} />
                <Messwert label="Hauptinhalt sichtbar (LCP)" value={ps.lcpMs !== null ? `${(ps.lcpMs / 1000).toFixed(1)} s` : '–'} hint="Labormessung" />
                {ps.field && <Messwert label="Echte Besuche (Chrome)" value={ps.field.category === 'FAST' ? 'schnell' : ps.field.category === 'AVERAGE' ? 'mittel' : 'langsam'} />}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground leading-relaxed">Nicht gemessen: {ps.reason}. Die betroffenen Prüfpunkte zählen nicht.</p>
            )}
          </Card>
          <Card className="p-6">
            <h3 className="text-[14px] font-semibold mb-2">Technik und Betreiber</h3>
            <Messwert label="System" value={r.messungen.plattform.name ?? 'nicht erkannt'} hint={r.messungen.plattform.evidence ?? undefined} />
            <Messwert label="HTTPS" value={r.messungen.technik.certificateInvalid ? 'Zertifikat ungültig' : r.messungen.technik.https ? 'ja' : 'nein'} />
            <Messwert label="Betreiber" value={[r.messungen.impressum.entity, r.messungen.impressum.address].filter(Boolean).join(', ') || 'nicht gefunden'} />
            <Messwert label="Social Media verlinkt" value={r.messungen.socialProfiles.length ? r.messungen.socialProfiles.map(s => s.platform).join(', ') : 'keine'} />
            <Messwert label="Gelesene Seiten" value={`${r.messungen.seiten.filter(s => s.lesbar).length} von ${r.messungen.seiten.length}`} />
          </Card>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer select-none text-[13px] text-muted-foreground hover:text-foreground">Geprüfte Seiten anzeigen</summary>
          <Card className="p-5 mt-3">
            <ul className="text-[12.5px] space-y-1">
              {r.messungen.seiten.map(s => (
                <li key={s.url} className="flex justify-between gap-4">
                  <span className="truncate text-foreground/80">{s.url.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                  <span className={cn('shrink-0 tabular-nums', s.lesbar ? 'text-muted-foreground' : 'text-warn')}>{s.lesbar ? `${s.woerter} Wörter` : `nicht gelesen (${s.status})`}</span>
                </li>
              ))}
            </ul>
          </Card>
        </details>
        {r.recherche && (
          <details className="mt-3">
            <summary className="cursor-pointer select-none text-[13px] text-muted-foreground hover:text-foreground">Recherche zur externen Sichtbarkeit anzeigen (Einschätzung, {r.recherche.suchen} Websuchen)</summary>
            <Card className="p-5 mt-3">
              <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{r.recherche.text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '')}</p>
            </Card>
          </details>
        )}
      </section>

      <p className="text-[11.5px] text-muted-foreground/80 text-center leading-relaxed">
        P2 Digital Check · Kriterienstand {r.meta.kalibrierung}
        {internal && <> · {r.meta.model} · {(r.meta.durationMs / 1000).toFixed(0)} s · CHF {r.meta.costChf.toFixed(2)}</>}
      </p>
    </div>
  )
}
