@AGENTS.md

# P2 Digital Check — Projektdokumentation

Einmaliger Website-Check für Schweizer KMU: Crawl + Messungen + KI-Beurteilung →
Bericht mit Score 0–100, Massnahmen, Teilen-Link, PowerPoint. Intern bei P2,
Leads kommen zusätzlich über das Framer-Formular (`/api/intake`).

**Bewusst die Mini-Version von P2 Kompass** (`/Users/valeflorea/p2-communication-radar`):
gleiche Bewertungsmethode und gleicher Look, aber KEIN Multi-Tenant, keine Kanäle,
kein Massnahmen-Tracking, keine Datenbank ausser Redis. Was im Kompass dazukommt,
wird hier nur übernommen, wenn es den Einmal-Check besser macht.

- Live: `digitalcheck.p-zwei.ch` (Vercel, deployt von `main`)
- Repo: `ValeP2/p2-digital-check` — vor dem Pushen `gh auth switch --user ValeP2`
- Arbeitszweig für 2.0: `v2`. **Nie selbständig auf `main`** — nur auf Ansage.
- Lokal: `preview_start p2-digital-check` (Port 3004). Ohne Redis lokal hält
  `lib/checkStore.ts` die Daten im Arbeitsspeicher. **Beispiel-Modus** (Häkchen
  auf der Startseite, nur lokal): echter Crawl, KI-Texte aus `lib/check/beispiel.ts`.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `ANTHROPIC_API_KEY` | Analyse (Opus 5.5) und Recherche (Sonnet 5.5). Schlüssel im P2-Workspace anlegen, vorher mit einer Anfrage testen |
| `PAGESPEED_API_KEY` | Google PageSpeed Insights (kostenlos). Ohne Schlüssel: Ladezeit „nicht gemessen", 4 Prüfpunkte zählen nicht |
| `APP_PASSWORD` | Admin-Login (vale@, andreas@) und Rückfall-Schlüssel für die Session-Signatur |
| `SESSION_SECRET` | Optional, signiert die Session. Ändern = alle abgemeldet |
| `KV_REST_API_URL` / `_TOKEN` | Upstash Redis |
| `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO` | Mails (Einladung, Passwort, Intake-Meldung) |
| `INTAKE_SECRET` | Pflicht für `/api/intake` (`?secret=…`). Ohne: Eingang geschlossen |

## Wie ein Check entsteht (`lib/check/run.ts` — die EINE Pipeline)

1. Crawl (`lib/crawl/`, aus dem Kompass, 14 Unterseiten parallel) ‖ PageSpeed
2. Messungen: Prüfpunkte mit `quelle: 'messung'` in `lib/check/criteria.ts`
3. Recherche externe Sichtbarkeit: Sonnet 5.5 + Websuche, liefert Fakten, kein Urteil
4. Analyse: Opus 5.5, `effort: high`, strukturierte Ausgabe (`lib/check/schema.ts`)
5. Scores rechnen (`lib/check/score.ts`)

**Kein Score wird vom Modell gesetzt.** Das Modell urteilt je Prüfpunkt
erfüllt / teilweise / nicht erfüllt / nicht prüfbar / nicht relevant, mit Beleg.
Dimension = gewichteter Erfüllungsgrad (1 / ½ / 0), Gesamt = gewichtetes Mittel
der Dimensionen. Grund: frei gesetzte Zahlen fallen auf Bandanker (Kompass-Befund),
und der alte Recheck gab bei jedem Klick andere Werte.

- `temperature` gibt es auf Opus/Sonnet 5.5 nicht mehr (400).
- Prüfpunkte, Gewichte oder Schwellen ändern → `KALIBRIERUNG` in `criteria.ts`
  hochzählen. Der Bericht vergleicht nur Checks mit gleicher Kalibrierung.
- Die Bewertungsgrundlage je Dimension (Gemessen / Inhaltsprüfung / Web-Recherche)
  setzt der Server aus den Quellen, nicht das Modell.
- Prompt-Regeln aus dem Kompass: Belegpflicht, keine falschen „fehlt"-Meldungen
  (Pfadliste prüfen), HTML ≠ Browser, am Zweck messen.

## Daten (Redis)

| Schlüssel | Inhalt |
|---|---|
| `p2dc:check:<id>` | Check v2 (`StoredCheck`), 365 Tage, ID 96 Bit Zufall |
| `p2dc:history:<email>` | Verlauf: v2-Verweise + alte v1-Einträge (mit Bericht) |
| `p2dc:analysis:<id>` | Alte geteilte v1-Analysen (90 Tage) |
| `p2dc:users` | Eingeladene User, Passwort als scrypt-Hash (Altbestand wird beim Login umgestellt) |
| `p2dc:total_cost_chf`, `p2dc:total_analyses` | Kostenzähler |

Den Verlauf schreibt nur der Server. Alte v1-Analysen: `/archiv/<id>` (alte Darstellung).

## Login

Signiertes Cookie `p2-auth` (HMAC, `lib/session.ts`). `p2-user` ist nur Anzeige.
`getActiveUser` prüft zusätzlich, ob ein eingeladener User noch existiert —
Entfernen wirkt sofort. Bis 09.10.2026 war das Login per Hand-Cookie umgehbar.
