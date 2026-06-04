import { getAnalysis } from '@/lib/analysisStore'
import { ScoreDashboard, MarkdownRenderer, ExportButton, Scores } from '@/app/components/ReportView'
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
  const report = analysis.report

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#293263', color: '#EBEACC', fontFamily: "Avenir Next, Avenir, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <header className="px-8 pt-7 pb-10 flex items-center justify-between sticky top-0 z-20"
        style={{ background: 'linear-gradient(to bottom, #293263 0%, #293263 45%, rgba(41,50,99,0.85) 70%, rgba(41,50,99,0) 100%)' }}>
        <LogoP2 height={30} />
        <span className="text-sm" style={{ color: 'rgba(235,234,204,0.4)' }}>
          {new Date(analysis.date).toLocaleDateString('de-CH')}
        </span>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-24">
        {/* Titel */}
        <div className="text-center pt-4 pb-10">
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#EBEACC' }}>{analysis.companyName}</h1>
          <p className="text-sm" style={{ color: 'rgba(235,234,204,0.4)' }}>{analysis.url}</p>
        </div>

        {/* Score Dashboard */}
        <ScoreDashboard scores={scores} />

        {/* Report */}
        <div className="pb-8">
          <MarkdownRenderer content={report} scores={scores} />
        </div>
      </main>

      {/* Footer mit PPT-Export */}
      <footer className="pb-10 px-8" style={{ color: 'rgba(235,234,204,0.18)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4 pt-6 mb-4"
          style={{ borderTop: '1px solid rgba(235,234,204,0.1)' }}>
          <p className="text-sm">P2/ Kommunikation AG · digitalcheck.p-zwei.ch</p>
          <ExportButton report={report} scores={scores} inputUrl={analysis.url} analysisId={id} />
        </div>
      </footer>
    </div>
  )
}
