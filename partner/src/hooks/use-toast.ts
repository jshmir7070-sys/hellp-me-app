import * as React from "react"
import { toast as toasterToast } from "@/components/ui/toaster"

/**
 * useToast hook - toaster.tsx의 새 토스트 시스템으로 위임
 * 기존 코드 호환을 위해 동일한 인터페이스 유지
 *
 * variant 매핑:
 *   "default" → "info" (파란색)
 *   "destructive" → "error" (빨간색)
 *   "success" → "success" (초록색)
 *   "warning" → "warning" (노란색)
 */

type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success" | "warning" | "info" | "error"
}

type Toast = Omit<ToasterToast, "id">

function toast({ title, description, variant = "default" }: Toast) {
  toasterToast({
    title: typeof title === 'string' ? title : title?.toString(),
    description: typeof description === 'string' ? description : description?.toString(),
    variant: variant as any,
  })

  return {
    id: Math.random().toString(36).slice(2),
    dismiss: () => {},
    update: () => {},
  }
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (_toastId?: string) => {},
  }
}

export { useToast, toast }
