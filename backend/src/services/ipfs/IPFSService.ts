/**
 * IPFS Service
 * Handles file uploads to IPFS (InterPlanetary File System)
 */

import { create } from 'ipfs-http-client';

export class IPFSService {
  private client: any;

  constructor() {
    // Connect to IPFS node
    // In production, use your own IPFS node or Pinata
    this.client = create({
      host: process.env.IPFS_HOST || 'ipfs.infura.io',
      port: 5001,
      protocol: 'https',
      headers: {
        authorization: `Basic ${Buffer.from(
          `${process.env.IPFS_PROJECT_ID}:${process.env.IPFS_PROJECT_SECRET}`
        ).toString('base64')}`,
      },
    });
  }

  /**
   * Upload file to IPFS
   */
  async uploadFile(file: Buffer): Promise<string> {
    try {
      const result = await this.client.add(file);
      return result.cid.toString();
    } catch (error) {
      console.error('IPFS upload error:', error);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  /**
   * Get file from IPFS
   */
  async getFile(cid: string): Promise<Buffer> {
    try {
      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('IPFS get error:', error);
      throw new Error('Failed to retrieve file from IPFS');
    }
  }

  /**
   * Pin file to IPFS (ensure persistence)
   */
  async pinFile(cid: string): Promise<void> {
    try {
      await this.client.pin.add(cid);
    } catch (error) {
      console.error('IPFS pin error:', error);
      // Non-critical, continue
    }
  }
}

