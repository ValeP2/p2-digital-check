import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { redis } from './redis'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

const USERS_KEY = 'p2dc:users'

export interface User {
  email: string
  /** scrypt-Hash "scrypt$<salt>$<hash>". Bis Oktober 2026 stand hier das Passwort im Klartext (Feld `password`). */
  passwordHash?: string
  /** Altlast — wird beim nächsten erfolgreichen Login durch passwordHash ersetzt. */
  password?: string
  name: string
  createdAt: string
  createdBy: string
  isAdmin: boolean
}

/** Was die Oberfläche über einen User sehen darf — nie ein Passwort oder Hash. */
export type PublicUser = Pick<User, 'email' | 'name' | 'createdAt' | 'createdBy'>

// Admin-Adressen (können immer einladen/entfernen)
export const ADMIN_EMAILS = ['vale@p-zwei.ch', 'andreas@p-zwei.ch']

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/** Lesbares Zufallspasswort aus dem Kryptografie-Zufall (vorher Math.random). */
export function generatePassword(length = 12): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 32)
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`
}

async function checkHash(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length)
  return timingSafeEqual(expected, actual)
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function toPublic(u: User): PublicUser {
  return { email: u.email, name: u.name, createdAt: u.createdAt, createdBy: u.createdBy }
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

/** Neues Passwort setzen (Einladung, vergessen) — gespeichert wird nur der Hash. */
export async function setPassword(user: User, password: string): Promise<void> {
  const { password: _legacy, ...rest } = user
  void _legacy
  await saveUser({ ...rest, passwordHash: await hashPassword(password) })
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  // Admins können sich mit APP_PASSWORD anmelden (Bootstrapping)
  const appPassword = process.env.APP_PASSWORD
  if (isAdmin(email) && appPassword && safeEqual(password, appPassword)) {
    return { email, name: email.split('@')[0], createdAt: '', createdBy: 'system', isAdmin: true }
  }
  const user = await getUser(email)
  if (!user) return null
  if (user.passwordHash) return (await checkHash(password, user.passwordHash)) ? user : null
  // Altbestand mit Klartext: einmal noch vergleichen, dann sofort auf Hash umstellen.
  if (user.password && safeEqual(password, user.password)) {
    await setPassword(user, password)
    return user
  }
  return null
}

/** Gibt es diesen Zugang noch? Admins immer; eingeladene nur, solange sie nicht entfernt wurden. */
export async function userStillActive(email: string): Promise<boolean> {
  if (isAdmin(email)) return true
  if (!redis) return process.env.NODE_ENV === 'development'
  return (await getUser(email)) !== null
}
