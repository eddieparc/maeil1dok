import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { ThemeProvider, ToastProvider } from '@/components/providers'
import './globals.css'

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: '매일일독',
  description: '성경통독을 매일 함께해요',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSansKr.variable} antialiased`}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
