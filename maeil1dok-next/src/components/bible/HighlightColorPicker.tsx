'use client'

import type { HighlightColor } from '@/types'

interface HighlightColorPickerProps {
  onSelect: (color: HighlightColor) => void
  selectedColor?: HighlightColor
}

const COLOR_OPTIONS: Array<{ color: HighlightColor; className: string; label: string }> = [
  { color: 'yellow', className: 'bg-yellow-300', label: '노랑' },
  { color: 'green', className: 'bg-green-300', label: '초록' },
  { color: 'blue', className: 'bg-blue-300', label: '파랑' },
  { color: 'pink', className: 'bg-pink-300', label: '분홍' },
  { color: 'purple', className: 'bg-purple-300', label: '보라' },
]

export default function HighlightColorPicker({ onSelect, selectedColor }: HighlightColorPickerProps) {
  return (
    <div className="px-3 pb-2 pt-1">
      <p className="mb-2 text-xs font-medium text-gray-500">하이라이트 색상</p>
      <div className="flex items-center gap-2">
        {COLOR_OPTIONS.map((option) => (
          <button
            key={option.color}
            type="button"
            className={`h-6 w-6 rounded-full border transition hover:scale-105 ${option.className} ${
              selectedColor === option.color ? 'border-gray-800 ring-2 ring-gray-300' : 'border-gray-300'
            }`}
            aria-label={`${option.label} 하이라이트`}
            onClick={() => onSelect(option.color)}
          />
        ))}
      </div>
    </div>
  )
}
