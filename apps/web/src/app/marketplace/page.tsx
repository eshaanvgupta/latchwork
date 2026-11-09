'use client';

import { API_URL } from '@/lib/endpoints';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ShieldCheck,
  CheckCircle,
  Cpu,
  Clock,
  Zap,
  ArrowRight,
  SlidersHorizontal,
  Star,
  TrendingUp,
  PlusCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface ServicePlan {
  id: string;
  name: string;
  pricePerEpochUsdc: number;
  requestQuota: number;
  rateLimitRps: number;
  slaUptimePpm: number;
  slaLatencyMs: number;
}

interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  isVerified: boolean;
  providerAddress: string;
  plans: ServicePlan[];
}

const FALLBACK_SERVICES: ServiceItem[] = [
  {
    id: 'svc-test-1',
    name: 'LATCHWORK Test Service',
    slug: 'latchwork-test-service',
    description: 'Deterministic AI inference API with real-time chaos injection for SLA circuit verification. Fully controllable uptime and latency.',
    category: 'AI & Inference',
    isVerified: true,
    providerAddress: '0x25A71a07cecf1753ee65b00E0a3AAEf7e0F51c0F',
    plans: [
      { id: 'plan-free', name: 'Developer Sandbox', pricePerEpochUsdc: 0, requestQuota: 10000, rateLimitRps: 10, slaUptimePpm: 990000, slaLatencyMs: 500 },
      { id: 'plan-growth', name: 'Growth Tier', pricePerEpochUsdc: 29, requestQuota: 50000, rateLimitRps: 50, slaUptimePpm: 995000, slaLatencyMs: 250 },
      { id: 'plan-business', name: 'Enterprise', pricePerEpochUsdc: 149, requestQuota: 500000, rateLimitRps: 200, slaUptimePpm: 999000, slaLatencyMs: 150 },
    ],
  },
  {
    id: 'svc-oracle-2',
    name: 'X Layer Price Oracle',
    slug: 'xlayer-hf-oracle',
    description: 'Sub-second digital asset price feeds with witness verification and circuit-enforced accuracy guarantees.',
    category: 'DeFi & Oracles',
    isVerified: true,
    providerAddress: '0x85E4E16Bd367E4259537269633DA9a6Aa4cf95a3',
    plans: [
      { id: 'plan-oracle-growth', name: 'Growth Feed', pricePerEpochUsdc: 29, requestQuota: 100000, rateLimitRps: 100, slaUptimePpm: 999000, slaLatencyMs: 100 },
    ],
  },
  {
    id: 'svc-agent-3',
    name: 'Autonomous Agent Compute',
    slug: 'agent-compute-pod',
    description: 'Sandboxed code execution and reasoning workers for Web3 autonomous agents with guaranteed SLA.',
    category: 'Agent Infrastructure',
    isVerified: true,
    providerAddress: '0xe6eF3a317f91A0a44eB097c8e68B49CcF9E63895',
    plans: [
      { id: 'plan-agent-biz', name: 'Business Agent', pricePerEpochUsdc: 149, requestQuota: 250000, rateLimitRps: 150, slaUptimePpm: 995000, slaLatencyMs: 200 },
    ],
  },
  {
    id: 'svc-rpc-4',
    name: 'Ultra-Low Latency RPC Node',
    slug: 'xlayer-rpc-ultra',
    description: 'Dedicated X Layer zkEVM RPC endpoint with 99.9% uptime SLA, enforced by TapeOut NAND circuit.',
    category: 'RPC & Nodes',
    isVerified: false,
    providerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    plans: [
      { id: 'plan-rpc-starter', name: 'Starter Node', pricePerEpochUsdc: 9, requestQuota: 500000, rateLimitRps: 500, slaUptimePpm: 999000, slaLatencyMs: 50 },
    ],
  },
];

const CATEGORIES = ['All', 'AI & Inference', 'DeFi & Oracles', 'Agent Infrastructure', 'RPC & Nodes', 'Storage'];

const CATEGORY_COLORS: Record<string, string> = {
  'AI & Inference': 'bg-brand-indigo/15 text-brand-indigo border-brand-indigo/20',
  'DeFi & Oracles': 'bg-brand-teal/15 text-brand-teal border-brand-teal/20',
  'Agent Infrastructure': 'bg-brand-amber/15 text-brand-amber border-brand-amber/20',
  'RPC & Nodes': 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  'Storage': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

function ServiceCard({ service, expanded, onToggle }: {
  service: ServiceItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState(0);
  const plan = service.plans[selectedPlan];
  const categoryStyle = CATEGORY_COLORS[service.category] || 'bg-zinc-800 text-zinc-400 border-zinc-700';

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
      expanded ? 'border-brand-amber/30 bg-surface/80' : 'border-white/[0.06] bg-surface/40 hover:border-white/[0.1] hover:bg-surface/60'
    }`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold ${categoryStyle}`}>
                {service.category}
              </span>
              {service.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-mono text-brand-teal">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Verified
                </span>
              )}
            </div>
            <h3 className="font-display text-[15px] font-semibold text-zinc-100 leading-tight">{service.name}</h3>
            <p className="mt-1 text-[12px] text-zinc-500 leading-relaxed">{service.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="font-display text-lg font-bold text-zinc-100">
              {plan.pricePerEpochUsdc === 0 ? 'Free' : `$${plan.pricePerEpochUsdc}`}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">/epoch</span>
          </div>
        </div>

        {/* SLA pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-zinc-500">
            <Clock className="h-2.5 w-2.5" />
            {(plan.slaUptimePpm / 10000).toFixed(1)}% uptime
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-zinc-500">
            <Zap className="h-2.5 w-2.5" />
            {plan.slaLatencyMs}ms P95
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-zinc-500">
            <TrendingUp className="h-2.5 w-2.5" />
            {plan.requestQuota.toLocaleString()} req/epoch
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-brand-amber/15 bg-brand-amber/5 px-2 py-1 text-[10px] font-mono text-brand-amber/80">
            <Cpu className="h-2.5 w-2.5" />
            TapeOut SLA
          </span>
        </div>

        {/* Plan selector (if multiple plans) */}
        {service.plans.length > 1 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {service.plans.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlan(i)}
                className={`flex-shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-mono font-medium transition-all ${
                  selectedPlan === i
                    ? 'border-brand-amber/40 bg-brand-amber/10 text-brand-amber'
                    : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="flex-1 rounded-xl border border-brand-amber/30 bg-brand-amber/10 hover:bg-brand-amber/20 py-2 text-[12px] font-semibold text-brand-amber transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            {expanded ? 'Close Details' : 'Fund Agreement'}
            <ArrowRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
          <Link
            href="/playground"
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] p-2 text-zinc-500 hover:text-zinc-200 transition-all"
            title="Test in Playground"
          >
            <Zap className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/[0.05] bg-black/30 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 font-mono text-[11px]">
              <div className="text-zinc-600 mb-1">Provider Address</div>
              <div className="text-zinc-300 break-all">{service.providerAddress.slice(0, 20)}…</div>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 font-mono text-[11px]">
              <div className="text-zinc-600 mb-1">Rate Limit</div>
              <div className="text-brand-teal font-semibold">{plan.rateLimitRps} RPS</div>
            </div>
          </div>
          <div className="rounded-xl border border-brand-amber/15 bg-brand-amber/5 p-4 text-[12px] font-mono space-y-1.5">
            <div className="text-brand-amber font-semibold mb-2">Settlement Policy</div>
            <div className="text-zinc-500">Circuit: 2-of-3 Witness Quorum + Latency SLA</div>
            <div className="text-zinc-500">Currency: USDC (non-custodial escrow)</div>
            <div className="text-zinc-500">Fee: 0.5% protocol treasury</div>
            <div className="text-zinc-500">Evaluation: TapeOut CPU 0 (0x839b…574e)</div>
          </div>
          <Link
            href="/agreements"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-black hover:bg-amber-400 transition-all shadow-amber-sm"
          >
            View agreement
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const [sampleData, setSampleData] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadServices = async () => {
    setLoading(true);
    try {
      if (!API_URL) throw new Error('Backend not configured');
      const r = await fetch(`${API_URL}/services?limit=20`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) {
          setServices(data);
          setSampleData(false);
          return;
        }
      }
    } catch {}
    setServices(FALLBACK_SERVICES);
    setSampleData(true);
    setLoading(false);
  };

  useEffect(() => {
    loadServices().finally(() => setLoading(false));
  }, []);

  const filtered = services.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || s.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-5 mb-8 sm:flex-row sm:items-end">
        <div className="page-heading">
          <h1 className="font-display text-3xl font-bold leading-tight text-zinc-100 sm:text-4xl">Service Marketplace</h1>
          <p className="mt-3 text-sm text-zinc-500">
            Discover verified APIs with TapeOut circuit-enforced SLAs.
            <span className="ml-2 text-zinc-700 font-mono text-[11px]">{filtered.length} services</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); loadServices().finally(() => setLoading(false)); }}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2 text-zinc-500 hover:text-zinc-200 hover:border-white/[0.12] transition-all"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <Link
            href="/services/create"
            className="inline-flex items-center gap-2 rounded-full bg-brand-amber px-4 py-2 text-[13px] font-semibold text-black hover:bg-amber-400 transition-all shadow-amber-sm"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            List Your API
          </Link>
        </div>
      </div>

      {sampleData && <p role="status" className="mb-5 rounded-lg border border-amber-500/20 p-3 text-sm text-amber-200">API unavailable. Showing sample listings; these are not live providers.</p>}
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            type="text"
            placeholder="Search APIs, categories, descriptions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/[0.07] bg-surface/60 pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-brand-amber/40 focus:outline-none focus:ring-1 focus:ring-brand-amber/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <SlidersHorizontal className="h-4 w-4 text-zinc-600 flex-shrink-0" />
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all ${
                category === c
                  ? 'border-brand-amber/40 bg-brand-amber/10 text-brand-amber'
                  : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border border-white/[0.05] bg-surface/40 p-5 space-y-3">
              <div className="shimmer h-4 w-24 rounded-lg" />
              <div className="shimmer h-5 w-48 rounded-lg" />
              <div className="shimmer h-3 w-full rounded-lg" />
              <div className="shimmer h-3 w-3/4 rounded-lg" />
              <div className="shimmer h-9 w-full rounded-xl mt-4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-zinc-600">
          <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-display text-lg">No services found</p>
          <p className="text-sm mt-1">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(s => (
            <ServiceCard
              key={s.id}
              service={s}
              expanded={expanded === s.id}
              onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
