import { getAnalysis } from '@/lib/analysisStore'
import { ScoreDashboard, MarkdownRenderer, Scores } from '@/app/components/ReportView'
import LogoP2 from '@/app/components/LogoP2'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const analysis = await getAnalysis(id)

  if (!analysis) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#293263', color: '#EBEACC' }}>
        <LogoP2 height={32} />
        <p className="mt-6 text-base" style={{ color: 'rgba(235,234,204,0.6)' }}>Analyse nicht gefunden oder abgelaufen.</p>
      </div>
    )
  }

  const scores = analysis.scores as unknown as Scores

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#293263', color: '#EBEACC' }}>
      <header className="px-8 pt-7 pb-5 flex items-center justify-between">
        <LogoP2 height={30} />
        <span className="text-sm" style={{ color: 'rgba(235,234,204,0.4)' }}>Digitalcheck</span>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-24">
        <div className="text-center pt-8 pb-10">
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#EBEACC' }}>{analysis.companyName}</h1>
          <p className="text-sm" style={{ color: 'rgba(235,234,204,0.4)' }}>
            {analysis.url} · {new Date(analysis.date).toLocaleDateString('de-CH')}
          </p>
        </div>

        <ScoreDashboard scores={scores} />
        <div className="pb-8">
          <MarkdownRenderer content={analysis.report} scores={scores} />
        </div>
      </main>

      <footer className="text-center pb-8 text-sm" style={{ color: 'rgba(235,234,204,0.18)' }}>
        P2/ Kommunikation AG · digitalcheck.p-zwei.ch
      </footer>
    </div>
  )
}
