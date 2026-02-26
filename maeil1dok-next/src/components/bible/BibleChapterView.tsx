interface BibleChapterViewProps {
  content: string
  isLoading: boolean
}

export default function BibleChapterView({ content, isLoading }: BibleChapterViewProps) {
  if (isLoading) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">성경 본문을 불러오는 중입니다...</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-2 shadow-sm">
      <iframe
        data-testid="bible-chapter-content"
        title="bible-chapter-content"
        srcDoc={content}
        className="h-[65vh] w-full rounded-xl border border-gray-100 bg-white"
        sandbox="allow-same-origin"
      />
    </section>
  )
}
