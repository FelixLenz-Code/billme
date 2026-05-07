import { useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'destructive' | 'warning' | 'success';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  message: string;
  type: ToastType;
  isVisible: boolean;
}

export const useToast = () => {
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  const toast = useCallback((options: ToastOptions) => {
    const { title = '', description = '', variant = 'default', duration = 3000 } = options;

    const message = title && description
      ? `${title}: ${description}`
      : title || description || 'Notification';

    const typeMap: Record<ToastVariant, ToastType> = {
      default: 'info',
      success: 'success',
      destructive: 'error',
      warning: 'warning',
    };

    const type = typeMap[variant];

    setToastState({
      message,
      type,
      isVisible: true,
    });

    if (duration > 0) {
      setTimeout(() => {
        setToastState(prev => ({ ...prev, isVisible: false }));
      }, duration);
    }
  }, []);

  const closeToast = useCallback(() => {
    setToastState(prev => ({ ...prev, isVisible: false }));
  }, []);

  return {
    toast,
    toastState,
    closeToast,
  };
};
