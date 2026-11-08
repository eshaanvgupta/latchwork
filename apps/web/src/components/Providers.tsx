'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { stringToHex } from 'viem';
import { apiRequest } from '@/lib/endpoints';

interface WalletContextType {
  address: string;
  role: 'CUSTOMER' | 'PROVIDER';
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchRole: (role: 'CUSTOMER' | 'PROVIDER') => void;
  network: string;
  chainId: number;
  token: string;
  signIn: () => Promise<string>;
  error: string;
}

const WalletContext = createContext<WalletContextType>({
  address: '', role: 'CUSTOMER', isConnected: false, connectWallet: async () => {},
  disconnectWallet: () => {}, switchRole: () => {}, network: 'Disconnected', chainId: 0,
  token: '', signIn: async () => { throw new Error('Connect a wallet first'); }, error: '',
});
export const useWallet = () => useContext(WalletContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [role, setRole] = useState<'CUSTOMER' | 'PROVIDER'>('CUSTOMER');
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState(0);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const provider = (window as any).ethereum;
    if (!provider?.on) return;
    const accountsChanged = (accounts: string[]) => { setAddress(accounts[0] || ''); setToken(''); };
    const chainChanged = (id: string) => { setChainId(Number(id)); setToken(''); };
    provider.on('accountsChanged', accountsChanged);
    provider.on('chainChanged', chainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', accountsChanged);
      provider.removeListener?.('chainChanged', chainChanged);
    };
  }, []);

  const connectWallet = async () => {
    setError('');
    const provider = (window as any).ethereum;
    if (!provider) { setError('Install an Ethereum-compatible wallet to connect.'); return; }
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts[0]) throw new Error('No wallet account selected.');
      setAddress(accounts[0]);
      setChainId(Number(await provider.request({ method: 'eth_chainId' })));
      setToken('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Wallet connection failed.'); }
  };

  const signIn = async () => {
    if (!address) throw new Error('Connect your wallet first.');
    const { message } = await apiRequest('/auth/nonce', { method: 'POST', body: JSON.stringify({ address }) });
    const signature = await (window as any).ethereum.request({ method: 'personal_sign', params: [stringToHex(message), address] });
    const result = await apiRequest('/auth/verify', { method: 'POST', body: JSON.stringify({ address, message, signature }) });
    setToken(result.token);
    return result.token as string;
  };

  return <QueryClientProvider client={queryClient}>
    <WalletContext.Provider value={{ address, role, isConnected: !!address, connectWallet,
      disconnectWallet: () => { setAddress(''); setToken(''); setChainId(0); }, switchRole: setRole,
      network: chainId === 196 ? 'X Layer Mainnet' : chainId ? `Chain ${chainId}` : 'Disconnected',
      chainId, token, signIn, error }}>
      {children}
    </WalletContext.Provider>
  </QueryClientProvider>;
}
