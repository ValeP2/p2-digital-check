import { CrawlResult } from './crawler'

export function buildPrompt(data: CrawlResult): string {
  const pagesSummary = data.pages.map(p => `
--- Seite: ${p.url} (HTTP ${p.statusCode}) ---
Titel: ${p.title}
Meta Description: ${p.metaDescription || '(keine)'}
H1: ${p.h1.join(' | ') || '(keine)'}
H2: ${p.h2.slice(0, 8).join(' | ') || '(keine)'}
H3: ${p.h3.slice(0, 5).join(' | ') || '(keine)'}
Wörter: ${p.wordCount}
Telefon: ${p.phoneNumbers.join(', ') || '(nicht gefunden)'}
E-Mail: ${p.emails.join(', ') || '(nicht gefunden)'}
WhatsApp: ${p.hasWhatsApp ? 'Ja' : 'Nein'}
Formular: ${p.hasForms ? `Ja (Felder: ${p.formFields.slice(0, 12).join(', ')})` : 'Nein'}
Bilder: ${p.images} total, ${p.imagesWithAlt} mit Alt-Text
Externe Links: ${p.externalLinks.slice(0, 8).join(', ') || '(keine)'}
Vollständiger Seitentext:
${p.bodyText.slice(0, 2000)}
`.trim()).join('\n\n')

  const tech = data.technical
  const techSummary = [
    `HTTPS: ${tech.https ? 'Ja' : 'NEIN – Sicherheitsrisiko'}`,
    `Sitemap: ${tech.hasSitemap ? 'Ja' : 'Nicht gefunden'}`,
    `robots.txt: ${tech.hasRobots ? 'Ja' : 'Nicht gefunden'}`,
    `Meta-Titel Länge: ${tech.metaTitleLength} Zeichen ${tech.metaTitleLength === 0 ? '– FEHLT KOMPLETT' : tech.metaTitleLength > 60 ? '– zu lang' : tech.metaTitleLength < 30 ? '– zu kurz' : '– gut'}`,
    `Meta-Description Länge: ${tech.metaDescriptionLength} Zeichen ${tech.metaDescriptionLength === 0 ? '– FEHLT KOMPLETT' : tech.metaDescriptionLength > 160 ? '– zu lang' : tech.metaDescriptionLength < 80 ? '– zu kurz' : '– gut'}`,
    `Open Graph: ${tech.hasOpenGraph ? 'Ja' : 'Nein – fehlt für Social Sharing'}`,
    `JSON-LD strukturierte Daten: ${tech.hasStructuredData ? 'Ja' : 'Nein – fehlt für Google Rich Snippets'}`,
    `H1 auf Startseite: ${tech.h1Count} ${tech.h1Count > 1 ? '– zu viele! Nur eine H1 pro Seite empfohlen' : tech.h1Count === 0 ? '– fehlt!' : '– korrekt'}`,
  ].join('\n')

  return `Du bist ein erfahrener Digital-Stratege und Website-Analyst für Schweizer KMU.

Analysiere diese Website für einen Digital Check der P2 Digitale Kommunikation AG.
Der Bericht dient als Grundlage für ein Verkaufsgespräch und muss FUNDIERT, KONKRET und SPEZIFISCH sein.

WICHTIGE REGELN FÜR DEINEN BERICHT:
- Zitiere echten Text von der Website in Anführungszeichen (besonders Tippfehler, schwache Formulierungen)
- Nenne konkrete Zahlen aus den Crawl-Daten (Wortanzahl, fehlende Meta-Daten, Anzahl Bilder ohne Alt-Text etc.)
- Nutze Bullet-Listen für Beispiele (Gerätetypen, fehlende Inhalte, konkrete Verbesserungsvorschläge)
- Schreibe Vorher/Nachher-Beispiele wenn schwache Texte gefunden werden
- Nutze alle externen Recherche-Ergebnisse (local.ch, Social Media, Konkurrenz, weitere Domains)
- Jeder Abschnitt schliesst mit einer kurzen, prägnanten kursiven *Einschätzung*
- Schweizer Rechtschreibung: ss statt ß, keine deutschen Umgangsausdrücke

---

WEBSITE: ${data.inputUrl}
UNTERNEHMEN: ${data.companyName}
NAVIGATION: ${data.navigationItems.join(' | ')}
ALLE TELEFONNUMMERN: ${data.allPhoneNumbers.join(', ') || '(keine gefunden)'}
ALLE E-MAILS: ${data.allEmails.join(', ') || '(keine gefunden)'}

TECHNISCHE ANALYSE:
${techSummary}

GECRAWLTE SEITEN (${data.pages.length} Seiten):
${pagesSummary}

---

Erstelle den vollständigen Analysebericht mit exakt dieser Struktur.
Nutze die Seitentexte, um konkrete Zitate, Tippfehler und Schwächen zu benennen.

## Website Analyse – [Unternehmen]

### Ausgangslage
Was macht das Unternehmen (aus den Texten ableiten), welche Zielgruppe, welcher erste Eindruck? Erwähne konkrete Details aus den Crawl-Daten (Gründungsjahr, Inhaber, Standort etc. falls gefunden).

### 1. Erster Eindruck und Positionierung
Was steht above the fold / auf der Startseite? Ist das Verkaufsargument sofort sichtbar? Zitiere den echten Einstiegstext. Was müsste ein Erstbesucher sofort verstehen – und fehlt das?

### 2. Angebot und Verständlichkeit
Welche Leistungen werden genannt, wie ausführlich? Welche konkreten Gerätetypen, Marken, Abläufe fehlen? Erstelle eine Liste mit Beispielen was fehlt. Zitiere Texte die zu allgemein sind.

### 3. Zielgruppe und Kundenbedürfnis
Wer kommt typischerweise auf diese Seite und mit welchem Problem? Liste 4–6 typische Nutzerfragen auf. Welche davon beantwortet die Seite – welche nicht?

### 4. Vertrauen und Glaubwürdigkeit
Team, Referenzen, Bewertungen, Marken, Geschichte, Zertifikate – was ist konkret vorhanden (zitieren), was fehlt, was wird zu wenig genutzt? Externe Quellen einbeziehen (local.ch-Rating, Google-Bewertungen etc.).

### 5. Kontakt und Conversion
Welche Kontaktwege gibt es konkret? Wie sind die Formulare aufgebaut (konkrete Felder nennen)? Gibt es CTAs – wenn ja, wo und wie lautet der Text? Was fehlt für eine optimale Conversion?

### 6. Inhalte und SEO
Konkrete technische Befunde: Meta-Titel (Länge/Inhalt), Meta-Description (vorhanden/fehlend), H1-Struktur, Wortanzahl pro Seite, Tippfehler in Titeln. Welche lokalen Suchbegriffe fehlen? Weitere Domains oder SEO-Landingpages?

### 7. Navigation und Struktur
Aktuelle Navigation benennen. Konkrete Verbesserungsvorschläge als Liste (neue Seitenstruktur, fehlende Seiten).

### 8. Sprache und Textqualität
Konkrete Textzitate die verbessert werden sollten, mit einem «Besser wäre:»-Beispiel. Tippfehler konkret benennen.

### 9. Technik und Mobile
Technische Befunde aus den Daten (HTTPS, Sitemap, robots.txt, Open Graph, JSON-LD, 404-Fehler, Bildoptimierung) und deren geschäftliche Auswirkung.

### 10. Externe Sichtbarkeit
Alle gefundenen externen Signale: Branchenverzeichnisse mit Rating, Social Media Aktivität, Konkurrenten, weitere Domains – konkret benennen was gefunden wurde.

### Gesamtbewertung
**Stärken:** (4–5 Punkte als Liste)
**Schwächen:** (4–5 Punkte als Liste)

### Empfehlung im Rahmen des Digital Checks
8–10 priorisierte Massnahmen als nummerierte Liste. Jede Massnahme mit kurzem Erklärungsatz warum sie wichtig ist. Reihenfolge: Sofortmassnahmen zuerst, dann strategische.

### Fazit
3 verkaufsstarke Sätze: Klare Positionierung des Unternehmens, Hauptproblem, warum der Digital Check jetzt sinnvoll ist.
`
}
