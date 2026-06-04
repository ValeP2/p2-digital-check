import { NextRequest } from 'next/server'
import { getAnalysis } from '@/lib/analysisStore'
import { generatePptx } from '@/lib/generatePptx'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return new Response('Keine ID', { status: 400 })

  const analysis = await getAnalysis(id)
  if (!analysis) return new Response('Analyse nicht gefunden', { status: 404 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { buffer, filename } = await generatePptx(analysis.report, analysis.scores as any, analysis.url)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PPT-Export fehlgeschlagen:', err)
    return new Response('Export fehlgeschlagen', { status: 500 })
  }
}
