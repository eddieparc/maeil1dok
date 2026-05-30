'use client'

interface AvatarProps {
  url?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-7 h-7 text-[11px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
}

export default function Avatar({ url, name, size = 'md' }: AvatarProps) {
  const sizeClass = sizes[size]
  const initial = name?.charAt(0)?.toUpperCase() || '?'

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-[var(--color-rule)]`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--color-paper-warm)] border border-[var(--color-rule)]`}
    >
      <span className="font-semibold text-[var(--color-ink)] -tracking-[0.01em]">{initial}</span>
    </div>
  )
}
