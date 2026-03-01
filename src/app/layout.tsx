import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'نظام تحليل موازنات المشاريع',
  description: 'تتبع وتحليل موازنات المشاريع بشكل احترافي',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${geist.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}
