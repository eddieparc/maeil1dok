'use client'

import React, { ReactNode, useState, useRef, useEffect, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  activeTab: string
  onTabChange: (tabId: string) => void
  setIndicatorStyle: (style: { left: number; width: number }) => void
  indicatorStyle: { left: number; width: number }
  tabListRef: React.RefObject<HTMLDivElement | null>
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

/**
 * Tabs component with animated indicator
 * Supports composable sub-components: TabList, Tab, TabPanel
 * Implements WAI-ARIA tabs pattern
 */
export function Tabs({ activeTab, onTabChange, children, className }: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number
    width: number
  }>({ left: 0, width: 0 })
  const tabListRef = useRef<HTMLDivElement>(null)

  const value: TabsContextType = {
    activeTab,
    onTabChange,
    setIndicatorStyle,
    indicatorStyle,
    tabListRef,
  }

  return (
    <TabsContext.Provider value={value}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

/**
 * TabList - Container for Tab components
 * Implements role="tablist" for accessibility
 */
export function TabList({ children, className }: TabListProps) {
  const { indicatorStyle, tabListRef } = useTabsContext()

  return (
    <div
      ref={tabListRef}
      role="tablist"
      className={cn(
        'relative flex border-b border-[var(--color-border-default)] overflow-x-auto',
        className
      )}
    >
      {children}

      {/* Animated indicator */}
      <div
        className="absolute bottom-0 h-0.5 bg-[var(--color-primary)] transition-all duration-300 ease-out"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
        }}
      />
    </div>
  )
}

/**
 * Tab - Individual tab button
 * Implements role="tab" and aria-selected for accessibility
 */
export function Tab({ id, label, disabled = false }: TabProps) {
  const { activeTab, onTabChange, setIndicatorStyle, tabListRef } = useTabsContext()
  const tabRef = useRef<HTMLButtonElement>(null)

  const isActive = activeTab === id

  useEffect(() => {
    if (isActive && tabRef.current && tabListRef.current) {
      setIndicatorStyle({
        left: tabRef.current.offsetLeft,
        width: tabRef.current.offsetWidth,
      })
    }
  }, [isActive, setIndicatorStyle, tabListRef])

  const handleClick = () => {
    if (!disabled) {
      onTabChange(id)
    }
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
        'px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isActive
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {label}
    </button>
  )
}

/**
 * TabPanel - Content area for a tab
 * Implements role="tabpanel" and aria-labelledby for accessibility
 */
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
