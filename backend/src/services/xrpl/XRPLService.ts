/**
 * XRPL Service - Core blockchain integration
 * Handles all XRPL transactions, event logging, and payment execution
 */

import { Client, Wallet, Transaction, Payment, Memo } from 'xrpl';
import { XRPL_NETWORK } from '../../config/xrpl';

export interface DocumentHash {
  hash: string;
  documentType: 'contract' | 'invoice';
  documentId: string;
}

export interface ProjectEvent {
  eventType: string;
  projectId: string;
  metadata: Record<string, any>;
}

export interface PaymentRequest {
  fromWallet: Wallet;
  toAddress: string;
  amount: string; // XRP amount as string
  invoiceId: string;
  memo?: string;
}

export class XRPLService {
  private client: Client;
  private network: 'testnet' | 'mainnet';

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.network = network;
    this.client = new Client(
      network === 'testnet'
        ? 'wss://s.altnet.rippletest.net:51233'
        : 'wss://xrplcluster.com'
    );
  }

  /**
   * Connect to XRPL network
   */
  async connect(): Promise<void> {
    await this.client.connect();
    console.log(`Connected to XRPL ${this.network}`);
  }

  /**
   * Disconnect from XRPL network
   */
  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  /**
   * Record document hash on XRPL ledger
   */
  async recordDocumentHash(
    wallet: Wallet,
    documentHash: DocumentHash
  ): Promise<string> {
    const transaction: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address, // Self-payment for memo storage
      Amount: '0',
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('DOC_TYPE').toString('hex'),
            MemoData: Buffer.from(documentHash.documentType).toString('hex'),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('DOC_ID').toString('hex'),
            MemoData: Buffer.from(documentHash.documentId).toString('hex'),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('DOC_HASH').toString('hex'),
            MemoData: Buffer.from(documentHash.hash).toString('hex'),
          },
        },
      ],
    };

    const prepared = await this.client.autofill(transaction);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    if (result.result.meta?.TransactionResult === 'tesSUCCESS') {
      return result.result.hash || '';
    }

    throw new Error(`Transaction failed: ${result.result.meta?.TransactionResult}`);
  }

  /**
   * Log project event on XRPL
   */
  async logEvent(
    wallet: Wallet,
    event: ProjectEvent
  ): Promise<string> {
    const transaction: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: wallet.address,
      Amount: '0',
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('EVENT_TYPE').toString('hex'),
            MemoData: Buffer.from(event.eventType).toString('hex'),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('PROJECT_ID').toString('hex'),
            MemoData: Buffer.from(event.projectId).toString('hex'),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('METADATA').toString('hex'),
            MemoData: Buffer.from(JSON.stringify(event.metadata)).toString('hex'),
          },
        },
      ],
    };

    const prepared = await this.client.autofill(transaction);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    if (result.result.meta?.TransactionResult === 'tesSUCCESS') {
      return result.result.hash || '';
    }

    throw new Error(`Event logging failed: ${result.result.meta?.TransactionResult}`);
  }

  /**
   * Execute payment on XRPL
   */
  async executePayment(payment: PaymentRequest): Promise<string> {
    const transaction: Payment = {
      TransactionType: 'Payment',
      Account: payment.fromWallet.address,
      Destination: payment.toAddress,
      Amount: payment.amount,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('INVOICE_ID').toString('hex'),
            MemoData: Buffer.from(payment.invoiceId).toString('hex'),
          },
        },
        ...(payment.memo
          ? [
              {
                Memo: {
                  MemoType: Buffer.from('MEMO').toString('hex'),
                  MemoData: Buffer.from(payment.memo).toString('hex'),
                },
              },
            ]
          : []),
      ],
    };

    const prepared = await this.client.autofill(transaction);
    const signed = payment.fromWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    if (result.result.meta?.TransactionResult === 'tesSUCCESS') {
      return result.result.hash || '';
    }

    throw new Error(`Payment failed: ${result.result.meta?.TransactionResult}`);
  }

  /**
   * Get wallet balance
   */
  async getBalance(address: string): Promise<string> {
    const response = await this.client.request({
      command: 'account_info',
      account: address,
    });

    return response.result.account_data.Balance || '0';
  }

  /**
   * Query ledger events for a project
   */
  async getLedgerEvents(
    projectWallet: string,
    limit: number = 100
  ): Promise<any[]> {
    const response = await this.client.request({
      command: 'account_tx',
      account: projectWallet,
      limit: limit,
    });

    return response.result.transactions || [];
  }

  /**
   * Verify transaction on ledger
   */
  async verifyTransaction(txHash: string): Promise<boolean> {
    try {
      const response = await this.client.request({
        command: 'tx',
        transaction: txHash,
      });

      return response.result.meta?.TransactionResult === 'tesSUCCESS';
    } catch (error) {
      return false;
    }
  }
}

