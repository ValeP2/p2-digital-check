import { Redis } from '@upstash/redis'

// Findet die Upstash-Zugangsdaten, egal unter welchem Präfix Vercel sie anlegt.
// Vorher stand diese Funktion dreimal identisch im Code.
function findRedis(): Redis | null {
  const env = process.env
  const urlKey = Object.keys(env).find(k => /REST_API_URL$|REDIS_REST_URL$|KV_REST_API_URL$/.test(k) && env[k]?.startsWith('https'))
  const tokenKey = Object.keys(env).find(k => /REST_API_TOKEN$|REDIS_REST_TOKEN$/.test(k) && env[k])
  if (urlKey && tokenKey) return new Redis({ url: env[urlKey]!, token: env[tokenKey]! })
  return null
}

export const redis = findRedis()
