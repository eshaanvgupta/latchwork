'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/Providers';
import { apiRequest } from '@/lib/endpoints';

interface AgreementRecord {
  id: string; status: string; service: { name: string }; plan: { name: string };
  customerAddress: string; providerAddress: string; currentEpoch: number;
  totalFundedUsdc: number; circuitPolicyId: string;
}

export default function AgreementsPage() {
  const { address, isConnected, connectWallet, token, signIn } = useWallet();
  const [records, setRecords] = useState<AgreementRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setRecords([]); setError('');
    if (!token) return;
    let active = true; setLoading(true);
    apiRequest('/agreements', {}, token).then(data => {
      if (!Array.isArray(data)) throw new Error('Unexpected agreement response.');
      if (active) setRecords(data);
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, address]);
  const login = async () => { setError(''); try { await signIn(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Sign-in failed.'); } };

  return <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
    <div><h1 className="font-display text-3xl font-bold">Agreement records</h1><p className="mt-2 text-sm text-zinc-400">Read your authenticated backend records. Recorded funding amounts are not proof of an on-chain deposit.</p></div>
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">Escrow creation, token approval, funding, settlement, and withdrawals are not connected in this frontend. See the repository's contract scripts and readiness report.</div>
    {!isConnected ? <button onClick={connectWallet} className="rounded-lg bg-amber-400 text-black px-4 py-2 font-semibold text-sm">Connect wallet</button> : !token ? <button onClick={login} className="rounded-lg bg-amber-400 text-black px-4 py-2 font-semibold text-sm">Sign in with wallet</button> : <p className="text-xs font-mono text-zinc-500 break-all">Signed in as {address}</p>}
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    {loading && <p className="text-sm text-zinc-400">Loading agreement records…</p>}
    {token && !loading && !records.length && !error && <p className="text-sm text-zinc-400">No agreement records found for this account.</p>}
    {records.map(record => <section key={record.id} className="rounded-xl border border-white/10 bg-surface p-5 space-y-3">
      <div className="flex justify-between gap-3"><h2 className="font-semibold">{record.service?.name || 'Service'} / {record.plan?.name || 'Plan'}</h2><span className="font-mono text-xs text-amber-400">{record.status}</span></div>
      <p className="font-mono text-xs text-zinc-500 break-all">{record.id}</p>
      <div className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-400"><p className="break-all">Customer: {record.customerAddress}</p><p className="break-all">Provider: {record.providerAddress}</p><p>Recorded funding: {record.totalFundedUsdc} USDC (unverified)</p><p>Current epoch: {record.currentEpoch}</p><p className="break-all">Policy: {record.circuitPolicyId}</p></div>
    </section>)}
    <Link href="/marketplace" className="inline-block text-sm text-amber-400 hover:underline">Browse service marketplace →</Link>
  </div>;
}
