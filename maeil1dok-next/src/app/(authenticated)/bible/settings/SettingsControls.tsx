'use client'

interface ToggleItemProps {
  title: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  isLast?: boolean
}

export function ToggleItem({ title, description, checked, onChange, isLast = false }: ToggleItemProps) {
  return (
    <div className={['flex items-center justify-between py-2.5', !isLast ? 'border-b border-[var(--color-border-light,#f0f0f0)]' : ''].join(' ')}>
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.9375rem] font-medium text-[var(--color-text-primary,#111)]">{title}</span>
        {description ? <span className="text-xs text-[var(--color-text-muted,#9ca3af)]">{description}</span> : null}
      </div>
      <label className="relative inline-block h-[26px] w-[44px] shrink-0">
        <input type="checkbox" className="h-0 w-0 opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
         <span className={['absolute inset-0 cursor-pointer rounded-full transition-colors duration-200', checked ? 'bg-[var(--color-accent-primary,#4B9F7E)]' : 'bg-[var(--color-border-default,#e5e7eb)]'].join(' ')}>
          <span className={['absolute bottom-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0'].join(' ')} />
        </span>
      </label>
    </div>
  )
}

interface DangerButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  variant?: 'default' | 'reset'
}

export function DangerButton({ label, disabled, onClick, variant = 'default' }: DangerButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
         variant === 'reset'
           ? 'border-[var(--color-error,#ef4444)] text-[var(--color-error,#ef4444)] hover:bg-[var(--color-error,#ef4444)] hover:text-white'
           : 'border-[var(--color-border-default,#e5e7eb)] bg-[var(--color-bg-card,#fff)] text-[var(--color-text-secondary,#6b7280)] hover:border-[var(--color-error,#ef4444)] hover:bg-[var(--color-error-bg,#fee2e2)] hover:text-[var(--color-error,#ef4444)]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
