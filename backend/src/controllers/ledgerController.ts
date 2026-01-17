/**
 * Ledger Controller
 * Manages project event ledger and XRPL synchronization
 */

import { Request, Response } from 'express';
import { XRPLService } from '../services/xrpl/XRPLService';
import { prisma } from '../config/database';

const xrplService = new XRPLService('testnet');

/**
 * Get project ledger events
 * GET /api/projects/:projectId/ledger
 */
export async function getProjectLedger(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Get events from database
    const events = await prisma.ledgerEvent.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    // Optionally sync with XRPL
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (project?.xrp_wallet_address) {
      // In production, periodically sync XRPL events to database
      // This is a simplified version
    }

    res.json({
      events,
      total: events.length,
    });
  } catch (error: any) {
    console.error('Get ledger error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Record a new project event
 * POST /api/projects/:projectId/ledger/events
 */
export async function recordEvent(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { eventType, metadata } = req.body;

    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.xrp_wallet_address) {
      return res.status(400).json({ error: 'User wallet not configured' });
    }

    const wallet = {
      address: user.xrp_wallet_address,
      // In production, retrieve securely
    };

    // Record on XRPL
    const xrplTxHash = await xrplService.logEvent(wallet as any, {
      eventType,
      projectId,
      metadata: {
        ...metadata,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    // Save to database
    const event = await prisma.ledgerEvent.create({
      data: {
        project_id: projectId,
        event_type: eventType,
        xrpl_tx_hash: xrplTxHash,
        event_data: metadata,
      },
    });

    res.json({
      success: true,
      event: {
        id: event.id,
        eventType,
        xrplTxHash,
        createdAt: event.created_at,
      },
    });
  } catch (error: any) {
    console.error('Record event error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get all project actions (comprehensive ledger)
 * GET /api/projects/:projectId/ledger/actions
 */
export async function getAllActions(req: Request, res: Response) {
  try {
    const { projectId } = req.params;

    // Aggregate events from multiple sources
    const [
      ledgerEvents,
      invoices,
      contracts,
      payments,
      images,
      milestones,
    ] = await Promise.all([
      prisma.ledgerEvent.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'desc' },
      }),
      prisma.invoice.findMany({
        where: { project_id: projectId },
        include: {
          workflow: {
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.contract.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          invoice: { project_id: projectId },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.projectImage.findMany({
        where: { project_id: projectId },
        orderBy: { uploaded_at: 'desc' },
      }),
      prisma.milestone.findMany({
        where: { project_id: projectId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // Transform into unified action format
    const actions = [
      ...ledgerEvents.map((e) => ({
        type: 'ledger_event',
        id: e.id,
        eventType: e.event_type,
        timestamp: e.created_at,
        xrplTxHash: e.xrpl_tx_hash,
        data: e.event_data,
      })),
      ...invoices.flatMap((inv) =>
        inv.workflow.map((wf) => ({
          type: 'invoice_workflow',
          id: wf.id,
          eventType: `Invoice${wf.to_status}`,
          timestamp: wf.created_at,
          xrplTxHash: wf.xrpl_tx_hash,
          data: {
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            fromStatus: wf.from_status,
            toStatus: wf.to_status,
          },
        }))
      ),
      ...contracts.map((c) => ({
        type: 'contract_signed',
        id: c.id,
        eventType: 'ContractSigned',
        timestamp: c.signed_at || c.created_at,
        xrplTxHash: c.xrpl_tx_hash,
        data: {
          contractId: c.id,
          contractHash: c.contract_hash,
        },
      })),
      ...payments.map((p) => ({
        type: 'payment',
        id: p.id,
        eventType: 'PaymentExecuted',
        timestamp: p.confirmed_at || p.created_at,
        xrplTxHash: p.xrpl_tx_hash,
        data: {
          invoiceId: p.invoice_id,
          amount: p.amount,
          fromWallet: p.from_wallet,
          toWallet: p.to_wallet,
        },
      })),
      ...images.map((img) => ({
        type: 'image_upload',
        id: img.id,
        eventType: 'ImageUploaded',
        timestamp: img.uploaded_at,
        xrplTxHash: img.xrpl_tx_hash,
        data: {
          sectionId: img.section_id,
          ipfsHash: img.ipfs_hash,
        },
      })),
      ...milestones
        .filter((m) => m.actual_end_date)
        .map((m) => ({
          type: 'milestone_completed',
          id: m.id,
          eventType: 'MilestoneCompleted',
          timestamp: m.actual_end_date,
          xrplTxHash: m.nft_token_id,
          data: {
            milestoneId: m.id,
            name: m.name,
            completionPercentage: m.completion_percentage,
          },
        })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({
      actions,
      total: actions.length,
    });
  } catch (error: any) {
    console.error('Get all actions error:', error);
    res.status(500).json({ error: error.message });
  }
}

