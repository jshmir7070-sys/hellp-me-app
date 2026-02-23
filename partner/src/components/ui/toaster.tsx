import * as React from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== Toast Types ====================

export type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

// ==================== Variant Config ====================

const VARIANT_CONFIG: Record<ToastVariant, {
  headerBg: string;
  borderColor: string;
  icon: React.ReactNode;
  iconBg: string;
  progressBg: string;
  label: string;
}> = {
  success: {
    headerBg: "bg-emerald-500",
    borderColor: "border-l-emerald-500",
    icon: <CheckCircle2 className="h-5 w-5 text-white" />,
    iconBg: "bg-emerald-600",
    progressBg: "bg-emerald-500",
    label: "완료",
  },
  error: {
    headerBg: "bg-red-500",
    borderColor: "border-l-red-500",
    icon: <XCircle className="h-5 w-5 text-white" />,
    iconBg: "bg-red-600",
    progressBg: "bg-red-500",
    label: "오류",
  },
  warning: {
    headerBg: "bg-amber-500",
    borderColor: "border-l-amber-500",
    icon: <AlertTriangle className="h-5 w-5 text-white" />,
    iconBg: "bg-amber-600",
    progressBg: "bg-amber-500",
    label: "주의",
  },
  info: {
    headerBg: "bg-blue-500",
    borderColor: "border-l-blue-500",
    icon: <Info className="h-5 w-5 text-white" />,
    iconBg: "bg-blue-600",
    progressBg: "bg-blue-500",
    label: "알림",
  },
};

// ==================== State Management ====================

interface ToastState {
  toasts: ToastItem[];
}

const toastState: ToastState = { toasts: [] };
const listeners: Array<() => void> = [];

function emitChange() {
  listeners.forEach((listener) => listener());
}

/**
 * 토스트 표시 함수
 * 기존 variant ("default" | "destructive") 와도 호환됨
 */
export function toast({
  title,
  description,
  variant = "info",
}: {
  title?: string;
  description?: string;
  variant?: ToastVariant | "default" | "destructive";
}) {
  // 기존 variant 호환 맵핑
  let mappedVariant: ToastVariant = "info";
  if (variant === "destructive" || variant === "error") mappedVariant = "error";
  else if (variant === "success") mappedVariant = "success";
  else if (variant === "warning") mappedVariant = "warning";
  else if (variant === "info" || variant === "default") mappedVariant = "info";

  const id = Math.random().toString(36).slice(2);
  toastState.toasts = [...toastState.toasts, { id, title, description, variant: mappedVariant }];
  emitChange();

  setTimeout(() => {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
    emitChange();
  }, 4500);
}

function dismissToast(id: string) {
  toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
  emitChange();
}

// ==================== Toast Card Component ====================

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const config = VARIANT_CONFIG[item.variant];
  const [isExiting, setIsExiting] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-[400px] overflow-hidden rounded-xl shadow-2xl border-l-4 bg-white transition-all duration-300 ease-out",
        config.borderColor,
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0"
      )}
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
    >
      <div className={cn("flex items-center gap-2.5 px-4 py-3", config.headerBg)}>
        <div className={cn("flex items-center justify-center w-7 h-7 rounded-full shrink-0", config.iconBg)}>
          {config.icon}
        </div>
        <span className="text-sm font-bold flex-1 text-white">
          {item.title || config.label}
        </span>
        <button
          onClick={handleDismiss}
          className="p-0.5 rounded-full hover:bg-white/20 transition-colors shrink-0"
        >
          <X className="h-4 w-4 text-white/80 hover:text-white" />
        </button>
      </div>

      {item.description && (
        <div className="px-4 py-3.5 bg-white">
          <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
        </div>
      )}

      <div className="h-1 bg-gray-100 overflow-hidden">
        <div
          className={cn("h-full rounded-r-full", config.progressBg)}
          style={{
            animation: "toast-shrink 4.5s linear forwards",
          }}
        />
      </div>
    </div>
  );
}

// ==================== Toaster (Root Component) ====================

export function Toaster() {
  const [toasts, setToasts] = React.useState(toastState.toasts);

  React.useEffect(() => {
    const listener = () => setToasts([...toastState.toasts]);
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes toast-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-3">
        {toasts.slice(0, 3).map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={() => dismissToast(item.id)}
          />
        ))}
      </div>
    </>
  );
}
