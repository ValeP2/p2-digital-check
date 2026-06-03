import { NextRequest, NextResponse } from 'next/server'
import { getTotals } from '@/lib/costStore'

export async function GET(req: NextRequest) {
  const session = req.cookies.get('p2-session')?.value
  if (session !== process.env.APP_PASSWORD) {
    return new Response('Unauthorized', { status: 401 })
  }
  const totals = await getTotals()
  return NextResponse.json(totals ?? { chf: 0, count: 0, unavailable: true })
}
