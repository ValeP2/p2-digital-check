# TODO — P2 Digital Check

## Vor dem Release 2.0 (Zweig `v2` → `main`, nur auf Ansage)

- [x] Echte Testläufe (09.10.2026, p-zwei.ch, 4 Läufe): CHF 0.50–0.55, 180 s,
      23/24 bzw. 27/28 KI-Urteile zwischen Läufen identisch, Gesamt 81/82/81
- [x] Zeitlimit 600 s — Vercel-Vorschau baut damit (Projekt erlaubt es)
- [x] `PAGESPEED_API_KEY` angelegt (Google-Projekt «P2 Digital Check»), lokal eingetragen
- [ ] `PAGESPEED_API_KEY` in Vercel (Digital-Check-Projekt, Production + Preview)
- [ ] Vercel prüfen: `ANTHROPIC_API_KEY` = P2-Schlüssel (Workspace P2), `INTAKE_SECRET` gesetzt
- [ ] Mindestens zwei weitere, ganz andere Websites prüfen (klassisches KMU, Onlineshop)
- [ ] PowerPoint aller Folien in PowerPoint/Keynote ansehen (nur Titelfolie gerendert geprüft)
- [ ] Framer-Formular einmal echt auslösen (Intake läuft jetzt über die neue Pipeline)

## Später

- [ ] `npm audit`: 11 Meldungen (1 kritisch) — Abhängigkeiten prüfen
- [ ] Alte v1-Bausteine (`ReportView.tsx`, `generatePptx.ts`, `/api/export-pptx`) entfernen,
      sobald das Archiv nicht mehr gebraucht wird
- [ ] Dunkelmodus (Tokens sind vorbereitet)
- [ ] Rate-Limit für `/api/auth` (Passwort durchprobieren)
