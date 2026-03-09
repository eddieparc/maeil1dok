'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface HydrationGateProps {
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Zustand persist 미들웨어의 비동기 rehydration을 기다리는 컴포넌트
 * rehydration 전에는 fallback을 렌더링하여 테마 깜빡임 등을 방지합니다.
 */
export function HydrationGate({ children, fallback = null }: HydrationGateProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  if (!isHydrated) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
