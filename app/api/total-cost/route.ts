import { NextRequest, NextResponse } from 'next/server'
import { getTotals } from '@/lib/costStore'
import { getSessionUser } from '@/lib/session'

export async function GET(req: NextRequest) {
  if (!getSessionUser(req)) {
    return new Response('Unauthorized', { status: 401 })
  }
  const totals = await getTotals()
  return NextResponse.json(totals ?? { chf: 0, count: 0, unavailable: true })
}
