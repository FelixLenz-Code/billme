export const normalizeGermanText = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');

export const normalizeLooseText = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

export const includesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));
