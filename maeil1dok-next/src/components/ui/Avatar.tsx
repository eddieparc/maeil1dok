'use client'

interface AvatarProps {
  url?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-20 h-20 text-2xl',
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-indigo-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export default function Avatar({ url, name, size = 'md' }: AvatarProps) {
  const sizeClass = sizes[size]
  const initial = name?.charAt(0)?.toUpperCase() || '?'

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${getColorFromName(name)} rounded-full flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-white font-semibold">{initial}</span>
    </div>
  )
}
