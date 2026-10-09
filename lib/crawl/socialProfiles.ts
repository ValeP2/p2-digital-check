// Social-Media-Profile, die die Website selbst verlinkt. Das ist eine Messung:
// Die Seite verweist darauf. Ob das Profil auch aktiv ist, klärt erst die
// Web-Recherche — und das ist dann eine Einschätzung.

const PLATFORMS: { platform: string; host: RegExp; ignorePath?: RegExp }[] = [
  { platform: 'LinkedIn', host: /(^|\.)linkedin\.com$/, ignorePath: /^\/(shareArticle|sharing)/i },
  { platform: 'Instagram', host: /(^|\.)instagram\.com$/, ignorePath: /^\/(p|reel|explore)\//i },
  { platform: 'Facebook', host: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, ignorePath: /^\/(sharer|share|dialog|plugins|tr)/i },
  { platform: 'X', host: /(^|\.)(twitter|x)\.com$/, ignorePath: /^\/(intent|share|home)/i },
  { platform: 'YouTube', host: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, ignorePath: /^\/(watch|embed)/i },
  { platform: 'TikTok', host: /(^|\.)tiktok\.com$/ },
  { platform: 'Xing', host: /(^|\.)xing\.com$/ },
  { platform: 'Pinterest', host: /(^|\.)pinterest\.(com|ch|de)$/, ignorePath: /^\/pin\//i },
]

export function findSocialProfiles(links: string[]): { platform: string; url: string }[] {
  const found = new Map<string, string>()
  for (const link of links) {
    let u: URL
    try { u = new URL(link) } catch { continue }
    const host = u.hostname.toLowerCase()
    for (const p of PLATFORMS) {
      if (!p.host.test(host)) continue
      if (u.pathname === '/' || u.pathname === '') break
      if (p.ignorePath?.test(u.pathname)) break
      if (!found.has(p.platform)) found.set(p.platform, `${u.origin}${u.pathname}`.replace(/\/$/, ''))
      break
    }
  }
  return [...found].map(([platform, url]) => ({ platform, url }))
}
