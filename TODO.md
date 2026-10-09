# TODO — P2 Digital Check

## Release 2.0 — live seit 09.10.2026 (main = 91c9dc1)

- [x] Echte Testläufe (09.10.2026, p-zwei.ch, 4 Läufe): CHF 0.50–0.55, 180 s,
      23/24 bzw. 27/28 KI-Urteile zwischen Läufen identisch, Gesamt 81/82/81
- [x] Zeitlimit 600 s — Vercel-Vorschau baut damit (Projekt erlaubt es)
- [x] `PAGESPEED_API_KEY` angelegt (Google-Projekt «P2 Digital Check»), lokal eingetragen
- [x] Vercel (09.10.2026): `PAGESPEED_API_KEY` Production + Preview, `ANTHROPIC_API_KEY` durch den P2-Schlüssel ersetzt, Production neu deployt; `INTAKE_SECRET` vorhanden
- [ ] Nach dem Livegang: `DEMO_MODE` in Vercel löschen (wird von 2.0 nicht mehr gelesen)
- [ ] Erste echte Checks anderer Websites (klassisches KMU, Onlineshop) auswerten
- [ ] PowerPoint aller Folien in PowerPoint/Keynote ansehen (nur Titelfolie gerendert geprüft)
- [ ] Framer-Formular einmal echt auslösen (Intake läuft jetzt über die neue Pipeline)

## Später

- [ ] `npm audit`: 11 Meldungen (1 kritisch) — Abhängigkeiten prüfen
- [ ] Alte v1-Bausteine (`ReportView.tsx`, `generatePptx.ts`, `/api/export-pptx`) entfernen,
      sobald das Archiv nicht mehr gebraucht wird
- [ ] Dunkelmodus (Tokens sind vorbereitet)
- [ ] Rate-Limit für `/api/auth` (Passwort durchprobieren)
