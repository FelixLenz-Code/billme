import { create } from 'zustand';

export interface BaseUiState<TInvoice> {
  editingInvoice: TInvoice | null;
  editingDocumentType: 'invoice' | 'offer' | null;
  editingDocumentMode: 'create' | 'edit' | null;
  editorSidebarCollapsed: boolean;
  setEditingInvoice: (invoice: TInvoice, type: 'invoice' | 'offer', mode?: 'create' | 'edit') => void;
  clearEditingInvoice: () => void;
  setEditorSidebarCollapsed: (collapsed: boolean) => void;
}

export const createUiStore = <TInvoice>() =>
  create<BaseUiState<TInvoice>>((set) => ({
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
