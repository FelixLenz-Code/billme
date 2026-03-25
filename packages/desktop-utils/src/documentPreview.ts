import { replacePlaceholders, type AppSettingsLike } from './placeholders';

type PreviewInvoiceItem = {
  description: string;
  quantity: number;
  price: number;
  total: number;
};

type InvoiceForPreview = {
  number: string;
  date?: string;
  dueDate?: string;
  servicePeriod?: string;
  client: string;
  clientNumber?: string;
  clientAddress?: string;
  clientEmail?: string;
  items: PreviewInvoiceItem[];
};

type TableColumnLike = {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  align: 'left' | 'center' | 'right';
};

type TableRowLike = {
  id: string;
  cells: string[];
};

type InvoiceElementLike = {
  type?: string;
  label?: string;
  content?: string;
  tableData?: {
    columns?: TableColumnLike[];
    rows?: TableRowLike[];
  };
  [key: string]: unknown;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

export const getPreviewElements = (
  invoice: InvoiceForPreview,
  template: InvoiceElementLike[],
  settings: AppSettingsLike,
): InvoiceElementLike[] => {
  return template.map((el) => {
    if (el.label === 'items_table' || el.type === 'TABLE') {
      const rows = invoice.items.map((item, idx) => ({
        id: idx.toString(),
        cells: [
          (idx + 1).toString(),
          item.description,
          `${item.quantity}`,
          formatCurrency(item.price),
          formatCurrency(item.total),
        ],
      }));
      return {
        ...el,
        tableData: {
          columns: el.tableData?.columns || [
            { id: 'pos', label: 'Pos.', width: 40, visible: true, align: 'left' },
            { id: 'desc', label: 'Bezeichnung', width: 280, visible: true, align: 'left' },
            { id: 'qty', label: 'Menge', width: 60, visible: true, align: 'right' },
            { id: 'price', label: 'Einzelpreis', width: 90, visible: true, align: 'right' },
            { id: 'total', label: 'Gesamt', width: 90, visible: true, align: 'right' },
          ],
          rows,
        },
      };
    }

    if (el.type === 'TEXT' && typeof el.content === 'string') {
      return {
        ...el,
        content: replacePlaceholders(el.content, invoice, settings),
      };
    }

    return el;
  });
};
