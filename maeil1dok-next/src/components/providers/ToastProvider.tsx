'use client'

import {
  createContext,
  type ReactNode,
} from 'react'
import { Toast } from '@/components/ui/Toast'
import { useToastState, type ToastContextValue } from '@/hooks/useToast'

interface ToastProviderProps {
  children: ReactNode
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: ToastProviderProps) {
  const value = useToastState()

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast toasts={value.toasts} dismiss={value.dismiss} />
    </ToastContext.Provider>
  )
}
