/**
 * Image Controller
 * Handles construction site image uploads and mapping to 3D model sections
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { IPFSService } from '../services/ipfs/IPFSService';
import { XRPLService } from '../services/xrpl/XRPLService';

const ipfsService = new IPFSService();
const xrplService = new XRPLService('testnet');

/**
 * Extend Express Request to include authenticated user
 */
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

/**
 * Upload image and map to 3D model section
 * POST /api/projects/:projectId/images
 */
export async function uploadImage(
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> {
  try {
    const { projectId } = req.params;
    const { sectionId } = req.body;
    const file = req.file;

    /* -------------------- Validation -------------------- */

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    if (!sectionId) {
      return res.status(400).json({ error: 'Section ID is required' });
    }

    if (!file?.buffer) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    /* -------------------- User & Wallet -------------------- */

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        xrp_wallet_address: true,
      },
    });

    if (!user || !user.xrp_wallet_address) {
      return res
        .status(400)
        .json({ error: 'User XRPL wallet not configured' });
    }

    /* -------------------- Upload to IPFS -------------------- */

    const ipfsHash = await ipfsService.uploadFile(file.buffer);

    /* -------------------- Log Event on XRPL -------------------- */
    /**
     * NOTE:
     * In production:
     * - Retrieve wallet keys from secure vault (AWS KMS, HashiCorp Vault, etc.)
     * - NEVER store private keys in code or DB
     */
    const wallet = {
      address: user.xrp_wallet_address,
    };

    const xrplTxHash = await xrplService.logEvent(wallet as any, {
      eventType: 'ImageUploaded',
      projectId,
      metadata: {
        sectionId,
        ipfsHash,
        uploadedBy: user.id,
        timestamp: new Date().toISOString(),
      },
    });

    /* -------------------- Save to Database -------------------- */

    const imageRecord = await prisma.projectImage.create({
      data: {
        project_id: projectId,
        section_id: sectionId,
        ipfs_hash: ipfsHash,
        xrpl_tx_hash: xrplTxHash,
        uploaded_by: user.id,
      },
      select: {
        id: true,
        ipfs_hash: true,
        xrpl_tx_hash: true,
        section_id: true,
        uploaded_at: true,
      },
    });

    /* -------------------- Response -------------------- */

    return res.status(201).json({
      success: true,
      image: {
        id: imageRecord.id,
        ipfsHash: imageRecord.ipfs_hash,
        xrplTxHash: imageRecord.xrpl_tx_hash,
        sectionId: imageRecord.section_id,
        uploadedAt: imageRecord.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
    });
  }
}

/**
 * Get images for a project (optionally filtered by section)
 * GET /api/projects/:projectId/images?sectionId=xxx*
