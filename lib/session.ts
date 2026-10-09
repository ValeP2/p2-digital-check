import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { isAdmin } from './userStore'

// Signiertes Session-Cookie: "<email base64url>.<ablauf ms>.<hmac>"
// Nur der Server kann es ausstellen – ein selbst gesetztes Cookie besteht die Prüfung nicht.
export const SESSION_COOKIE = 'p2-auth'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 Tage, in Sekunden

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.APP_PASSWORD
  if (!s) throw new Error('SESSION_SECRET (oder APP_PASSWORD) fehlt')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createSessionToken(email: string): string {
  const exp = Date.now() + SESSION_MAX_AGE * 1000
  const payload = `${Buffer.from(email.toLowerCase()).toString('base64url')}.${exp}`
  return `${payload}.${sign(payload)}`
}

export interface SessionUser { email: string; isAdmin: boolean }

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [emailPart, expPart, sig] = parts
  const expected = Buffer.from(sign(`${emailPart}.${expPart}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (!(Number(expPart) > Date.now())) return null
  const email = Buffer.from(emailPart, 'base64url').toString()
  return { email, isAdmin: isAdmin(email) }
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}
