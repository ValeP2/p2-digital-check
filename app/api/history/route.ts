import { NextRequest, NextResponse } from 'next/server'
import { getActiveUser } from '@/lib/session'
import { getHistory, removeFromHistory } from '@/lib/checkStore'

// Verlauf des angemeldeten Users — nur noch lesen und entfernen. Schreiben
// tut ausschliesslich der Server beim Speichern eines Checks; vorher schrieb
// der Browser die ganze Liste selbst.

export interface HistoryItem {
  version: 1 | 2
  id: string
  url: string
  companyName: string
  date: string
  /** v2: 0–100. v1: alter Gesamtwert 1–10. */
  score: number | null
}

function summarize(raw: unknown): HistoryItem | null {
  const e = raw as Record<string, unknown>
  if (!e || typeof e.id !== 'string') return null
  if (e.version === 2) {
    return { version: 2, id: e.id, url: String(e.url ?? ''), companyName: String(e.companyName ?? ''), date: String(e.date ?? ''), score: (e.overall as number | null) ?? null }
  }
  // Altes Format (Digital Check 1.x): ganzer Bericht im Eintrag, Skala 1–10
  const scores = e.scores as { gesamt?: number } | undefined
  return { version: 1, id: e.id, url: String(e.url ?? ''), companyName: String(e.companyName ?? ''), date: String(e.date ?? ''), score: scores?.gesamt ?? null }
}

export async function GET(req: NextRequest) {
  const user = await getActiveUser(req)
  if (!user) return NextResponse.json({ items: [] }, { status: 401 })
  const items = (await getHistory(user.email)).map(summarize).filter((x): x is HistoryItem => x !== null)
  return NextResponse.json({ items })
}

export async function DELETE(req: NextRequest) {
  const user = await getActiveUser(req)
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  await removeFromHistory(user.email, id)
  return NextResponse.json({ ok: true })
}
