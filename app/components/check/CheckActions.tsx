'use client'

import { useState } from 'react'
import { Link2, Check, Printer, RotateCcw, Presentation, Loader2 } from 'lucide-react'
import { KNOPF_LEISE } from '../ui'

// Aktionen über dem Bericht. Teilen braucht keinen eigenen Speichervorgang
// mehr: Der Check liegt schon gespeichert, und seine ID ist nicht erratbar.
export function CheckActions({ id, url }: { id: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const [pptx, setPptx] = useState<'idle' | 'busy' | 'error'>('idle')

  async function copy() {
    const link = `${window.location.origin}/a/${id}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Link zum Kopieren:', link)
    }
  }

  async function exportPptx() {
    setPptx('busy')
    try {
      const res = await fetch(`/api/export-pptx-public?id=${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const name = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? 'digital-check.pptx'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = decodeURIComponent(name)
      a.click()
      URL.revokeObjectURL(a.href)
      setPptx('idle')
    } catch {
      setPptx('error')
    }
  }

  return (
    <div className="no-print flex flex-wrap gap-2 mb-6">
      <button onClick={copy} className={KNOPF_LEISE}>
        {copied ? <Check className="w-3.5 h-3.5 text-good" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? 'Link kopiert' : 'Link zum Teilen'}
      </button>
      <button onClick={exportPptx} disabled={pptx === 'busy'} className={KNOPF_LEISE}>
        {pptx === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
        {pptx === 'error' ? 'PowerPoint fehlgeschlagen – nochmals' : 'PowerPoint'}
      </button>
      <button onClick={() => window.print()} className={KNOPF_LEISE}>
        <Printer className="w-3.5 h-3.5" /> Drucken / PDF
      </button>
      <a href={`/?url=${encodeURIComponent(url)}&vorher=${encodeURIComponent(id)}`} className={KNOPF_LEISE}>
        <RotateCcw className="w-3.5 h-3.5" /> Nachprüfen
      </a>
    </div>
  )
}
