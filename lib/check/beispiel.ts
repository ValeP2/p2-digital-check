import { DIMENSIONS, modelCriteria } from './criteria'
import type { CheckDeps } from './run'
import type { ModelOutput } from './schema'

// ── Beispiel-Modus (nur lokal) ───────────────────────────────────
//
// Crawl und Messungen sind echt, die KI-Urteile sind feste Beispieltexte.
// Zweck: Oberfläche und Ablauf prüfen, ohne für jeden Blick einen bezahlten
// Lauf zu machen. Jeder Text sagt, dass er ein Beispiel ist — damit nie ein
// solcher Bericht für echt gehalten wird.

const URTEILE = ['erfuellt', 'teilweise', 'erfuellt', 'nicht_erfuellt', 'erfuellt', 'nicht_pruefbar'] as const

export const BEISPIEL_DEPS: CheckDeps = {
  research: async () => '1. Google-Unternehmensprofil: BEISPIELDATEN — keine echte Recherche.\n2. Verzeichnisse: Beispiel.\n3. Social Media: Beispiel.\n4. Erwähnungen: Beispiel.\n5. Suchanfragen: keine (Beispiel-Modus).',
  analyse: async (): Promise<ModelOutput> => {
    let i = 0
    return {
      firma: { name: 'Beispiel AG (Beispieldaten)', branche: 'Kommunikationsagentur', angebot: 'BEISPIEL: Strategie, Websites, Kampagnen und KI-Werkzeuge für KMU.', zielgruppe: 'BEISPIEL: Geschäftsleitungen von KMU und Organisationen.', region: 'Biel/Bienne und Deutschschweiz' },
      urteile: DIMENSIONS.flatMap(d => modelCriteria(d).map(c => ({
        id: c.id,
        urteil: URTEILE[i++ % URTEILE.length],
        beleg: `BEISPIEL: Startseite «Wir machen Kommunikation, die wirkt» — hier stünde die konkrete Fundstelle zu ${c.label.toLowerCase()}.`,
      }))),
      befunde: Object.fromEntries(DIMENSIONS.map(d => [d.key, `BEISPIEL: Was im Bereich ${d.label} bereits trägt, steht hier zuerst — etwa eine klare Hauptüberschrift. Danach folgt die wichtigste Lücke mit Beleg und der Hinweis, ob sie dringend ist oder den langfristigen Aufbau betrifft.`])),
      staerken: [
        'BEISPIEL: Klare Hauptbotschaft auf der Startseite («Kommunikation, die wirkt»).',
        'BEISPIEL: Leistungen sind in vier Bereiche gegliedert, jeder mit eigener Seite.',
        'BEISPIEL: Kontakt ist von jeder Seite aus in einem Klick erreichbar.',
      ],
      massnahmen: [
        { titel: 'BEISPIEL: Telefonnummer klickbar machen', beschreibung: 'Auf dem Handy lässt sich die Nummer heute nicht antippen. Das kostet Anrufe von unterwegs.', dimension: 'conversion', prioritaet: 'Hoch', wirkung: 'Mittel', zeithorizont: 'Sofort', schritte: ['Nummer im Kopfbereich als tel:-Link setzen', 'Dasselbe in der Fusszeile'] },
        { titel: 'BEISPIEL: Meta-Beschreibung der Startseite schreiben', beschreibung: 'Google zeigt sonst einen zufälligen Textausschnitt.', dimension: 'seo', prioritaet: 'Mittel', wirkung: 'Mittel', zeithorizont: 'Sofort', schritte: ['140–160 Zeichen mit Angebot und Ort', 'Im CMS bei der Startseite eintragen'] },
        { titel: 'BEISPIEL: Zwei Referenzprojekte ausführlich zeigen', beschreibung: 'Logos ohne Kontext überzeugen wenig. Ein Projekt mit Ausgangslage und Ergebnis schafft Vertrauen.', dimension: 'vertrauen', prioritaet: 'Mittel', wirkung: 'Hoch', zeithorizont: 'Kurzfristig', schritte: ['Zwei Kunden um Freigabe bitten', 'Je eine Seite: Ausgangslage, Vorgehen, Ergebnis', 'Kurzes Zitat des Kunden ergänzen'] },
        { titel: 'BEISPIEL: Positionierung schärfen', beschreibung: 'Was P2 von anderen Agenturen unterscheidet, ist heute nur zwischen den Zeilen zu lesen.', dimension: 'positionierung', prioritaet: 'Tief', wirkung: 'Hoch', zeithorizont: 'Strategisch', schritte: ['Drei Unterscheidungsmerkmale festlegen', 'Startseite und Über-uns daran ausrichten'] },
      ],
      textbeispiele: [
        { seite: '/', vorher: 'BEISPIEL: Wir bieten innovative Lösungen für Ihre Kommunikation.', nachher: 'BEISPIEL: Wir machen Ihre Website zum besten Verkäufer Ihres Betriebs — messbar, in acht Wochen.' },
      ],
      fazit: 'BEISPIELDATEN, keine echte Analyse. Hier stehen drei Sätze: wie der Auftritt heute dasteht, wo der grösste Hebel liegt, und was der nächste sinnvolle Schritt wäre.',
    }
  },
}
