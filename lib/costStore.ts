import { Redis } from '@upstash/redis'

// Graceful: nur aktiv wenn Upstash-Env-Variablen gesetzt sind
const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
const redis = hasRedis ? Redis.fromEnv() : null

const TOTAL_KEY = 'p2dc:total_cost_chf'
const COUNT_KEY = 'p2dc:total_analyses'

export async function addCost(chf: number): Promise<void> {
  if (!redis) return
  try {
    await Promise.all([
      redis.incrbyfloat(TOTAL_KEY, chf),
      redis.incr(COUNT_KEY),
    ])
  } catch { /* still ok */ }
}

export async function getTotals(): Promise<{ chf: number; count: number } | null> {
  if (!redis) return null
  try {
    const [chf, count] = await Promise.all([
      redis.get<number>(TOTAL_KEY),
      redis.get<number>(COUNT_KEY),
    ])
    return { chf: Number(chf ?? 0), count: Number(count ?? 0) }
  } catch {
    return null
  }
}
