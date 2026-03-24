import { useEffect } from 'react';

export type ShortcutContext = {
  /** Called when `n` is pressed. Context-aware: depends on current view. */
  onNew?: () => void;
  /** Called when `e` is pressed. */
  onEdit?: () => void;
  /** Called when `?` is pressed. */
  onShowShortcuts?: () => void;
  /** Called when Cmd/Ctrl+S is pressed (save). */
  onSave?: () => void;
  /** Called when Cmd/Ctrl+P is pressed (PDF export). */
  onExportPdf?: () => void;
  /** Called when Backspace or Delete is pressed. */
  onDelete?: () => void;
};

/**
 * Registers global keyboard shortcuts. Safe to call in a top-level component;
 * ignores keypresses when focus is on an input, textarea, or select element.
 */
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

      // Cmd/Ctrl+S — save
      if (isMod && e.key === 's') {
        e.preventDefault();
        context.onSave?.();
        return;
      }

      // Cmd/Ctrl+P — PDF export
      if (isMod && e.key === 'p') {
        e.preventDefault();
        context.onExportPdf?.();
        return;
      }

      // Remaining shortcuts only when not in text editing context
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
