// Notification system types

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'helper' | 'requester';

export interface ToastConfig {
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number; // Default 4000ms
  onDismiss?: () => void;
}

export interface ToastInstance {
  id: string;
  config: ToastConfig;
  createdAt: number;
}

export type AlertIconType = 'info' | 'warning' | 'error' | 'question';
export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

export interface AlertConfig {
  title: string;
  message: string;
  icon?: AlertIconType;
  buttons: AlertButton[];
  cancelable?: boolean; // Whether tapping backdrop dismisses alert
}

export interface AlertInstance {
  id: string;
  config: AlertConfig;
}

export interface NotificationState {
  toasts: ToastInstance[];
  alert: AlertInstance | null;
}

// Context API
export interface NotificationContextValue {
  showToast: (config: ToastConfig) => string;
  showAlert: (config: AlertConfig) => void;
  dismissToast: (id: string) => void;
  dismissAlert: () => void;

  // Convenience methods
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  confirm: (config: {
    title: string;
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => void;
}

// Reducer actions
export type NotificationAction =
  | { type: 'ADD_TOAST'; payload: ToastInstance }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'SHOW_ALERT'; payload: AlertInstance }
  | { type: 'DISMISS_ALERT' };
