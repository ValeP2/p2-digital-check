# TODO — P2 Digital Check

## Vor dem Release 2.0 (Zweig `v2` → `main`, nur auf Ansage)

- [ ] Anthropic-Schlüssel mit Guthaben lokal eintragen und echte Testläufe machen
      (lokaler DC- und Kompass-Schlüssel hatten am 09.10.2026 kein Guthaben)
- [ ] Kosten und Dauer pro Check an echten Läufen messen (Schätzung CHF 0.40–1.00, Zeitlimit 300 s)
- [ ] Gleiche Website zweimal prüfen → wie stabil sind die Urteile?
- [ ] `PAGESPEED_API_KEY` in Google Cloud anlegen, lokal + Vercel (Production + Preview)
- [ ] Vercel prüfen: `ANTHROPIC_API_KEY` (P2-Workspace), `INTAKE_SECRET` gesetzt
- [ ] PowerPoint aller Folien in PowerPoint/Keynote ansehen (nur Titelfolie gerendert geprüft)
- [ ] Framer-Formular einmal echt auslösen (Intake läuft jetzt über die neue Pipeline)

## Später

- [ ] `npm audit`: 11 Meldungen (1 kritisch) — Abhängigkeiten prüfen
- [ ] Alte v1-Bausteine (`ReportView.tsx`, `generatePptx.ts`, `/api/export-pptx`) entfernen,
      sobald das Archiv nicht mehr gebraucht wird
- [ ] Dunkelmodus (Tokens sind vorbereitet)
- [ ] Rate-Limit für `/api/auth` (Passwort durchprobieren)
