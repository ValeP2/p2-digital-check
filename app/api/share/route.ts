import { NextRequest, NextResponse } from 'next/server'
import { saveAnalysis } from '@/lib/analysisStore'

export async function POST(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, url, companyName, date, scores, report } = await req.json()
  if (!id || !report) return NextResponse.json({ error: 'Fehlende Daten' }, { status: 400 })

  await saveAnalysis({ id, url, companyName, date, scores, report, cost: null })

  const origin = req.headers.get('x-forwarded-proto') && req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`
    : 'https://digitalcheck.p-zwei.ch'

  return NextResponse.json({ link: `${origin}/a/${id}` })
}
