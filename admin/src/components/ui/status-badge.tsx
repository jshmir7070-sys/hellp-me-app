/**
 * 상태 배지 컴포넌트
 * - 오더, 정산, 승인 등의 상태를 시각적으로 표시
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Package,
  Truck,
  DollarSign,
} from "lucide-react";

export type StatusType =
  | "pending"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "waiting"
  | "confirmed"
  | "paid"
  | "unpaid";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: any;
  }
> = {
  // 승인 관련
  pending: {
    label: "대기중",
    variant: "outline",
    className: "border-yellow-500 text-yellow-700 bg-yellow-50",
    icon: Clock,
  },
  approved: {
    label: "승인됨",
    variant: "default",
    className: "bg-green-500 text-white",
    icon: CheckCircle2,
  },
  rejected: {
    label: "거부됨",
    variant: "destructive",
    className: "bg-red-500 text-white",
    icon: XCircle,
  },

  // 진행 상태
  waiting: {
    label: "대기",
    variant: "secondary",
    className: "bg-gray-200 text-gray-700",
    icon: Clock,
  },
  in_progress: {
    label: "진행중",
    variant: "default",
    className: "bg-blue-500 text-white",
    icon: Loader2,
  },
  completed: {
    label: "완료",
    variant: "default",
    className: "bg-green-600 text-white",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "취소됨",
    variant: "secondary",
    className: "bg-gray-400 text-white",
    icon: XCircle,
  },

  // 오더 상태
  registered: {
    label: "등록됨",
    variant: "outline",
    className: "border-blue-500 text-blue-700 bg-blue-50",
    icon: Package,
  },
  matching: {
    label: "매칭중",
    variant: "outline",
    className: "border-purple-500 text-purple-700 bg-purple-50",
    icon: Truck,
  },
  scheduled: {
    label: "예정",
    variant: "default",
    className: "bg-indigo-500 text-white",
    icon: Clock,
  },

  // 결제 상태
  paid: {
    label: "입금완료",
    variant: "default",
    className: "bg-green-500 text-white",
    icon: DollarSign,
  },
  unpaid: {
    label: "미입금",
    variant: "destructive",
    className: "bg-orange-500 text-white",
    icon: AlertCircle,
  },
  confirmed: {
    label: "확인됨",
    variant: "default",
    className: "bg-teal-500 text-white",
    icon: CheckCircle2,
  },
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
  size = "md",
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    variant: "secondary" as const,
    className: "",
    icon: AlertCircle,
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <Badge variant={config.variant} className={cn(config.className, sizeClasses[size])}>
      {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />}
      {label || config.label}
    </Badge>
  );
}

// 우선순위 배지
export function PriorityBadge({ priority }: { priority: number | "긴급" | "높음" | "보통" | "낮음" }) {
  const priorityMap = {
    1: { label: "긴급", className: "bg-red-600 text-white" },
    2: { label: "높음", className: "bg-orange-500 text-white" },
    3: { label: "보통", className: "bg-blue-500 text-white" },
    4: { label: "낮음", className: "bg-gray-400 text-white" },
    긴급: { label: "긴급", className: "bg-red-600 text-white" },
    높음: { label: "높음", className: "bg-orange-500 text-white" },
    보통: { label: "보통", className: "bg-blue-500 text-white" },
    낮음: { label: "낮음", className: "bg-gray-400 text-white" },
  };

  const config = priorityMap[priority] || priorityMap[3];

  return (
    <Badge className={cn("text-xs font-semibold", config.className)}>
      {config.label}
    </Badge>
  );
}

// 금액 배지 (높음/보통/낮음)
export function AmountBadge({ amount }: { amount: number }) {
  const config =
    amount >= 500000
      ? { label: "고액", className: "bg-purple-600 text-white" }
      : amount >= 100000
      ? { label: "중액", className: "bg-blue-500 text-white" }
      : { label: "소액", className: "bg-gray-400 text-white" };

  return (
    <Badge className={cn("text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
