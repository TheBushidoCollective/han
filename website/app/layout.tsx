import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Han - Sophisticated Claude Code Plugins with Superior Accuracy',
  description:
    'Sophisticated Claude Code plugins with superior accuracy, built on the foundation of the seven Bushido virtues.',
  keywords: [
    'claude',
    'claude-code',
    'plugins',
    'marketplace',
    'bushido',
    'development',
    'quality',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
