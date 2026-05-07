import { useEffect } from 'react';

export type ShortcutContext = {
  onNew?: () => void;
  onEdit?: () => void;
  onShowShortcuts?: () => void;
  onSave?: () => void;
  onExportPdf?: () => void;
  onDelete?: () => void;
};

export const useKeyboardShortcuts = (context: ShortcutContext): void => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 's') {
        e.preventDefault();
        context.onSave?.();
        return;
      }

      if (isMod && e.key === 'p') {
        e.preventDefault();
        context.onExportPdf?.();
        return;
      }

      if (isEditing) return;

      if (e.key === '?') {
        e.preventDefault();
        context.onShowShortcuts?.();
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        context.onNew?.();
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        context.onEdit?.();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        context.onDelete?.();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [context]);
};
