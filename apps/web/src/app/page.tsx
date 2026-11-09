'use client';

import { API_URL, MONITOR_URL } from '@/lib/endpoints';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
  Activity,
  Layers,
  Zap,
  Lock,
  TrendingUp,
  Users,
  Globe,
  CheckCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = '', decimals = 0 }: { target: number; suffix?: string; decimals?: number }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 1800;
    const start = performance.now();
    const animate = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 4);
      setVal(parseFloat((eased * target).toFixed(decimals)));
      if (pct < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, decimals]);

  return <span>{decimals > 0 ? val.toFixed(decimals) : Math.floor(val)}{suffix}</span>;
}

// ── Live stat ticker at top ───────────────────────────────────────────────────
const TICKERS = [
  { label: 'Product Status', value: 'Hackathon Prototype' },
  { label: 'Policy Simulation', value: 'Local NAND' },
  { label: 'Proposed Settlement Fee', value: '0.5%' },
  { label: 'Witness Quorum', value: '2-of-3' },
  { label: 'Settlement Currency', value: 'USDC' },
  { label: 'Gate Encoding', value: '7-byte NAND' },
  { label: 'Chain ID', value: '196' },
  { label: 'TapeOut CPU 0', value: '0x839b…574e' },
];

function TickerBar() {
  return (
    <div className="border-b border-white/[0.05] bg-white/[0.015] overflow-hidden py-2">
      <div className="flex animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {[...TICKERS, ...TICKERS].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-6 text-[11px] font-mono">
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-500">{t.label}</span>
            <span className="text-zinc-300 font-semibold">{t.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-surface overflow-hidden shadow-2xl">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-white/[0.02]">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-rose/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-amber/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-brand-emerald/60" />
        <span className="ml-3 text-[11px] font-mono text-zinc-500">latchwork-sdk · settlement.ts</span>
      </div>
      <div className="p-5 font-mono text-[12px] leading-relaxed space-y-1">
        <div><span className="text-zinc-600">// 1. Compile your SLA policy into a TapeOut circuit</span></div>
        <div>
          <span className="text-brand-indigo">const</span>
          <span className="text-zinc-200"> builder </span>
          <span className="text-zinc-500">= </span>
          <span className="text-brand-amber">new</span>
          <span className="text-zinc-200"> CircuitBuilder</span>
          <span className="text-zinc-500">(</span>
          <span className="text-brand-teal">3</span>
          <span className="text-zinc-500">);</span>
        </div>
        <div><span className="text-zinc-500 pl-4">builder</span><span className="text-zinc-400">.addOutput(</span><span className="text-zinc-500">builder</span><span className="text-zinc-400">.quorum2of3())</span></div>
        <div className="pt-2"><span className="text-zinc-600">// 2. Evaluate on-chain via TapeOut CPU 0</span></div>
        <div>
          <span className="text-brand-indigo">const</span>
          <span className="text-zinc-200"> result </span>
          <span className="text-zinc-500">= </span>
          <span className="text-brand-amber">await</span>
          <span className="text-zinc-200"> tapeout</span>
          <span className="text-zinc-500">.</span>
          <span className="text-zinc-200">evalCircuit</span>
          <span className="text-zinc-500">(circuitId, inputs);</span>
        </div>
        <div className="pt-2"><span className="text-zinc-600">// 3. Intended contract allocation (pseudocode)</span></div>
        <div>
          <span className="text-brand-indigo">if</span>
          <span className="text-zinc-500"> (result.output === </span>
          <span className="text-brand-teal">1</span>
          <span className="text-zinc-500">)</span>
          <span className="text-zinc-400"> vault.releaseToProvider(</span>
          <span className="text-zinc-200">agreement</span>
          <span className="text-zinc-400">);</span>
        </div>
        <div className="pt-1 flex items-center gap-2 text-brand-emerald text-[11px]">
          <CheckCircle className="h-3 w-3" />
          <span>Illustrative output: authorize provider allocation</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'live' | 'offline'>('checking');
  const [witnessCount, setWitnessCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Real API health check
    if (!API_URL) setApiStatus('offline');
    else fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? setApiStatus('live') : setApiStatus('offline'))
      .catch(() => setApiStatus('offline'));

    // Witness count from monitor
    if (MONITOR_URL) fetch(`${MONITOR_URL}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then((d: any) => setWitnessCount(d.witnessCount || 0))
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Example Witness Quorum', value: 2, suffix: ' of 3', color: 'text-brand-amber' },
    { label: 'Monitor Identities', value: witnessCount, suffix: ' Configured', color: 'text-brand-teal' },
    { label: 'Proposed Settlement Fee', value: 0.5, suffix: '%', decimals: 1, color: 'text-brand-indigo' },
    { label: 'Gate Bytes', value: 7, suffix: '/gate', color: 'text-zinc-300' },
  ];

  return (
    <div className="relative">
      {/* ── Ticker ── */}
      <TickerBar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100" />
        {/* Radial glow */}
        <div className="absolute inset-0 bg-hero-glow" />
        {/* Fade out at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />

        <div className="site-container relative pt-16 pb-16 sm:pt-24 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left — text */}
            <div>
              {/* Status pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-mono text-zinc-400 mb-8">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    apiStatus === 'live' ? 'bg-brand-emerald status-pulse' :
                    apiStatus === 'offline' ? 'bg-brand-rose' : 'bg-brand-amber animate-pulse'
                  }`}
                />
                {apiStatus === 'live' ? 'Backend API reachable' :
                 apiStatus === 'offline' ? 'Start microservices to connect' :
                 'Checking backend...'}
              </div>

              <h1 className="font-display text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight text-zinc-50">
                Services prove<br />
                <span className="text-brand-amber">performance.</span>
                <br />
                <span className="text-zinc-400">Circuits enforce</span>
                <br />
                <span className="text-zinc-100">payment.</span>
              </h1>

              <p className="mt-6 text-base text-zinc-400 leading-relaxed max-w-lg">
                LATCHWORK converts digital-service SLAs into{' '}
                <span className="text-zinc-200">deterministic NAND circuits</span> evaluated
                by TapeOut on X Layer. The settlement contracts are designed to allocate escrow from verified circuit outputs. Explore the prototype below.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-amber px-5 py-2.5 text-[13px] font-semibold text-black hover:bg-amber-400 transition-all duration-200 shadow-amber-sm"
                >
                  Browse APIs
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/policy-studio"
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.07] px-5 py-2.5 text-[13px] font-semibold text-zinc-200 transition-all duration-200"
                >
                  <Cpu className="h-4 w-4 text-brand-indigo" />
                  Open Policy Studio
                </Link>
                <Link
                  href="/playground"
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.07] px-5 py-2.5 text-[13px] font-semibold text-zinc-400 hover:text-zinc-200 transition-all duration-200"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Gateway Playground
                </Link>
              </div>

              {/* Trust signals */}
              <div className="mt-10 flex flex-wrap gap-4 text-[12px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-brand-teal" />
                  EIP-712 Signed Attestations
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-brand-teal" />
                  On-Chain TapeOut Evaluation
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-brand-teal" />
                  Escrow Contract Source
                </span>
              </div>
            </div>

            {/* Right — code preview */}
            <div className="relative">
              <div className="absolute -inset-4 bg-brand-amber/5 blur-3xl rounded-full" />
              <div className="relative">
                <CodeBlock />
                {/* Floating badge */}
                <div className="absolute -right-3 -top-3 flex items-center gap-2 rounded-xl border border-brand-teal/30 bg-surface-raised px-3 py-2 text-[11px] font-mono shadow-teal-sm">
                  <span className="h-2 w-2 rounded-full bg-brand-teal status-pulse" />
                  <span className="text-brand-teal">Hackathon Prototype</span>
                </div>
                <div className="absolute -left-3 -bottom-3 flex items-center gap-2 rounded-xl border border-brand-amber/30 bg-surface-raised px-3 py-2 text-[11px] font-mono shadow-amber-sm">
                  <span className="text-brand-amber font-bold">NAND</span>
                  <span className="text-zinc-500">local policy simulation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.05] bg-surface/40">
        <div className="site-container py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {mounted && stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className={`font-display text-3xl font-bold ${s.color}`}>
                  <Counter target={s.value} suffix={s.suffix} decimals={s.decimals} />
                </div>
                <div className="mt-1 text-[12px] text-zinc-500 font-mono">{s.label}</div>
              </div>
            ))}
            {!mounted && stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="h-8 w-24 mx-auto shimmer rounded-lg" />
                <div className="mt-1 text-[12px] text-zinc-500 font-mono">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="site-container py-20 sm:py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-[11px] font-mono text-zinc-500 mb-4">
            HOW IT WORKS
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-zinc-50">
            Settlement architecture in 4 steps
          </h2>
          <p className="mt-3 text-zinc-500 max-w-xl mx-auto text-[14px]">
            The intended financial flow requires deployed contracts and completed wallet transaction flows.</p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent hidden md:block" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: Lock,
                title: 'Fund Escrow',
                desc: 'Customer deposits USDC into SettlementVault. Funds are locked under the circuit-governed agreement policy.',
                color: 'text-brand-amber',
                bg: 'bg-brand-amber/10 border-brand-amber/20',
              },
              {
                step: '02',
                icon: Globe,
                title: 'API Gateway',
                desc: 'Requests route through the LATCHWORK gateway with SSRF protection, rate limiting, and signed usage receipts.',
                color: 'text-brand-indigo',
                bg: 'bg-brand-indigo/10 border-brand-indigo/20',
              },
              {
                step: '03',
                icon: Users,
                title: 'Witness Network',
                desc: '3 operator-controlled witness identities probe uptime and P95 latency and can sign EIP-712 reports.',
                color: 'text-brand-teal',
                bg: 'bg-brand-teal/10 border-brand-teal/20',
              },
              {
                step: '04',
                icon: Cpu,
                title: 'TapeOut Verdict',
                desc: 'SettlementEngine bit-packs reports and calls TapeOut CPU 0. Output=1: provider paid. Output=0: customer refunded.',
                color: 'text-zinc-200',
                bg: 'bg-white/[0.05] border-white/[0.08]',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="relative rounded-2xl border border-white/[0.06] bg-surface/60 p-6 hover:border-white/[0.1] hover:bg-surface/80 transition-all duration-300 group"
                >
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${item.bg} mb-4`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="absolute top-5 right-5 font-mono text-[11px] text-zinc-700 font-bold">{item.step}</div>
                  <h3 className="font-display text-[15px] font-semibold text-zinc-100 mb-2">{item.title}</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-surface/30 py-24">
        <div className="site-container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Large featured tile */}
            <div className="lg:col-span-2 rounded-2xl border border-brand-amber/15 bg-gradient-to-br from-brand-amber/5 to-transparent p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-64 w-64 bg-brand-amber/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-amber/10 border border-brand-amber/20 px-3 py-1 text-[11px] font-mono text-brand-amber mb-4 font-semibold">
                  <Cpu className="h-3 w-3" />
                  TapeOut Integration
                </div>
                <h3 className="font-display text-2xl font-bold text-zinc-50 mb-3">
                  Real silicon logic on X Layer zkEVM
                </h3>
                <p className="text-zinc-400 text-[14px] leading-relaxed max-w-lg">
                  Policy Studio compiles actual 7-byte NAND gate netlists and simulates their truth tables locally.
                  The TapeOut adapter can evaluate published circuits on X Layer through read-only RPC calls.
                  Enter a matching published circuit ID to compare its output with your local policy.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
                    CPU 0: 0x839b…574e
                  </span>
                  <span className="rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
                    Factory: 0x1f09…0761
                  </span>
                  <span className="rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
                    No LATCHWORK deployment claimed
                  </span>
                </div>
                <Link
                  href="/policy-studio"
                  className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-amber hover:text-amber-300 transition-colors"
                >
                  Open Policy Studio
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right column: two tiles */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/[0.06] bg-surface/60 p-6 hover:border-white/[0.1] transition-all duration-300">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-teal/10 border border-brand-teal/20 mb-4">
                  <ShieldCheck className="h-4 w-4 text-brand-teal" />
                </div>
                <h3 className="font-display text-[15px] font-semibold text-zinc-100 mb-2">Cryptographic Escrow</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed">
                  Pull-over-push SettlementVault with OpenZeppelin ReentrancyGuard. Contract tests cover accounting and adversarial cases; this prototype has not been independently audited.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-surface/60 p-6 hover:border-white/[0.1] transition-all duration-300">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-indigo/10 border border-brand-indigo/20 mb-4">
                  <Activity className="h-4 w-4 text-brand-indigo" />
                </div>
                <h3 className="font-display text-[15px] font-semibold text-zinc-100 mb-2">Real Gateway Traffic</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed">
                  Use an agreement gateway key to forward real HTTP traffic and inspect the receipt headers returned by your gateway.
                </p>
                <Link
                  href="/playground"
                  className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-indigo hover:text-indigo-300 transition-colors"
                >
                  Try it now <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="site-container py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-surface-raised to-surface px-8 py-16 text-center">
          <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-50" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-brand-amber/50 to-transparent" />
          <div className="relative">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-50 mb-4">
              Ready to settle with certainty?
            </h2>
            <p className="text-zinc-500 max-w-xl mx-auto text-[14px] mb-8">
              Register your API, fund an agreement, and let LATCHWORK's TapeOut circuits handle the rest.
              No manual disputes. No centralized arbitration.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/services/create"
                className="inline-flex items-center gap-2 rounded-full bg-brand-amber px-6 py-3 text-sm font-semibold text-black hover:bg-amber-400 transition-all duration-200 shadow-amber-md"
              >
                Register Your API
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-6 py-3 text-sm font-semibold text-zinc-200 transition-all duration-200"
              >
                Browse Marketplace
              </Link>
              <a
                href="https://www.okx.com/web3/explorer/xlayer/address/0x839bdD6fa7A66416A609A735e11DE5411B98574e"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-transparent hover:bg-white/[0.04] px-6 py-3 text-sm font-semibold text-zinc-500 hover:text-zinc-300 transition-all duration-200"
              >
                View on Explorer
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
