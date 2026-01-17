/**
 * XRP Wallet Hook
 * Manages XRP wallet connection and operations
 */

import { useState, useEffect } from 'react';
import { Client, Wallet } from 'xrpl';

interface UseXRPWalletReturn {
  wallet: Wallet | null;
  isConnected: boolean;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

export function useXRPWallet(): UseXRPWalletReturn {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [balance, setBalance] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const client = new Client('wss://s.altnet.rippletest.net:51233');

  useEffect(() => {
    // Check for stored wallet
    const storedWallet = localStorage.getItem('xrp_wallet');
    if (storedWallet) {
      try {
        const walletData = JSON.parse(storedWallet);
        const restoredWallet = Wallet.fromSeed(walletData.seed);
        setWallet(restoredWallet);
        setIsConnected(true);
        fetchBalance(restoredWallet.address);
      } catch (err) {
        console.error('Failed to restore wallet:', err);
        localStorage.removeItem('xrp_wallet');
      }
    }

    return () => {
      client.disconnect();
    };
  }, []);

  const fetchBalance = async (address: string) => {
    try {
      await client.connect();
      const response = await client.request({
        command: 'account_info',
        account: address,
      });
      const balance = response.result.account_data.Balance || '0';
      setBalance((parseInt(balance) / 1000000).toString()); // Convert drops to XRP
      await client.disconnect();
    } catch (err: any) {
      console.error('Balance fetch error:', err);
      setError(err.message);
    }
  };

  const connect = async () => {
    try {
      setError(null);

      // In production, use Xumm or Web3 wallet connection
      // For demo, we'll generate a test wallet
      const testWallet = Wallet.generate();
      
      setWallet(testWallet);
      setIsConnected(true);

      // Store wallet (in production, use secure storage)
      localStorage.setItem(
        'xrp_wallet',
        JSON.stringify({
          seed: testWallet.seed,
          address: testWallet.address,
        })
      );

      await fetchBalance(testWallet.address);
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setIsConnected(false);
    setBalance('0');
    localStorage.removeItem('xrp_wallet');
  };

  return {
    wallet,
    isConnected,
    balance,
    connect,
    disconnect,
    error,
  };
}

