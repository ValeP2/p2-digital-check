import { DIMENSIONS, modelCriteria } from './criteria'
import { DIMENSION_KEYS, HORIZONTE, LEVELS, URTEILE } from './types'

// ── Antwortformat der Analyse ────────────────────────────────────
//
// Strukturierte Ausgabe statt Fliesstext: Die Schnittstelle erzwingt gültiges
// JSON nach diesem Schema. Der alte Digital Check las die Zahlen per Suchmuster
// aus einer Textantwort und setzte still eine 5, wenn eine fehlte.
//
// Urteile als eine Liste statt als je ein Pflichtfeld pro Prüfpunkt: Mit 28
// verschachtelten Pflichtfeldern lehnte Anthropic das Schema ab ("compiled
// grammar is too large", erster echter Lauf am 09.10.2026). Die Prüfpunkt-ID
// ist eine Aufzählung — erfinden kann das Modell keine. Fehlt ein Urteil,
// zählt der Punkt als "nicht prüfbar" (run.ts), nie als Durchschnitt.
// Messungen stehen nicht im Schema: Sie werden gemessen, nicht gefragt.

const str = (description?: string) => ({ type: 'string' as const, ...(description ? { description } : {}) })

const MODEL_CRITERION_IDS = DIMENSIONS.flatMap(d => modelCriteria(d).map(c => c.id))

export const CHECK_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['firma', 'urteile', 'befunde', 'staerken', 'massnahmen', 'textbeispiele', 'fazit'],
  properties: {
    firma: {
      type: 'object' as const,
      additionalProperties: false,
      required: ['name', 'branche', 'angebot', 'zielgruppe', 'region'],
      properties: {
        name: str('Firmenname, wie er auf der Website steht'),
        branche: str('Branche in 1–3 Wörtern'),
        angebot: str('Was angeboten wird, ein Satz'),
        zielgruppe: str('Für wen, ein Satz'),
        region: str('Einzugsgebiet, oder "überregional"'),
      },
    },
    urteile: {
      type: 'array' as const,
      description: `Genau ein Eintrag je Prüfpunkt (${MODEL_CRITERION_IDS.length} insgesamt), in der Reihenfolge des Katalogs`,
      items: {
        type: 'object' as const,
        additionalProperties: false,
        required: ['id', 'urteil', 'beleg'],
        properties: {
          id: { type: 'string' as const, enum: MODEL_CRITERION_IDS },
          urteil: { type: 'string' as const, enum: [...URTEILE] },
          beleg: str('Fundstelle: Seite und kurzes Zitat oder konkrete Beobachtung, höchstens zwei Sätze'),
        },
      },
    },
    befunde: {
      type: 'object' as const,
      additionalProperties: false,
      required: [...DIMENSION_KEYS],
      properties: Object.fromEntries(DIMENSION_KEYS.map(k => [k, str('2–4 Sätze: zuerst was trägt, dann die wichtigste Lücke mit Beleg')])),
    },
    staerken: { type: 'array' as const, items: str(), description: '3–5 konkrete Stärken mit Bezug zur Fundstelle' },
    massnahmen: {
      type: 'array' as const,
      description: '6–10 Massnahmen, die wichtigsten zuerst',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        required: ['titel', 'beschreibung', 'dimension', 'prioritaet', 'wirkung', 'zeithorizont', 'schritte'],
        properties: {
          titel: str('Konkret, als Handlung formuliert'),
          beschreibung: str('2–3 Sätze: warum, mit Bezug zum Befund'),
          dimension: { type: 'string' as const, enum: [...DIMENSION_KEYS] },
          prioritaet: { type: 'string' as const, enum: [...LEVELS] },
          wirkung: { type: 'string' as const, enum: [...LEVELS] },
          zeithorizont: { type: 'string' as const, enum: [...HORIZONTE] },
          schritte: { type: 'array' as const, items: str(), description: '2–4 konkrete Schritte: was genau, wo genau' },
        },
      },
    },
    textbeispiele: {
      type: 'array' as const,
      description: '0–3 echte Textstellen der Website mit Verbesserungsvorschlag. Leer, wenn nichts Lohnendes.',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        required: ['seite', 'vorher', 'nachher'],
        properties: {
          seite: str('Pfad der Seite'),
          vorher: str('Wörtliches Zitat'),
          nachher: str('Verbesserter Vorschlag'),
        },
      },
    },
    fazit: str('3 Sätze: Stand des Auftritts, grösster Hebel, nächster sinnvoller Schritt. Sachlich, ohne Alarmton.'),
  },
}

/** Was das Modell liefert — Form folgt dem Schema. */
export interface ModelOutput {
  firma: { name: string; branche: string; angebot: string; zielgruppe: string; region: string }
  urteile: { id: string; urteil: string; beleg: string }[]
  befunde: Record<string, string>
  staerken: string[]
  massnahmen: { titel: string; beschreibung: string; dimension: string; prioritaet: string; wirkung: string; zeithorizont: string; schritte: string[] }[]
  textbeispiele: { seite: string; vorher: string; nachher: string }[]
  fazit: string
}
