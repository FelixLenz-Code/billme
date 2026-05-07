import { includesAny, normalizeGermanText } from './text';

export interface KeywordSuggestion {
  code?: string;
  reason?: string;
}

export interface KeywordSuggestionInput {
  flowType: 'income' | 'expense';
  text: string;
}

export const suggestEurCodeByKeywords = (input: KeywordSuggestionInput): KeywordSuggestion => {
  const text = normalizeGermanText(input.text);

  const hit = (code: string, reason: string): KeywordSuggestion => ({ code, reason });

  if (input.flowType === 'income') {
    if (includesAny(text, ['steuererstattung', 'erstattung umsatzsteuer'])) {
      return hit('141', 'Steuererstattung erkannt');
    }
    if (includesAny(text, ['umsatzsteuer', 'ust'])) {
      return hit('140', 'USt-Hinweis erkannt');
    }
    return hit('112', 'Standard Betriebseinnahme');
  }

  if (includesAny(text, ['miete', 'pacht', 'cowork'])) return hit('150', 'Miete/Pacht erkannt');
  if (includesAny(text, ['telefon', 'internet', 'hosting', 'domain'])) return hit('280', 'Telekommunikation erkannt');
  if (includesAny(text, ['software', 'saas', 'lizenz', 'cloud'])) return hit('228', 'EDV-Kosten erkannt');
  if (includesAny(text, ['steuerberater', 'buchhaltung', 'anwalt', 'rechtsanwalt'])) return hit('194', 'Beratungsleistung erkannt');
  if (includesAny(text, ['google ads', 'facebook ads', 'werbung', 'marketing'])) return hit('224', 'Werbung/Marketing erkannt');
  if (includesAny(text, ['hotel', 'reise', 'bahn', 'flug'])) return hit('221', 'Reisekosten erkannt');
  if (includesAny(text, ['kfz', 'tank', 'diesel', 'parken'])) return hit('146', 'Kfz/Fahrtkosten erkannt');
  if (includesAny(text, ['versicherung', 'beitrag', 'gebuehr'])) return hit('223', 'Gebuehren/Versicherungen erkannt');
  if (includesAny(text, ['zins', 'kredit'])) return hit('234', 'Zinsen erkannt');
  if (includesAny(text, ['vorsteuer'])) return hit('185', 'Vorsteuer erkannt');

  return hit('183', 'Sonstige Betriebsausgabe als Fallback');
};
