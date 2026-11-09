'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckCheck, ChevronDown, Copy, Cpu, LogOut, Menu, PlusCircle, Wallet, X } from 'lucide-react';
import { useWallet } from './Providers';

const primaryLinks = [
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/agreements', label: 'Agreements' },
  { href: '/policy-studio', label: 'Policy Studio' },
  { href: '/playground', label: 'Playground' },
  { href: '/docs', label: 'Developers' },
];

const mobileLinks = [...primaryLinks, { href: '/terminal', label: 'Service Health' }];

export function Navbar() {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const { address, role, isConnected, connectWallet, disconnectWallet, switchRole, chainId, error } = useWallet();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-background/92 backdrop-blur-xl">
        <div className="site-container flex h-[72px] items-center justify-between gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="LATCHWORK home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-amber text-black">
              <Cpu className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl font-bold tracking-[0.08em] text-white">LATCHWORK</span>
          </Link>

          <nav className="hidden min-w-0 items-center justify-center gap-1 lg:flex" aria-label="Primary navigation">
            {primaryLinks.map(link => {
              const active = pathname === link.href;
              return (
                <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${active ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isConnected ? (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setAccountOpen(value => !value)} className="flex items-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-xs font-mono text-zinc-200 transition-colors hover:bg-white/[0.07]">
                  <span className="h-2 w-2 rounded-full bg-brand-emerald" />
                  <span className="hidden sm:inline">{address.slice(0, 6)}…{address.slice(-4)}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.09] bg-surface-raised shadow-2xl">
                    <div className="border-b border-white/[0.06] p-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{role} · Chain {chainId || 196}</p>
                      <p className="mt-2 break-all font-mono text-xs text-zinc-300">{address}</p>
                    </div>
                    <div className="space-y-1 p-2">
                      <button onClick={copyAddress} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.05]">
                        {copied ? <CheckCheck className="h-4 w-4 text-brand-emerald" /> : <Copy className="h-4 w-4 text-zinc-500" />}{copied ? 'Copied' : 'Copy address'}
                      </button>
                      <button onClick={() => switchRole(role === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.05]">
                        <PlusCircle className="h-4 w-4 text-zinc-500" /> Switch to {role === 'CUSTOMER' ? 'provider' : 'customer'}
                      </button>
                      <button onClick={disconnectWallet} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-rose hover:bg-brand-rose/10">
                        <LogOut className="h-4 w-4" /> Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={connectWallet} className="inline-flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-400">
                <Wallet className="h-4 w-4" /><span className="hidden sm:inline">Connect wallet</span><span className="sm:hidden">Connect</span>
              </button>
            )}
            <button aria-label="Toggle navigation" onClick={() => setMobileOpen(value => !value)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="site-container py-2 text-sm text-rose-400">{error}</div>}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[72px] z-40 border-b border-white/[0.08] bg-background/98 p-4 shadow-2xl backdrop-blur-xl lg:hidden">
          <nav className="site-container grid gap-1" aria-label="Mobile navigation">
            {mobileLinks.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`rounded-lg px-4 py-3 text-sm ${pathname === link.href ? 'bg-brand-amber/10 text-brand-amber' : 'text-zinc-300 hover:bg-white/[0.04]'}`}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
