import { Redis } from '@upstash/redis'

function findRedis(): Redis | null {
  const env = process.env
  const urlKey = Object.keys(env).find(k => /REST_API_URL$|REDIS_REST_URL$|KV_REST_API_URL$/.test(k) && env[k]?.startsWith('https'))
  const tokenKey = Object.keys(env).find(k => /REST_API_TOKEN$|REDIS_REST_TOKEN$/.test(k) && env[k])
  if (urlKey && tokenKey) return new Redis({ url: env[urlKey]!, token: env[tokenKey]! })
  return null
}

export const redis = findRedis()

const USERS_KEY = 'p2dc:users'

export interface User {
  email: string
  password: string
  name: string
  createdAt: string
  createdBy: string
  isAdmin: boolean
}

// Admin-Adressen (können immer inviten/entfernen)
export const ADMIN_EMAILS = ['vale@p-zwei.ch', 'andreas@p-zwei.ch']

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export function generatePassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function getAllUsers(): Promise<User[]> {
  if (!redis) return []
  try {
    const data = await redis.hgetall(USERS_KEY)
    if (!data) return []
    return Object.values(data).map(v => typeof v === 'string' ? JSON.parse(v) : v as User)
  } catch { return [] }
}

export async function getUser(email: string): Promise<User | null> {
  if (!redis) return null
  try {
    const raw = await redis.hget(USERS_KEY, email.toLowerCase())
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw as User
  } catch { return null }
}

export async function saveUser(user: User): Promise<void> {
  if (!redis) return
  await redis.hset(USERS_KEY, { [user.email.toLowerCase()]: JSON.stringify(user) })
}

export async function deleteUser(email: string): Promise<void> {
  if (!redis) return
  await redis.hdel(USERS_KEY, email.toLowerCase())
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  // Admins können sich mit APP_PASSWORD anmelden (Bootstrapping)
  if (isAdmin(email) && password === process.env.APP_PASSWORD) {
    return { email, password, name: email.split('@')[0], createdAt: '', createdBy: 'system', isAdmin: true }
  }
  const user = await getUser(email)
  if (!user) return null
  if (user.password !== password) return null
  return user
}

// History pro User
export async function getUserHistory(email: string): Promise<string> {
  if (!redis) return '[]'
  try {
    const data = await redis.get<string>(`p2dc:history:${email.toLowerCase()}`)
    return data ?? '[]'
  } catch { return '[]' }
}

export async function saveUserHistory(email: string, history: string): Promise<void> {
  if (!redis) return
  try { await redis.set(`p2dc:history:${email.toLowerCase()}`, history) } catch { /* ignore */ }
}
