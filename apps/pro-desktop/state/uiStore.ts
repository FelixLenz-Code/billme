import { create } from 'zustand';
import { Invoice } from '../types';

export interface UiState {
  editingInvoice: Invoice | null;
  editingDocumentType: 'invoice' | 'offer' | null;
  editingDocumentMode: 'create' | 'edit' | null;
  editorSidebarCollapsed: boolean;

  setEditingInvoice: (invoice: Invoice, type: 'invoice' | 'offer', mode?: 'create' | 'edit') => void;
  clearEditingInvoice: () => void;
  setEditorSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  editingInvoice: null,
  editingDocumentType: null,
  editingDocumentMode: null,
  editorSidebarCollapsed: false,

  setEditingInvoice: (invoice, type, mode = 'edit') =>
    set({ editingInvoice: invoice, editingDocumentType: type, editingDocumentMode: mode }),
  clearEditingInvoice: () =>
    set({
      editingInvoice: null,
      editingDocumentType: null,
      editingDocumentMode: null,
    }),
  setEditorSidebarCollapsed: (collapsed) => set({ editorSidebarCollapsed: collapsed }),
}));
