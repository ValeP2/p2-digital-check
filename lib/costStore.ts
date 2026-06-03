import { Redis } from '@upstash/redis'

// Findet die Upstash-Zugangsdaten egal unter welchem Prefix Vercel sie anlegt
function findRedis(): Redis | null {
  const env = process.env
  const urlKey = Object.keys(env).find(k => /REST_API_URL$|REDIS_REST_URL$|KV_REST_API_URL$/.test(k) && env[k]?.startsWith('https'))
  const tokenKey = Object.keys(env).find(k => /REST_API_TOKEN$|REDIS_REST_TOKEN$/.test(k) && env[k])
  if (urlKey && tokenKey) {
    return new Redis({ url: env[urlKey]!, token: env[tokenKey]! })
  }
  return null
}

const redis = findRedis()

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
