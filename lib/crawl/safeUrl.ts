import { lookup } from 'node:dns/promises'
import net from 'node:net'

// ── Nur öffentliche Adressen abrufen ─────────────────────────────
//
// Der Framer-Webhook nimmt eine beliebige Adresse entgegen und lässt den
// Server sie abrufen. Ohne diese Prüfung liesse sich damit das interne Netz
// des Servers abtasten (localhost, 10.x, Cloud-Metadaten auf 169.254.169.254).

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7))
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

export async function assertPublicUrl(url: string): Promise<void> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error(`Ungültige Adresse: ${url}`) }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Nur http/https möglich: ${url}`)
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error(`Interne Adresse wird nicht geprüft: ${host}`)
  }
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (addresses.length === 0) throw new Error(`Adresse nicht gefunden: ${host}`)
  if (addresses.some(a => isPrivateIp(a.address))) throw new Error(`Interne Adresse wird nicht geprüft: ${host}`)
}
