/**
 * Invoice Payment Component
 * Handles payment execution on XRPL testnet
 */

'use client';

import { useState } from 'react';
import { useXRPWallet } from '../../hooks/useXRPWallet';

interface InvoicePaymentProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  toAddress: string;
  onPaymentComplete?: (txHash: string) => void;
}

export default function InvoicePayment({
  invoiceId,
  invoiceNumber,
  amount,
  toAddress,
  onPaymentComplete,
}: InvoicePaymentProps) {
  const { wallet, connect, isConnected, balance } = useXRPWallet();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const xrpAmount = (amount * 0.5).toFixed(6); // Demo conversion rate

  const handlePayment = async () => {
    if (!isConnected || !wallet) {
      await connect();
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Approve payment (update invoice status)
      const approveResponse = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!approveResponse.ok) {
        throw new Error('Failed to approve invoice');
      }

      // 2. Execute payment on XRPL
      const paymentResponse = await fetch(`/api/payments/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId,
          toAddress,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      const { txHash } = await paymentResponse.json();

      if (onPaymentComplete) {
        onPaymentComplete(txHash);
      }

      alert(`Payment successful! Transaction: ${txHash}`);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="payment-widget p-4 border rounded-lg">
        <p className="text-sm text-gray-600 mb-4">
          Connect your XRP wallet to execute payment
        </p>
        <button
          onClick={connect}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          Connect XRP Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="payment-widget p-4 border rounded-lg space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Execute Payment</h3>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Invoice:</span>
            <span className="font-mono">{invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-semibold">${amount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">XRP Amount:</span>
            <span className="font-semibold">{xrpAmount} XRP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Recipient:</span>
            <span className="font-mono text-xs">{toAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Your Balance:</span>
            <span className="font-semibold">{balance} XRP</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={processing || parseFloat(balance) < parseFloat(xrpAmount)}
        className={`
          w-full py-2 px-4 rounded font-medium
          ${
            processing || parseFloat(balance) < parseFloat(xrpAmount)
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }
        `}
      >
        {processing ? 'Processing...' : 'Execute Payment'}
      </button>

      {parseFloat(balance) < parseFloat(xrpAmount) && (
        <p className="text-xs text-red-600 text-center">
          Insufficient balance. You need {xrpAmount} XRP.
        </p>
      )}
    </div>
  );
}

