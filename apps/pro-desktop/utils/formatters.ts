import type { ClientAddress } from '../types';
import {
  formatAddressLines as sharedFormatAddressLines,
  formatAddressMultiline as sharedFormatAddressMultiline,
  formatCurrency,
  formatDate,
} from '@billme/desktop-utils/formatters';

type AddressSubset = Pick<
  ClientAddress,
  'street' | 'line2' | 'zip' | 'city' | 'country' | 'company' | 'contactPerson'
>;

export const formatAddressLines = (a: AddressSubset): string[] => sharedFormatAddressLines(a);
export const formatAddressMultiline = (a: AddressSubset): string => sharedFormatAddressMultiline(a);
export { formatCurrency, formatDate };

