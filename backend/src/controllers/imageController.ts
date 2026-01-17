/**
 * Image Controller
 * Handles construction site image uploads and mapping to 3D model sections
 */

import { Request, Response } from 'express';
import { IPFSService } from '../services/ipfs/IPFSService';
import { XRPLService } from '../services/xrpl/XRPLService';
import { prisma } from '../config/database';

const ipfsService = new IPFSService();
const xrplService = new XRPLService('testnet');

/**
 * Upload image and map to 3D model section
 * POST /api/projects/:projectId/images
 */
export async function uploadImage(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { sectionId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!sectionId) {
      return res.status(400).json({ error: 'Section ID is required' });
    }

    // 1. Upload image to IPFS
    const ipfsHash = await ipfsService.uploadFile(file.buffer);

    // 2. Get user wallet (from auth middleware)
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.xrp_wallet_address) {
      return res.status(400).json({ error: 'User wallet not configured' });
    }

    // 3. Create wallet instance (in production, get from secure storage)
    // For demo, we'll use a placeholder
    const wallet = {
      address: user.xrp_wallet_address,
      // In production, retrieve private key securely
    };

    // 4. Record on XRPL
    const xrplTxHash = await xrplService.logEvent(wallet as any, {
      eventType: 'ImageUploaded',
      projectId,
      metadata: {
        sectionId,
        ipfsHash,
        uploadedBy: userId,
        timestamp: new Date().toISOString(),
      },
    });

    // 5. Save to database
    const imageRecord = await prisma.projectImage.create({
      data: {
        project_id: projectId,
        section_id: sectionId,
        ipfs_hash: ipfsHash,
        xrpl_tx_hash: xrplTxHash,
        uploaded_by: userId,
      },
    });

    res.json({
      success: true,
      image: {
        id: imageRecord.id,
        ipfsHash,
        xrplTxHash,
        sectionId,
      },
    });
  } catch (error: any) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get images for a project section
 * GET /api/projects/:projectId/images?sectionId=xxx
 */
export async function getImages(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { sectionId } = req.query;

    const where: any = { project_id: projectId };
    if (sectionId) {
      where.section_id = sectionId;
    }

    const images = await prisma.projectImage.findMany({
      where,
      include: {
        uploadedByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        uploaded_at: 'desc',
      },
    });

    res.json({ images });
  } catch (error: any) {
    console.error('Get images error:', error);
    res.status(500).json({ error: error.message });
  }
}

