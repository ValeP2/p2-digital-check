'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Plus, Users, LogOut, Menu, X, Trash2, Archive } from 'lucide-react'
import Brand from './Brand'
import UserManager from './UserManager'
import { cn, ScoreRing, scoreColor } from './ui'
import type { HistoryItem } from '../api/history/route'

export const APP_VERSION = '2.0.0'

/** Nach einem fertigen Check auslösen, damit der Verlauf nachlädt. */
export function refreshHistory() {
  window.dispatchEvent(new Event('p2dc:history'))
}

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function HistoryRow({ item, active, onDelete }: { item: HistoryItem; active: boolean; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const href = item.version === 2 ? `/check/${item.id}` : `/archiv/${item.id}`
  // Alte Analysen (Skala 1–10) bekommen die Farbe ihres Gegenwerts auf 100,
  // die Zahl bleibt die alte — sonst sähe eine 7 aus wie eine 70.
  const color = item.score === null ? '#9CA3AF' : scoreColor(item.version === 2 ? item.score : item.score * 10)
  return (
    <div className={cn('group relative rounded-lg transition-colors', active ? 'bg-primary/10' : 'hover:bg-primary/[0.05]')}>
      <Link href={href} className="flex items-center gap-3 pl-2.5 pr-9 py-2">
        <ScoreRing score={item.score} size="xs" color={color} />
        <span className="min-w-0">
          <span className={cn('block text-[13px] truncate', active ? 'font-semibold text-primary' : 'text-foreground/85')}>{item.companyName || host(item.url)}</span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {item.version === 1 && <Archive className="inline w-3 h-3 -mt-0.5 mr-1" />}{host(item.url)} · {shortDate(item.date)}
          </span>
        </span>
      </Link>
      <button
        onClick={() => (confirm ? onDelete() : setConfirm(true))}
        onBlur={() => setConfirm(false)}
        title={confirm ? 'Nochmals klicken zum Entfernen' : 'Aus dem Verlauf entfernen'}
        className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xs flex items-center justify-center transition-all',
          confirm ? 'bg-bad text-white opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState(false)
  const [me, setMe] = useState<{ email: string; isAdmin: boolean } | null>(null)
  const [team, setTeam] = useState(false)

  const load = useCallback(() => {
    fetch('/api/history')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setItems(d.items); setError(false) })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    load()
    fetch('/api/auth').then(r => r.ok ? r.json() : null).then(setMe).catch(() => {})
    window.addEventListener('p2dc:history', load)
    return () => window.removeEventListener('p2dc:history', load)
  }, [load])

  async function remove(id: string) {
    setItems(list => list?.filter(i => i.id !== id) ?? null)
    await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (pathname.endsWith(id)) router.push('/')
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        <Brand height={24} size={15} />
      </div>

      <div className="px-3">
        <Link href="/" onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-[14px] font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Neuer Check
        </Link>
      </div>

      <div className="px-5 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verlauf</div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5" onClick={onNavigate}>
        {items === null && !error && <p className="px-3 py-2 text-[12px] text-muted-foreground">Wird geladen …</p>}
        {error && <p className="px-3 py-2 text-[12px] text-muted-foreground">Verlauf nicht erreichbar. <button onClick={load} className="underline">Erneut versuchen</button></p>}
        {items?.length === 0 && <p className="px-3 py-2 text-[12px] text-muted-foreground leading-relaxed">Noch keine Checks. Starte oben mit einer Website-Adresse.</p>}
        {items?.map(item => (
          <HistoryRow key={item.id} item={item} active={pathname.endsWith(item.id)} onDelete={() => remove(item.id)} />
        ))}
      </nav>

      <div className="border-t border-black/5 px-3 py-3 space-y-0.5">
        {me && <p className="px-3 pb-1.5 text-[12px] text-muted-foreground truncate">{me.email}</p>}
        {me?.isAdmin && (
          <button onClick={() => setTeam(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] text-foreground/85 hover:bg-black/[0.04]">
            <Users className="w-4 h-4" /> Team verwalten
          </button>
        )}
        <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] text-foreground/85 hover:bg-black/[0.04]">
          <LogOut className="w-4 h-4" /> Abmelden
        </button>
        <p className="px-3 pt-1.5 text-[11px] text-muted-foreground/70">Version {APP_VERSION}</p>
      </div>
      {team && <UserManager onClose={() => setTeam(false)} />}
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen">
      <aside className="no-print hidden md:flex fixed left-0 top-0 h-screen w-[248px] border-r border-black/5 bg-[#FAFAFB] flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Telefon: Kopfleiste mit Menü */}
      <header className="no-print md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-[#FAFAFB]/95 backdrop-blur border-b border-black/5">
        <Brand height={20} size={14} />
        <button onClick={() => setOpen(true)} aria-label="Menü öffnen" className="w-9 h-9 rounded-sm flex items-center justify-center hover:bg-black/5"><Menu className="w-5 h-5" /></button>
      </header>
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] bg-[#FAFAFB] shadow-xl">
            <button onClick={() => setOpen(false)} aria-label="Menü schliessen" className="absolute right-3 top-5 w-8 h-8 rounded-xs flex items-center justify-center hover:bg-black/5"><X className="w-4 h-4" /></button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="md:pl-[248px]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-8 md:py-12">{children}</div>
      </main>
    </div>
  )
}
