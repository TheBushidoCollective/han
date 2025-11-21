import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Han - The Bushido Code Marketplace',
  description: 'A curated marketplace of Claude Code plugins that embody the principles of ethical and professional software development.',
  keywords: ['claude', 'claude-code', 'plugins', 'marketplace', 'bushido', 'development', 'quality'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
