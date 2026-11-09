import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo';
import '@fontsource-variable/big-shoulders-stencil-display';
import '@fontsource-variable/spline-sans-mono';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'LATCHWORK — Verifiable service settlement on X Layer',
  description:
    'Programmable settlement infrastructure for digital services on X Layer, powered by TapeOut circuits.',
  keywords: ['TapeOut', 'X Layer', 'Web3', 'API settlement', 'SLA', 'USDC escrow', 'DeFi'],
  openGraph: {
    title: 'LATCHWORK',
    description: 'Services prove performance. Circuits enforce payment.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-zinc-100 antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {/* Top noise grain */}
            <div
              className="pointer-events-none fixed inset-0 z-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
                opacity: 0.5,
              }}
            />
            <Navbar />
            <main className="relative z-10 flex-1">{children}</main>
            <footer className="relative z-10 border-t border-white/5 bg-surface/60 backdrop-blur-sm">
              <div className="site-container py-6">
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                    <span className="font-display font-semibold tracking-wide text-zinc-300">LATCHWORK</span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-500 font-mono">X Layer Mainnet · Chain 196</span>
                    <span className="text-zinc-700">|</span>
                    <span className="text-zinc-500 font-mono text-[11px]">TapeOut CPU 0x839b...574e</span>
                  </div>
                  <div className="text-xs text-zinc-600 font-mono tracking-tight">
                    Services prove performance. Circuits enforce payment.
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
