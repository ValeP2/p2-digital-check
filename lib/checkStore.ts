import { randomBytes } from 'node:crypto'
import { redis as upstash } from './redis'
import type { CheckResult } from './check/types'

// ── Gespeicherte Checks (Version 2) ──────────────────────────────
//
// Ein Check liegt einmal unter p2dc:check:<id>. Der Verlauf eines Users
// enthält nur noch Verweise mit Kurzangaben — vorher stand dort der ganze
// Bericht, und der Client schrieb den Verlauf selbst (inkl. fremder, wenn er
// es darauf anlegte). Jetzt schreibt ihn nur der Server.
//
// Alte Analysen (Version 1, Markdown-Bericht) bleiben unter
// p2dc:analysis:<id> und im alten Verlaufsformat lesbar.

export interface StoredCheck {
  id: string
  createdBy: string
  /** Vorheriger Check derselben Adresse, falls dies eine Nachprüfung ist. */
  previousId: string | null
  result: CheckResult
}

export interface HistoryEntryV2 {
  version: 2
  id: string
  url: string
  companyName: string
  date: string
  overall: number | null
  costChf: number
}

// Lokal ist kein Redis eingerichtet. Damit sich Ablauf und Ansicht trotzdem
// prüfen lassen, hält die Entwicklungsumgebung die Daten im Arbeitsspeicher
// (weg nach Neustart). In Produktion gibt es diesen Rückfall nicht.
type Store = { get<T>(k: string): Promise<T | null>; set(k: string, v: string, o?: { ex: number }): Promise<unknown> }
const memory = ((globalThis as { __p2dcMemory?: Map<string, string> }).__p2dcMemory ??= new Map<string, string>())
const memoryStore: Store = {
  async get<T>(k: string) { return (memory.get(k) ?? null) as T | null },
  async set(k: string, v: string) { memory.set(k, v); return 'OK' },
}
const redis: Store | null = upstash ?? (process.env.NODE_ENV === 'development' ? memoryStore : null)

const TTL_SECONDS = 60 * 60 * 24 * 365
const HISTORY_MAX = 100

/** Nicht erratbar: 16 Zeichen aus 96 Zufallsbits. Die alten IDs waren Date.now(). */
export function newCheckId(): string {
  return randomBytes(12).toString('base64url')
}

export async function saveCheck(check: StoredCheck): Promise<boolean> {
  if (!redis) return false
  try {
    await redis.set(`p2dc:check:${check.id}`, JSON.stringify(check), { ex: TTL_SECONDS })
    return true
  } catch (e) {
    console.error('[checkStore] speichern fehlgeschlagen:', e)
    return false
  }
}

export async function getCheck(id: string): Promise<StoredCheck | null> {
  if (!redis || !/^[\w-]{6,40}$/.test(id)) return null
  try {
    const raw = await redis.get<string | StoredCheck>(`p2dc:check:${id}`)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

function historyKey(email: string): string {
  return `p2dc:history:${email.toLowerCase()}`
}

async function readHistory(email: string): Promise<unknown[]> {
  if (!redis) return []
  try {
    const raw = await redis.get<string | unknown[]>(historyKey(email))
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function appendHistory(email: string, entry: HistoryEntryV2): Promise<void> {
  if (!redis) return
  const list = await readHistory(email)
  const next = [entry, ...list.filter(e => (e as { id?: string })?.id !== entry.id)].slice(0, HISTORY_MAX)
  await redis.set(historyKey(email), JSON.stringify(next))
}

export async function getHistory(email: string): Promise<unknown[]> {
  return readHistory(email)
}

export async function removeFromHistory(email: string, id: string): Promise<void> {
  if (!redis) return
  const list = await readHistory(email)
  await redis.set(historyKey(email), JSON.stringify(list.filter(e => (e as { id?: string })?.id !== id)))
}

export function historyEntry(id: string, r: CheckResult): HistoryEntryV2 {
  return {
    version: 2,
    id,
    url: r.finalUrl,
    companyName: r.firma.name,
    date: r.checkedAt,
    overall: r.overall,
    costChf: r.meta.costChf,
  }
}
