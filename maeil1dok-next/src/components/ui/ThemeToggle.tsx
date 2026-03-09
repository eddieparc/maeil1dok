'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleToggle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className={cn(
          'rounded-full p-2',
          'transition-colors duration-200',
          'hover:bg-[var(--color-button-hover)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]'
        )}
      >
        <span className="inline-block h-5 w-5" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Current theme: ${theme}. Click to switch.`}
      className={cn(
        'rounded-full p-2',
        'transition-colors duration-200',
        'hover:bg-[var(--color-button-hover)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]'
      )}
    >
      {theme === 'light' && <Sun className="h-5 w-5" />}
      {theme === 'dark' && <Moon className="h-5 w-5" />}
      {theme === 'system' && <Monitor className="h-5 w-5" />}
    </button>
  )
}
