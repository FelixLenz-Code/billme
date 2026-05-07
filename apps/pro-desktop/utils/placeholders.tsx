import type { AppSettings, Invoice } from '../types';
import {
  VARIABLE_GROUPS,
  replacePlaceholders as sharedReplacePlaceholders,
  renderTextWithPlaceholders,
} from '@billme/desktop-utils/placeholders';

export { VARIABLE_GROUPS, renderTextWithPlaceholders };
export const replacePlaceholders = (text: string, invoice: Invoice, settings: AppSettings): string =>
  sharedReplacePlaceholders(text, invoice, settings);

