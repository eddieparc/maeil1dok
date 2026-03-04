export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="mx-auto w-full px-4 md:max-w-[900px] md:px-6 lg:max-w-[1200px] lg:px-8">
        {children}
      </div>
    </div>
  )
}
