'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Radio, Wifi, WifiOff } from 'lucide-react';
import { API_URL, GATEWAY_URL, MONITOR_URL } from '@/lib/endpoints';

interface ServiceHealth { name: string; url: string; online: boolean; data?: any; checkedAt: string; }

export default function OperationsTerminalPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [polling, setPolling] = useState(true);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    const checks = await Promise.all([
      { name: 'Backend API', url: API_URL }, { name: 'Gateway', url: GATEWAY_URL }, { name: 'Witness monitor', url: MONITOR_URL },
    ].map(async service => {
      try {
        if (!service.url) throw new Error('No backend URL configured for this preview.');
        const response = await fetch(`${service.url}/health`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { ...service, online: true, data: await response.json(), checkedAt: new Date().toLocaleTimeString() };
      } catch (error) { return { ...service, online: false, data: { error: error instanceof Error ? error.message : 'Unreachable' }, checkedAt: new Date().toLocaleTimeString() }; }
    }));
    setServices(checks); setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!polling) return; const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [polling, refresh]);
  const monitor = services.find(service => service.name === 'Witness monitor');

  return <div className="page-shell space-y-7">
    <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end"><div className="page-heading">
      <div className="text-xs text-amber-400 font-mono flex gap-2 items-center mb-2"><Activity className="h-4 w-4" /> OPERATIONS</div>
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Service health</h1><p className="text-sm text-zinc-400 mt-3">Actual HTTP health responses. Health checks do not establish witness independence or settlement execution.</p>
    </div><div className="flex gap-2"><button disabled={loading} onClick={refresh} className="rounded-lg border border-white/10 p-3"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      <button onClick={() => setPolling(!polling)} className="rounded-lg border border-white/10 px-4 text-sm">{polling ? 'Pause polling' : 'Resume polling'}</button></div></div>
    <div className="grid items-start gap-4 md:grid-cols-3">{services.map(service => <section key={service.name} className="content-panel h-full p-5 sm:p-6">
      <div className="flex justify-between items-center"><h2 className="font-semibold">{service.name}</h2>{service.online ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-rose-400" />}</div>
      <p className={`mt-4 font-mono text-xl ${service.online ? 'text-emerald-400' : 'text-rose-400'}`}>{service.online ? 'REACHABLE' : 'UNREACHABLE'}</p>
      <p className="text-xs font-mono text-zinc-500 break-all mt-2">{service.url}</p><p className="text-xs text-zinc-600 mt-2">Checked {service.checkedAt}</p>
      <pre className="mt-4 bg-black/30 rounded-lg p-3 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-80 overflow-y-auto">{JSON.stringify(service.data, null, 2)}</pre>
    </section>)}</div>
    {!services.length && <p className="text-sm text-zinc-400">Checking configured services…</p>}
    <section className="content-panel p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-amber-400" /> Witness identities</h2>
      <p className="mt-2 text-xs text-zinc-400">The initial witnesses are controlled by one operator. A reachable monitor does not mean measurements or signatures have been verified.</p>
      {monitor?.online && monitor.data?.witnessAddresses?.length ? <ul className="mt-4 space-y-2">{monitor.data.witnessAddresses.map((address: string, index: number) => <li key={address} className="rounded-lg bg-white/5 px-3 py-2 text-xs font-mono break-all">Witness {index + 1}: {address}</li>)}</ul> : <p className="mt-4 text-sm text-zinc-500">No witness identities retrieved. Start the local services or configure public service URLs before building.</p>}
    </section>
    <p className="text-xs text-zinc-500">Transaction indexing and a live settlement feed are not implemented. This page does not generate sample transactions.</p>
  </div>;
}
