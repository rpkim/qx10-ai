import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import { GoogleAnalytics } from '@/components/google-analytics'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Qx10.lol — Question x10 Discovery',
  description: 'Explore any topic through infinite questioning. Build living knowledge trees that evolve into real-time dashboards.',
  generator: 'v0.app',
}

export const viewport = {
  themeColor: '#080C12',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background text-foreground overflow-hidden">
        <Providers>
          <GoogleAnalytics />
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
