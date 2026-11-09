'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from './Providers';
import {
  Cpu,
  LayoutDashboard,
  Activity,
  Terminal,
  BookOpen,
  Wallet,
  ChevronDown,
  LogOut,
  Copy,
  CheckCheck,
  Zap,
  ShoppingBag,
  PlusCircle,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const navLinks = [
  { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { href: '/agreements', label: 'Agreements', icon: LayoutDashboard },
  { href: '/policy-studio', label: 'Policy Studio', icon: Cpu, badge: 'TapeOut' },
  { href: '/terminal', label: 'Service Health', icon: Activity, live: false },
  { href: '/playground', label: 'Playground', icon: Zap },
  { href: '/docs', label: 'Docs', icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const { address, role, isConnected, connectWallet, disconnectWallet, switchRole, chainId, error } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.03)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="site-container flex h-16 items-center justify-between">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-7">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex h-7 w-7 items-center justify-center rounded-md bg-brand-amber text-black shadow-amber-sm">
                <Cpu className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <span className="font-display text-sm font-semibold tracking-wide text-zinc-100 group-hover:text-white transition-colors">
                LATCHWORK
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-brand-amber/10 border border-brand-amber/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-brand-amber tracking-wider">
                X LAYER
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-0.5 xl:flex">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'text-zinc-100 bg-white/[0.06]'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                    {link.badge && (
                      <span className="ml-0.5 rounded bg-brand-indigo/20 border border-brand-indigo/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-brand-indigo tracking-wide">
                        {link.badge}
                      </span>
                    )}
                    {link.live && (
                      <span className="relative flex h-1.5 w-1.5 ml-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-emerald" />
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-px bg-brand-amber/60 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Role switcher */}
            <div className="hidden sm:flex items-center rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5 text-[12px] font-medium">
              <button
                onClick={() => switchRole('CUSTOMER')}
                className={`rounded-full px-3 py-1 transition-all duration-200 ${
                  role === 'CUSTOMER'
                    ? 'bg-white/[0.08] text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Customer
              </button>
              <button
                onClick={() => switchRole('PROVIDER')}
                className={`rounded-full px-3 py-1 transition-all duration-200 ${
                  role === 'PROVIDER'
                    ? 'bg-white/[0.08] text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Provider
              </button>
            </div>

            {/* Network dot */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-emerald" />
              {chainId || "Disconnected"}
            </div>

            {/* Wallet */}
            {isConnected ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.08] px-3 py-1.5 text-[12px] font-mono text-zinc-200 transition-all duration-200"
                >
                  <span className="h-2 w-2 rounded-full bg-brand-amber" />
                  <span>{address.slice(0, 6)}…{address.slice(-4)}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-white/[0.08] bg-surface-raised shadow-2xl overflow-hidden z-50">
                    <div className="p-3 border-b border-white/[0.05]">
                      <div className="text-[11px] text-zinc-500 font-mono mb-1">Connected as {role}</div>
                      <div className="text-[12px] text-zinc-200 font-mono break-all">{address}</div>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button
                        onClick={copyAddress}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                      >
                        {copied ? <CheckCheck className="h-3.5 w-3.5 text-brand-emerald" /> : <Copy className="h-3.5 w-3.5 text-zinc-500" />}
                        {copied ? 'Copied!' : 'Copy Address'}
                      </button>
                      <button
                        onClick={() => { switchRole(role === 'CUSTOMER' ? 'PROVIDER' : 'CUSTOMER'); setDropdownOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                      >
                        <PlusCircle className="h-3.5 w-3.5 text-zinc-500" />
                        Switch to {role === 'CUSTOMER' ? 'Provider' : 'Customer'}
                      </button>
                      <div className="my-1 border-t border-white/[0.05]" />
                      <button
                        onClick={() => { disconnectWallet(); setDropdownOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-brand-rose hover:bg-brand-rose/10 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="flex items-center gap-1.5 rounded-full bg-brand-amber px-4 py-1.5 text-[13px] font-semibold text-black hover:bg-amber-400 transition-all duration-200 shadow-amber-sm"
              >
                <Wallet className="h-3.5 w-3.5" />
                Connect Wallet
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              aria-label="Toggle navigation menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="xl:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="site-container py-2 text-sm text-rose-400">{error}</div>}
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-surface-raised border-l border-white/[0.07] p-6 flex flex-col gap-2 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-sm font-semibold text-zinc-200">Menu</span>
              <button aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-amber/10 text-brand-amber border border-brand-amber/20'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                  {link.live && (
                    <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-brand-emerald" />
                  )}
                </Link>
              );
            })}
            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 text-sm mb-3">
                <button
                  onClick={() => switchRole('CUSTOMER')}
                  className={`flex-1 rounded-lg py-2 font-medium transition-all ${role === 'CUSTOMER' ? 'bg-white/[0.08] text-white' : 'text-zinc-500'}`}
                >Customer</button>
                <button
                  onClick={() => switchRole('PROVIDER')}
                  className={`flex-1 rounded-lg py-2 font-medium transition-all ${role === 'PROVIDER' ? 'bg-white/[0.08] text-white' : 'text-zinc-500'}`}
                >Provider</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
