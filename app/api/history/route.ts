import { NextRequest, NextResponse } from 'next/server'
import { getUserHistory, saveUserHistory } from '@/lib/userStore'
import { getSessionUser } from '@/lib/session'

function getUserEmail(req: NextRequest): string {
  return getSessionUser(req)?.email || ''
}

export async function GET(req: NextRequest) {
  const email = getUserEmail(req)
  if (!email) return NextResponse.json({ history: '[]' })
  const history = await getUserHistory(email)
  return NextResponse.json({ history })
}

export async function POST(req: NextRequest) {
  const email = getUserEmail(req)
  if (!email) return NextResponse.json({ ok: false }, { status: 401 })
  const { history } = await req.json() as { history: string }
  await saveUserHistory(email, history)
  return NextResponse.json({ ok: true })
}
