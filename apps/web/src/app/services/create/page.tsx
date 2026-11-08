'use client';

import { apiRequest } from '@/lib/endpoints';

import { useState } from 'react';
import Link from 'next/link';
import {
  PlusCircle, Shield, CheckCircle, Copy, ExternalLink,
  Cpu, Globe, ArrowLeft, KeyRound, AlertTriangle, Zap,
} from 'lucide-react';
import { useWallet } from '@/components/Providers';

type FormData = {
  name: string;
  category: string;
  description: string;
  upstreamUrl: string;
  rateLimitRps: number;
  planName: string;
  pricePerEpochUsdc: number;
  requestQuota: number;
  slaUptimePercent: number;
  slaLatencyMs: number;
};

const CATEGORIES = ['AI & Inference', 'Data & Oracles', 'RPC & Infrastructure', 'DeFi', 'Storage & CDN', 'Payments'];
const SLA_TEMPLATES = [
  { label: 'Standard', uptime: 99.0, latency: 500 },
  { label: 'Premium', uptime: 99.5, latency: 200 },
  { label: 'Enterprise', uptime: 99.9, latency: 100 },
];

export default function CreateServicePage() {
  const { isConnected, token, signIn } = useWallet();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: 'AI & Inference',
    description: '',
    upstreamUrl: '',
    rateLimitRps: 100,
    planName: 'Pro Tier',
    pricePerEpochUsdc: 50,
    requestQuota: 100000,
    slaUptimePercent: 99.5,
    slaLatencyMs: 200,
  });

  const [error, setError] = useState('');
  const [serviceSlug, setServiceSlug] = useState('');
  const [verificationToken, setVerificationToken] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (k: keyof FormData, v: string | number) =>
    setFormData(prev => ({ ...prev, [k]: v }));

  const handleGenerateChallenge = async () => {
    setSubmitting(true); setError('');
    try {
      if (!isConnected) throw new Error('Connect your wallet before registering a service.');
      const authToken = token || await signIn();
      const organizations = await apiRequest('/orgs', {}, authToken);
      let org = organizations[0];
      if (!org) org = await apiRequest('/orgs', { method: 'POST', body: JSON.stringify({ name: `${formData.name} Organization`, slug: `org-${crypto.randomUUID().slice(0, 8)}` }) }, authToken);
      const slug = `${formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomUUID().slice(0, 8)}`;
      const service = await apiRequest('/services', { method: 'POST', body: JSON.stringify({ orgId: org.id, name: formData.name, slug, description: formData.description, upstreamUrl: formData.upstreamUrl, category: formData.category }) }, authToken);
      setServiceId(service.id); setServiceSlug(service.slug); setVerificationToken(service.verificationChallenge);
      await apiRequest(`/services/${service.id}/plans`, { method: 'POST', body: JSON.stringify({ name: formData.planName, slug: 'default', description: formData.description, pricePerEpochUsdc: formData.pricePerEpochUsdc, requestQuota: formData.requestQuota, rateLimitRps: formData.rateLimitRps, slaUptimePpm: Math.round(formData.slaUptimePercent * 10000), slaLatencyMs: formData.slaLatencyMs }) }, authToken);
      setStep(2);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Registration failed.'); }
    finally { setSubmitting(false); }
  };

  const handleVerifyOwnership = async () => {
    setIsVerifying(true); setError('');
    try {
      if (!serviceId) throw new Error('Register the service first.');
      const authToken = token || await signIn();
      const result = await apiRequest(`/services/${serviceId}/verify`, { method: 'POST', body: '{}' }, authToken);
      if (!result.verified) throw new Error('Ownership challenge did not pass.');
      setStep(3);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Verification failed.'); }
    finally { setIsVerifying(false); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { n: 1, label: 'Service & SLA Config' },
    { n: 2, label: 'Ownership Verification' },
    { n: 3, label: 'Live on Marketplace' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Marketplace
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase tracking-wider mb-2">
          <PlusCircle className="w-4 h-4" />
          Provider Portal
        </div>
        <h1 className="font-display text-3xl font-bold text-white mb-2">Register Service</h1>
        <p className="text-zinc-400 text-sm max-w-xl">
          Register your API and SLA plan in the connected backend, then verify ownership through an HTTP challenge.
        </p>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>}
      {/* Step indicators */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {steps.map(s => (
          <div key={s.n} className={`p-3 rounded-xl border text-center transition-all ${
            step === s.n
              ? 'border-amber-500/50 bg-amber-500/10 text-white'
              : step > s.n
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-white/[0.07] bg-[#0f0f12] text-zinc-500'
          }`}>
            <div className="text-[10px] uppercase font-mono tracking-widest mb-0.5">Step {s.n}</div>
            <div className="text-xs font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {!isConnected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-300 text-sm">Wallet not connected</div>
            <p className="text-xs text-amber-200/70 mt-0.5">Connect your wallet to register as a provider and receive payments.</p>
          </div>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-[#0f0f12] border border-white/[0.07] rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Service info */}
          <div>
            <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              Service Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Service Name</label>
                <input
                  value={formData.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g. QuantumRPC Pro Endpoints"
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Category</label>
                <select
                  value={formData.category}
                  onChange={e => update('category', e.target.value)}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Rate Limit (req/s)</label>
                <input
                  type="number"
                  value={formData.rateLimitRps}
                  onChange={e => update('rateLimitRps', Number(e.target.value))}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => update('description', e.target.value)}
                  placeholder="Describe your API, its use-cases, and reliability guarantees..."
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Upstream URL</label>
                <input
                  value={formData.upstreamUrl}
                  onChange={e => update('upstreamUrl', e.target.value)}
                  placeholder="https://api.yourservice.com"
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                <p className="text-xs text-zinc-500 mt-1">Your actual API endpoint. SSRF-protected — internal IPs rejected.</p>
              </div>
            </div>
          </div>

          {/* SLA config */}
          <div className="border-t border-white/[0.05] pt-6">
            <h2 className="font-display text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              SLA & Circuit Policy
            </h2>
            <p className="text-xs text-zinc-400 mb-4">Select an SLA target for the service plan. Circuit deployment is a separate operation.</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {SLA_TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => { update('slaUptimePercent', t.uptime); update('slaLatencyMs', t.latency); }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.slaUptimePercent === t.uptime
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-sm text-white">{t.label}</div>
                  <div className="text-xs text-zinc-400 mt-1">{t.uptime}% uptime</div>
                  <div className="text-xs text-zinc-400">{t.latency}ms p95</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Uptime SLA (%)</label>
                <input type="number" step="0.1" min="90" max="100"
                  value={formData.slaUptimePercent}
                  onChange={e => update('slaUptimePercent', Number(e.target.value))}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">P95 Latency SLA (ms)</label>
                <input type="number" min="50"
                  value={formData.slaLatencyMs}
                  onChange={e => update('slaLatencyMs', Number(e.target.value))}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="border-t border-white/[0.05] pt-6">
            <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Pricing Plan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Plan Name</label>
                <input value={formData.planName} onChange={e => update('planName', e.target.value)}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Price / Epoch (USDC)</label>
                <input type="number" value={formData.pricePerEpochUsdc} onChange={e => update('pricePerEpochUsdc', Number(e.target.value))}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1.5">Request Quota / Epoch</label>
                <input type="number" value={formData.requestQuota} onChange={e => update('requestQuota', Number(e.target.value))}
                  className="w-full bg-[#141418] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.05] pt-6 flex justify-end">
            <button
              onClick={handleGenerateChallenge}
              disabled={!isConnected || !formData.name || !formData.upstreamUrl || submitting}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Shield className="w-4 h-4" />}
              Continue to Verification
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-[#0f0f12] border border-white/[0.07] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Prove API Ownership</h2>
              <p className="text-xs text-zinc-400">Respond to the HTTP challenge at your upstream URL to verify control.</p>
            </div>
          </div>

          <div className="p-4 bg-[#141418] border border-white/[0.07] rounded-xl space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Challenge URL</span>
                <button onClick={() => copy(`${formData.upstreamUrl}/.well-known/latchwork-challenge`)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                  <Copy className="w-3 h-3" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="block text-xs font-mono bg-black/40 p-3 rounded-lg border border-white/[0.05] text-zinc-300 break-all">
                GET {new URL('/.well-known/latchwork-challenge', formData.upstreamUrl).toString()}
              </code>
            </div>
            <div>
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">Expected Response (HTTP 200 text/plain)</div>
              <code className="block text-xs font-mono bg-black/40 p-3 rounded-lg border border-emerald-500/20 text-emerald-400 break-all">
                {verificationToken}
              </code>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)} className="text-sm text-zinc-400 hover:text-white transition-colors">← Back</button>
            <button
              onClick={handleVerifyOwnership}
              disabled={isVerifying}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isVerifying
                ? <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Verifying…</>
                : <><Shield className="w-4 h-4" /> Verify Ownership</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Success */}
      {step === 3 && (
        <div className="bg-[#0f0f12] border border-emerald-500/25 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Service Live!</h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              <span className="text-white font-semibold">{formData.name || 'Your service'}</span> has passed the ownership challenge and is listed in the connected backend. Circuit deployment and escrow funding are separate operations.
            </p>
          </div>

          <div className="bg-black/40 border border-white/[0.07] rounded-xl p-4 max-w-sm mx-auto text-left font-mono text-xs space-y-2.5">
            {[
              ['Service ID', serviceId || '—', 'text-amber-400'],
              ['Status', 'ACTIVE_VERIFIED', 'text-emerald-400'],
              ['Gateway Route', `/v1/service/${serviceSlug}/*`, 'text-zinc-300'],
              ['Circuit Policy', 'Not deployed', 'text-indigo-400'],
              ['SLA Uptime', `${formData.slaUptimePercent}%`, 'text-zinc-300'],
              ['SLA Latency', `${formData.slaLatencyMs}ms p95`, 'text-zinc-300'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-zinc-500">{k}:</span>
                <span className={cls}>{v}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/marketplace" className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all">
              View in Marketplace
            </Link>
            <Link href="/playground" className="px-5 py-2.5 rounded-xl bg-[#141418] border border-white/[0.07] hover:border-white/20 text-white text-sm transition-all">
              Test in Playground
            </Link>
            <a href={`https://www.okx.com/web3/explorer/xlayer`} target="_blank" rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-[#141418] border border-white/[0.07] hover:border-white/20 text-white text-sm transition-all flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" /> Explorer
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
