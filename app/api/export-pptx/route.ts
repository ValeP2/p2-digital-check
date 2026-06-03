import { NextRequest } from 'next/server'
import { generatePptx } from '@/lib/generatePptx'

export const maxDuration = 30

interface Scores {
  positionierung: number; angebot: number; zielgruppe: number; vertrauen: number
  conversion: number; seo: number; navigation: number; sprache: number
  technik: number; externe_sichtbarkeit: number; gesamt: number
}

export async function POST(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { report, scores, url } = await req.json() as { report: string; scores: Scores; url: string }
    if (!report || !scores) return new Response('Fehlende Daten', { status: 400 })

    const { buffer, filename } = await generatePptx(report, scores, url)

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
