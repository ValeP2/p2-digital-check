import { Redis } from '@upstash/redis'

function findRedis(): Redis | null {
  const env = process.env
  const urlKey = Object.keys(env).find(k => /REST_API_URL$|REDIS_REST_URL$|KV_REST_API_URL$/.test(k) && env[k]?.startsWith('https'))
  const tokenKey = Object.keys(env).find(k => /REST_API_TOKEN$|REDIS_REST_TOKEN$/.test(k) && env[k])
  if (urlKey && tokenKey) return new Redis({ url: env[urlKey]!, token: env[tokenKey]! })
  return null
}

const redis = findRedis()

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
