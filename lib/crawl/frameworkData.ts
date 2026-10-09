// ── Text aus eingebetteten Framework-Daten ───────────────────────
//
// Aus dem alten Digital-Check-Crawler übernommen. Seiten, die ihren Inhalt
// erst im Browser aufbauen (Next.js, Nuxt), liefern im HTML kaum Text — aber
// oft die Daten dafür als JSON. Daraus lässt sich zumindest ein Teil lesen.
// Wird nur genutzt, wenn der normale Text nicht reicht, und als solcher
// gekennzeichnet: Es ist eine Rekonstruktion, kein Seitentext.

function strings(json: string, minLength: number, limit: number): string[] {
  return (json.match(new RegExp(`"([^"]{${minLength},})"`, 'g')) ?? [])
    .map(s => s.slice(1, -1))
    .filter(s => !s.startsWith('http') && !s.startsWith('/') && !s.startsWith('@') && !/^[a-z_\-.]+$/i.test(s))
    .slice(0, limit)
}

export function extractFrameworkText(html: string): string {
  const extras: string[] = []

  const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (nextData) {
    try { extras.push(...strings(JSON.stringify(JSON.parse(nextData[1])), 20, 100)) } catch { /* ignore */ }
  }

  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { extras.push(...strings(JSON.stringify(JSON.parse(m[1])), 15, 30)) } catch { /* ignore */ }
  }

  const nuxt = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/i)
  if (nuxt) extras.push(...strings(nuxt[1], 15, 50))

  return [...new Set(extras)].join('\n').replace(/\\[ntr]/g, ' ').replace(/[ \t]+/g, ' ').trim()
}
