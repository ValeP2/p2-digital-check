import { redis } from './redis'

export interface StoredAnalysis {
  id: string
  url: string
  companyName: string
  date: string
  scores: Record<string, number>
  report: string
  cost: { chf: string } | null
}

// 90 Tage Aufbewahrung
const TTL_SECONDS = 60 * 60 * 24 * 90

export async function saveAnalysis(a: StoredAnalysis): Promise<boolean> {
  if (!redis) return false
  try {
    await redis.set(`p2dc:analysis:${a.id}`, JSON.stringify(a), { ex: TTL_SECONDS })
    return true
  } catch {
    return false
  }
}

export async function getAnalysis(id: string): Promise<StoredAnalysis | null> {
  if (!redis) return null
  try {
    const raw = await redis.get<string | StoredAnalysis>(`p2dc:analysis:${id}`)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}
