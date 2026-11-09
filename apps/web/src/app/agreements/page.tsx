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

  return <div className="narrow-shell space-y-7">
    <div className="page-heading"><h1 className="font-display text-5xl font-bold uppercase leading-none sm:text-6xl">Your agreements</h1><p className="mt-4 text-sm text-zinc-400">Review service terms, funding records, policy references, and settlement activity for your connected account.</p></div>
    {!isConnected ? <div className="content-panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-semibold uppercase text-white">Connect to continue</h2><p className="mt-1 text-sm text-zinc-500">Use your X Layer wallet to access customer and provider agreements.</p></div><button onClick={connectWallet} className="shrink-0 rounded-lg bg-amber-400 text-black px-5 py-3 font-semibold text-sm">Connect wallet</button></div> : !token ? <button onClick={login} className="rounded-lg bg-amber-400 text-black px-5 py-3 font-semibold text-sm">Sign in with wallet</button> : <p className="text-xs font-mono text-zinc-500 break-all">Signed in as {address}</p>}
    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
    {loading && <p className="text-sm text-zinc-400">Loading agreement records…</p>}
    {token && !loading && !records.length && !error && <p className="text-sm text-zinc-400">No agreement records found for this account.</p>}
    {records.map(record => <section key={record.id} className="content-panel p-5 space-y-3 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center"><h2 className="font-semibold">{record.service?.name || 'Service'} / {record.plan?.name || 'Plan'}</h2><span className="font-mono text-xs text-amber-400">{record.status}</span></div>
      <p className="font-mono text-xs text-zinc-500 break-all">{record.id}</p>
      <div className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-400"><p className="break-all">Customer: {record.customerAddress}</p><p className="break-all">Provider: {record.providerAddress}</p><p>Recorded funding: {record.totalFundedUsdc} USDC (unverified)</p><p>Current epoch: {record.currentEpoch}</p><p className="break-all">Policy: {record.circuitPolicyId}</p></div>
    </section>)}
    <Link href="/marketplace" className="inline-block text-sm text-amber-400 hover:underline">Browse service marketplace →</Link>
  </div>;
}
