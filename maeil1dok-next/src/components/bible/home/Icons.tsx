'use client'

import { cn } from '@/lib/utils'

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-1.14 1.603-1.14 1.902 0a1 1 0 00.95.69 1 1 0 011.12.743 1 1 0 001.341.667c1.004-.468 1.926.454 1.458 1.458a1 1 0 00.667 1.34 1 1 0 01.743 1.121 1 1 0 00.69.95c1.14.3 1.14 1.603 0 1.902a1 1 0 00-.69.95 1 1 0 01-.743 1.12 1 1 0 00-.667 1.341c.468 1.004-.454 1.926-1.458 1.458a1 1 0 00-1.34.667 1 1 0 01-1.121.743 1 1 0 00-.95.69c-.3 1.14-1.603 1.14-1.902 0a1 1 0 00-.95-.69 1 1 0 01-1.12-.743 1 1 0 00-1.341-.667c-1.004.468-1.926-.454-1.458-1.458a1 1 0 00-.667-1.34 1 1 0 01-.743-1.121 1 1 0 00-.69-.95c-1.14-.3-1.14-1.603 0-1.902a1 1 0 00.69-.95 1 1 0 01.743-1.12 1 1 0 00.667-1.341c-.468-1.004.454-1.926 1.458-1.458a1 1 0 001.34-.667 1 1 0 011.121-.743 1 1 0 00.95-.69z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export function ListIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-5 w-5', className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
    </svg>
  )
}
