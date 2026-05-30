'use client'

import React, { ReactNode, useState, useRef, useEffect, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  activeTab: string
  onTabChange: (tabId: string) => void
  setIndicatorStyle: (style: { left: number; width: number }) => void
  indicatorStyle: { left: number; width: number }
  tabListRef: React.RefObject<HTMLDivElement | null>
  variant: 'underline' | 'pill'
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tab components must be used within a Tabs component')
  }
  return context
}

interface TabsProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  children: ReactNode
  className?: string
  variant?: 'underline' | 'pill'
}

interface TabListProps {
  children: ReactNode
  className?: string
}

interface TabProps {
  id: string
  label: string
  disabled?: boolean
}

interface TabPanelProps {
  id: string
  children: ReactNode
  className?: string
}

export function Tabs({ activeTab, onTabChange, children, className, variant = 'underline' }: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const tabListRef = useRef<HTMLDivElement>(null)

  const value: TabsContextType = {
    activeTab,
    onTabChange,
    setIndicatorStyle,
    indicatorStyle,
    tabListRef,
    variant,
  }

  return (
    <TabsContext.Provider value={value}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: TabListProps) {
  const { indicatorStyle, tabListRef, variant } = useTabsContext()

  if (variant === 'pill') {
    return (
      <div
        ref={tabListRef}
        role="tablist"
        className={cn(
          'inline-flex gap-1 rounded-full border border-[var(--color-rule)] bg-[var(--color-paper)] p-1',
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      ref={tabListRef}
      role="tablist"
      className={cn('relative flex border-b border-[var(--color-rule)] overflow-x-auto', className)}
    >
      {children}
      <div
        className="absolute bottom-0 h-0.5 bg-[var(--color-ink)] transition-all duration-300 ease-out"
        style={{ left: `${indicatorStyle.left}px`, width: `${indicatorStyle.width}px` }}
      />
    </div>
  )
}

export function Tab({ id, label, disabled = false }: TabProps) {
  const { activeTab, onTabChange, setIndicatorStyle, tabListRef, variant } = useTabsContext()
  const tabRef = useRef<HTMLButtonElement>(null)
  const isActive = activeTab === id

  useEffect(() => {
    if (variant !== 'underline') return
    if (isActive && tabRef.current && tabListRef.current) {
      setIndicatorStyle({ left: tabRef.current.offsetLeft, width: tabRef.current.offsetWidth })
    }
  }, [isActive, setIndicatorStyle, tabListRef, variant])

  const handleClick = () => {
    if (!disabled) onTabChange(id)
  }

  if (variant === 'pill') {
    return (
      <button
        ref={tabRef}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${id}`}
        id={`tab-${id}`}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'px-[10px] py-1 font-semibold text-[11px] -tracking-[0.005em] rounded-full whitespace-nowrap transition-all duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isActive
            ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
            : 'bg-transparent text-[var(--color-mute)] hover:text-[var(--color-ink)]'
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      ref={tabRef}
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'px-4 py-3 font-semibold text-[13px] -tracking-[0.01em] whitespace-nowrap transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? 'text-[var(--color-ink)]'
          : 'text-[var(--color-mute)] hover:text-[var(--color-ink)]'
      )}
    >
      {label}
    </button>
  )
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn('w-full', className)}
    >
      {children}
    </div>
  )
}
