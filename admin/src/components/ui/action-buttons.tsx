/**
 * 액션 버튼 그룹 컴포넌트
 * - 일괄 승인/거부/처리 버튼
 * - 빠른 액션 버튼
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Download,
  Upload,
  Send,
  Eye,
  Edit,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BatchActionsProps {
  selectedCount: number;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  onCustomAction?: (action: string) => void;
  customActions?: Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    variant?: "default" | "destructive" | "outline";
  }>;
  loading?: boolean;
}

export function BatchActions({
  selectedCount,
  onApprove,
  onReject,
  onDelete,
  onCustomAction,
  customActions = [],
  loading = false,
}: BatchActionsProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<{
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  const handleAction = (title: string, description: string, action: () => void) => {
    setConfirmAction({ title, description, action });
    setShowConfirm(true);
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm font-medium text-blue-900">
          {selectedCount}개 선택됨
        </span>
        <div className="flex-1" />

        {onApprove && (
          <Button
            size="sm"
            variant="default"
            onClick={() =>
              handleAction(
                "일괄 승인",
                `선택한 ${selectedCount}개 항목을 승인하시겠습니까?`,
                onApprove
              )
            }
            disabled={loading}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            일괄 승인
          </Button>
        )}

        {onReject && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleAction(
                "일괄 거부",
                `선택한 ${selectedCount}개 항목을 거부하시겠습니까?`,
                onReject
              )
            }
            disabled={loading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            일괄 거부
          </Button>
        )}

        {onDelete && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              handleAction(
                "일괄 삭제",
                `선택한 ${selectedCount}개 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                onDelete
              )
            }
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            일괄 삭제
          </Button>
        )}

        {customActions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant || "outline"}
            onClick={() => onCustomAction?.(action.key)}
            disabled={loading}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.action();
                setShowConfirm(false);
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 행 액션 메뉴
interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  customActions?: Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    variant?: "default" | "destructive";
  }>;
  onCustomAction?: (key: string) => void;
}

export function RowActions({
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  customActions = [],
  onCustomAction,
}: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            상세보기
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            수정
          </DropdownMenuItem>
        )}
        {onApprove && (
          <DropdownMenuItem onClick={onApprove}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            승인
          </DropdownMenuItem>
        )}
        {onReject && (
          <DropdownMenuItem onClick={onReject}>
            <XCircle className="mr-2 h-4 w-4" />
            거부
          </DropdownMenuItem>
        )}
        {customActions.map((action) => (
          <DropdownMenuItem
            key={action.key}
            onClick={() => onCustomAction?.(action.key)}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
        {(onView || onEdit || onApprove || onReject) && onDelete && (
          <DropdownMenuSeparator />
        )}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            삭제
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// 빠른 액션 버튼
interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary";
  count?: number;
  loading?: boolean;
}

export function QuickAction({
  label,
  icon,
  onClick,
  variant = "outline",
  count,
  loading = false,
}: QuickActionProps) {
  return (
    <Button
      variant={variant}
      className="relative"
      onClick={onClick}
      disabled={loading}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
