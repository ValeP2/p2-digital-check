import Link from 'next/link'
import AppShell from '@/app/components/AppShell'
import { ScoreDashboard, MarkdownRenderer, ExportButton, type Scores } from '@/app/components/ReportView'
import { Card } from '@/app/components/ui'
import { getHistory } from '@/lib/checkStore'
import { getActiveUserFromCookies } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Archiv: Analysen aus dem alten Digital Check (Version 1, bis Oktober 2026).
// Sie liegen nur im Verlauf des jeweiligen Users und werden unverändert in
// ihrer ursprünglichen Darstellung gezeigt — Skala 1–10, Markdown-Bericht.

interface LegacyEntry { id: string; url: string; companyName: string; date: string; scores: Scores; report: string }

export default async function ArchivPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getActiveUserFromCookies()
  const entry = user
    ? (await getHistory(user.email)).find(e => (e as { id?: string; version?: number }).id === id && (e as { version?: number }).version !== 2) as LegacyEntry | undefined
    : undefined

  return (
    <AppShell>
      {entry ? (
        <>
          <Card className="p-5 mb-5 !bg-[#FFFBEB]">
            <p className="text-[13px] text-foreground/80 leading-relaxed">
              <strong>Archiv:</strong> Diese Analyse stammt aus dem alten Digital Check vom {new Date(entry.date).toLocaleDateString('de-CH')} (Skala 1–10, Scores vom Modell frei gesetzt). Sie ist mit neuen Checks nicht vergleichbar.{' '}
              <Link href={`/?url=${encodeURIComponent(entry.url)}`} className="font-medium text-primary hover:underline">Neu prüfen</Link>
            </p>
          </Card>
          <div className="rounded-xl p-6 md:p-10" style={{ background: '#293263', color: '#EBEACC' }}>
            <h1 className="text-2xl font-bold">{entry.companyName}</h1>
            <p className="text-sm opacity-50 mb-6">{entry.url}</p>
            <ScoreDashboard scores={entry.scores} />
            <MarkdownRenderer content={entry.report} scores={entry.scores} />
            <div className="mt-8"><ExportButton report={entry.report} scores={entry.scores} inputUrl={entry.url} /></div>
          </div>
        </>
      ) : (
        <Card className="p-8 max-w-[560px]">
          <h1 className="text-[18px] font-semibold">Analyse nicht gefunden</h1>
          <p className="text-[14px] text-muted-foreground mt-2">Sie ist nicht (mehr) in deinem Verlauf.</p>
        </Card>
      )}
    </AppShell>
  )
}
