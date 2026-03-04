'use client'

import { cn } from '@/lib/utils'
import type { HighlightColor } from '@/types'

interface HighlightColorPickerProps {
  onSelect: (color: HighlightColor) => void
  selectedColor?: HighlightColor
}

const COLOR_OPTIONS: Array<{ color: HighlightColor; hex: string; label: string }> = [
  { color: 'yellow', hex: '#FEF3C7', label: '노랑' },
  { color: 'green', hex: '#D1FAE5', label: '초록' },
  { color: 'blue', hex: '#DBEAFE', label: '파랑' },
  { color: 'pink', hex: '#FCE7F3', label: '분홍' },
  { color: 'purple', hex: '#E9D5FF', label: '보라' },
]

export default function HighlightColorPicker({ onSelect, selectedColor }: HighlightColorPickerProps) {
  return (
    <div className="rounded-lg p-2">
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((option) => (
          <button
            key={option.color}
            type="button"
            className={cn(
              'h-8 w-8 rounded-full border-2 transition duration-200 hover:scale-110',
              selectedColor === option.color
                ? 'border-[var(--color-accent-primary)] shadow-[0_0_0_2px_var(--color-bg-primary),0_0_0_4px_var(--color-accent-primary)]'
                : 'border-transparent'
            )}
            style={{ backgroundColor: option.hex }}
            aria-label={`${option.label} 하이라이트`}
            onClick={() => onSelect(option.color)}
          />
        ))}
      </div>
    </div>
  )
}
