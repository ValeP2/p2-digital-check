'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import AppShell, { refreshHistory } from './components/AppShell'
import { Card, FELD, KNOPF, KNOPF_LEISE, cn } from './components/ui'
import type { HistoryItem } from './api/history/route'

// ── Neuer Check ──────────────────────────────────────────────────
//
// Ersetzt die alte Hauptseite (1172 Zeilen in einer Datei: Eingabe, Bericht,
// Archiv, Recheck, Export). Hier steht nur noch der Start eines Checks; der
// Bericht hat eine eigene Adresse (/check/<id>) und ist damit verlinkbar.

const STUFEN = [
  { key: 'crawl', label: 'Website lesen', match: /Website wird gelesen|Gelesen|Nicht erreichbar/ },
  { key: 'mess', label: 'Ladezeit messen', match: /Ladezeit/ },
  { key: 'recherche', label: 'Externe Sichtbarkeit recherchieren', match: /recherchiert/ },
  { key: 'analyse', label: 'Prüfpunkte beurteilen', match: /Analyse mit|Bewertet|Firmenprofil|überlastet/ },
  { key: 'bericht', label: 'Massnahmen ableiten', match: /Stärken|Massnahmen|Textbeispiele|Fazit/ },
] as const

function normalize(url: string): string {
  const t = url.trim()
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function host(url: string): string {
  try { return new URL(normalize(url)).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}

type Phase = { state: 'idle' } | { state: 'running'; log: string[]; stufe: number; start: number } | { state: 'error'; message: string }

function Runner() {
  const router = useRouter()
  const params = useSearchParams()
  const [url, setUrl] = useState(params.get('url') ?? '')
  const [vorher, setVorher] = useState<string | null>(params.get('vorher'))
  const [beispiel, setBeispiel] = useState(false)
  const [phase, setPhase] = useState<Phase>({ state: 'idle' })
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [now, setNow] = useState(Date.now())
  const started = useRef(false)

  useEffect(() => {
    fetch('/api/history').then(r => r.ok ? r.json() : { items: [] }).then(d => setHistory(d.items ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (phase.state !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase.state])

  // Nachprüfung aus dem Bericht heraus (?url=…&vorher=…): gleich starten.
  useEffect(() => {
    if (params.get('url') && params.get('vorher') && !started.current) {
      started.current = true
      start(params.get('url')!, params.get('vorher'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bekannt = url.trim() && !vorher
    ? history.find(h => h.version === 2 && host(h.url) === host(url))
    : undefined

  async function start(target: string, previousId: string | null) {
    if (!target.trim()) return
    setPhase({ state: 'running', log: [], stufe: 0, start: Date.now() })
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.trim(), previousId, beispiel }),
      })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Fehler ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const raw of events) {
          const event = raw.match(/^event: (.+)$/m)?.[1]
          const data = raw.match(/^data: (.+)$/m)?.[1]
          if (!event || !data) continue
          const payload = JSON.parse(data)
          if (event === 'progress') {
            setPhase(p => {
              if (p.state !== 'running') return p
              const idx = STUFEN.findIndex(s => s.match.test(payload))
              return { ...p, log: [...p.log, payload].slice(-6), stufe: Math.max(p.stufe, idx) }
            })
          } else if (event === 'result') {
            refreshHistory()
            router.push(`/check/${payload.id}`)
            return
          } else if (event === 'error') {
            setPhase({ state: 'error', message: payload })
            return
          }
        }
      }
      setPhase({ state: 'error', message: 'Die Verbindung brach ab, bevor der Check fertig war. Bitte erneut versuchen.' })
    } catch (e) {
      setPhase({ state: 'error', message: e instanceof Error ? e.message : 'Unbekannter Fehler' })
    }
  }

  const running = phase.state === 'running'
  const sekunden = running ? Math.max(0, Math.round((now - phase.start) / 1000)) : 0

  return (
    <div className="max-w-[720px]">
      <h1 className="text-[28px] font-semibold text-foreground">{vorher ? 'Nachprüfung' : 'Neuer Digital Check'}</h1>
      <p className="text-[14px] text-muted-foreground mt-1.5 leading-relaxed">
        {vorher
          ? 'Dieselbe Website wird nach denselben Prüfpunkten neu bewertet und mit dem früheren Check verglichen.'
          : 'Website-Adresse eingeben. Der Check liest die Seiten, misst Technik und Ladezeit, recherchiert die externe Sichtbarkeit und beurteilt 49 Prüfpunkte.'}
      </p>

      <Card className="p-6 mt-7">
        <form onSubmit={e => { e.preventDefault(); start(url, vorher) }} className="flex flex-col sm:flex-row gap-3">
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setVorher(null) }}
            placeholder="www.beispiel.ch"
            aria-label="Website-Adresse"
            disabled={running}
            autoFocus
            className={cn(FELD, 'sm:flex-1')}
          />
          <button type="submit" disabled={running || !url.trim()} className={KNOPF}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {vorher ? 'Nachprüfen' : 'Check starten'}
          </button>
        </form>

        {bekannt && !running && (
          <div className="mt-4 rounded-lg bg-primary/8 px-4 py-3 text-[13px] text-foreground/85 leading-relaxed">
            Für {host(url)} gibt es schon einen Check vom {new Date(bekannt.date).toLocaleDateString('de-CH')} ({bekannt.score ?? '–'} Punkte).{' '}
            <button onClick={() => setVorher(bekannt.id)} className="font-medium text-primary hover:underline">Als Nachprüfung mit Vergleich starten</button>
            {' · '}
            <a href={`/check/${bekannt.id}`} className="font-medium text-primary hover:underline">Bestehenden ansehen</a>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && !running && (
          <label className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
            <input type="checkbox" checked={beispiel} onChange={e => setBeispiel(e.target.checked)} />
            Beispiel-Modus: echter Crawl, KI-Texte sind Beispieldaten (nur lokal, kostet nichts)
          </label>
        )}
      </Card>

      {running && (
        <Card className="p-6 mt-5 fade-in-up">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-[15px] font-semibold analyse-verlauf">Check läuft</p>
            <p className="text-[12px] text-muted-foreground tabular-nums">{Math.floor(sekunden / 60)}:{String(sekunden % 60).padStart(2, '0')}</p>
          </div>
          <ol className="mt-4 space-y-2.5">
            {STUFEN.map((s, i) => {
              const done = i < phase.stufe
              const active = i === phase.stufe
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    done ? 'bg-good text-white' : active ? 'border-2 border-primary' : 'border-2 border-black/10')}>
                    {done && <Check className="w-3 h-3" strokeWidth={3} />}
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                  </span>
                  <span className={cn('text-[14px]', done ? 'text-muted-foreground' : active ? 'text-foreground font-medium' : 'text-muted-foreground/70')}>{s.label}</span>
                </li>
              )
            })}
          </ol>
          {phase.log.length > 0 && (
            <p className="mt-5 text-[12px] text-muted-foreground truncate" aria-live="polite">{phase.log[phase.log.length - 1]}</p>
          )}
          <p className="mt-2 text-[12px] text-muted-foreground/80">Das Fenster kann offen bleiben — der Bericht erscheint automatisch.</p>
        </Card>
      )}

      {phase.state === 'error' && (
        <Card className="p-6 mt-5 border-l-4 !border-l-bad">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-bad shrink-0 mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">Der Check konnte nicht abgeschlossen werden</p>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{phase.message}</p>
              <button onClick={() => start(url, vorher)} className={cn(KNOPF_LEISE, 'mt-4')}><RotateCcw className="w-3.5 h-3.5" /> Erneut versuchen</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <AppShell>
      <Suspense fallback={null}><Runner /></Suspense>
    </AppShell>
  )
}
