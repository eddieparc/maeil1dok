'use client'

export default function ChapterSkeleton() {
  return (
    <div className="space-y-3 animate-pulse p-5">
      <div className="h-4 w-2/5 rounded bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-full rounded bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-[94%] rounded bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-[88%] rounded bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-[91%] rounded bg-[var(--color-bg-tertiary)]" />
      <div className="h-4 w-3/4 rounded bg-[var(--color-bg-tertiary)]" />
    </div>
  )
}
