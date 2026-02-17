import React, { createContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { NotificationContainer } from '../components/notifications';
import type {
  NotificationState,
  NotificationAction,
  NotificationContextValue,
  ToastConfig,
  AlertConfig,
  ToastInstance,
  AlertInstance,
} from '../types/notification';

// Create context
export const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Initial state
const initialState: NotificationState = {
  toasts: [],
  alert: null,
};

// Reducer
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_TOAST':
      // Maximum 3 toasts, remove oldest if needed
      const toasts = state.toasts.length >= 3
        ? [...state.toasts.slice(1), action.payload]
        : [...state.toasts, action.payload];
      return { ...state, toasts };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload),
      };

    case 'SHOW_ALERT':
      return { ...state, alert: action.payload };

    case 'DISMISS_ALERT':
      return { ...state, alert: null };

    default:
      return state;
  }
}

// ID generator
let toastIdCounter = 0;
function generateId(): string {
  return `notification-${Date.now()}-${toastIdCounter++}`;
}

// Provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Show toast
  const showToast = useCallback((config: ToastConfig): string => {
    const id = generateId();
    const instance: ToastInstance = {
      id,
      config,
      createdAt: Date.now(),
    };

    dispatch({ type: 'ADD_TOAST', payload: instance });

    // Set auto-dismiss timer
    const duration = config.duration ?? 4000;
    const timer = setTimeout(() => {
      dismissToast(id);
      config.onDismiss?.();
    }, duration);

    timersRef.current.set(id, timer);
    return id;
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    // Clear timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  // Show alert
  const showAlert = useCallback((config: AlertConfig) => {
    const id = generateId();
    const instance: AlertInstance = {
      id,
      config,
    };

    dispatch({ type: 'SHOW_ALERT', payload: instance });
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback(() => {
    dispatch({ type: 'DISMISS_ALERT' });
  }, []);

  // Convenience methods
  const success = useCallback((message: string, title?: string): string => {
    return showToast({ variant: 'success', message, title });
  }, [showToast]);

  const error = useCallback((message: string, title?: string): string => {
    return showToast({ variant: 'error', message, title });
  }, [showToast]);

  const warning = useCallback((message: string, title?: string): string => {
    return showToast({ variant: 'warning', message, title });
  }, [showToast]);

  const info = useCallback((message: string, title?: string): string => {
    return showToast({ variant: 'info', message, title });
  }, [showToast]);

  const confirm = useCallback((config: {
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => {
    showAlert({
      title: config.title,
      message: config.message,
      buttons: [
        { text: '취소', style: 'cancel', onPress: config.onCancel },
        { text: '확인', style: 'default', onPress: config.onConfirm },
      ],
      cancelable: true,
    });
  }, [showAlert]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const contextValue: NotificationContextValue = {
    showToast,
    showAlert,
    dismissToast,
    dismissAlert,
    success,
    error,
    warning,
    info,
    confirm,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer
        toasts={state.toasts}
        alert={state.alert}
        onDismissToast={dismissToast}
        onDismissAlert={dismissAlert}
      />
    </NotificationContext.Provider>
  );
}
