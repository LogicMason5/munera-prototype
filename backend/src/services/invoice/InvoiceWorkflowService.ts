/**
 * Invoice Workflow Service
 * Manages the invoice approval workflow:
 * Subcontractor → General Contractor → Architect → Project Owner → Payment
 */

import { InvoiceStatus } from '../../../shared/types/invoice.types';
import { XRPLService } from '../xrpl/XRPLService';
import { IPFSService } from '../ipfs/IPFSService';
import { prisma } from '../../config/database';

export interface InvoiceSubmission {
  invoiceNumber: string;
  projectId: string;
  subcontractorId: string;
  generalContractorId: string;
  amount: number;
  file?: Buffer;
  fileHash?: string;
}

export interface InvoiceReview {
  invoiceId: string;
  reviewerId: string;
  decision: 'approve' | 'reject';
  notes?: string;
}

export class InvoiceWorkflowService {
  private xrplService: XRPLService;
  private ipfsService: IPFSService;

  constructor() {
    this.xrplService = new XRPLService('testnet');
    this.ipfsService = new IPFSService();
  }

  /**
   * Step 1: Subcontractor submits invoice
   */
  async submitInvoice(
    submission: InvoiceSubmission,
    wallet: any
  ): Promise<string> {
    // 1. Upload invoice to IPFS
    let ipfsHash = submission.fileHash;
    if (submission.file && !ipfsHash) {
      ipfsHash = await this.ipfsService.uploadFile(submission.file);
    }

    // 2. Create invoice record in database
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: submission.invoiceNumber,
        project_id: submission.projectId,
        subcontractor_id: submission.subcontractorId,
        general_contractor_id: submission.generalContractorId,
        amount: submission.amount,
        invoice_hash: ipfsHash,
        status: InvoiceStatus.SUBMITTED,
      },
    });

    // 3. Record on XRPL
    const xrplTxHash = await this.xrplService.recordDocumentHash(wallet, {
      hash: ipfsHash!,
      documentType: 'invoice',
      documentId: invoice.id,
    });

    // 4. Log event
    await this.xrplService.logEvent(wallet, {
      eventType: 'InvoiceSubmitted',
      projectId: submission.projectId,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: submission.invoiceNumber,
        amount: submission.amount,
        subcontractorId: submission.subcontractorId,
      },
    });

    // 5. Update invoice with XRPL transaction hash
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { xrpl_tx_hash: xrplTxHash },
    });

    // 6. Create workflow entry
    await prisma.invoiceWorkflow.create({
      data: {
        invoice_id: invoice.id,
        from_status: InvoiceStatus.DRAFT,
        to_status: InvoiceStatus.SUBMITTED,
        actor_id: submission.subcontractorId,
        xrpl_tx_hash: xrplTxHash,
      },
    });

    return invoice.id;
  }

  /**
   * Step 2: General Contractor reviews invoice
   */
  async reviewByGeneralContractor(
    review: InvoiceReview,
    wallet: any
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: review.invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.SUBMITTED) {
      throw new Error('Invoice is not in submitted status');
    }

    const newStatus =
      review.decision === 'approve'
        ? InvoiceStatus.GC_REVIEWED
        : InvoiceStatus.REJECTED;

    // Update invoice status
    await prisma.invoice.update({
      where: { id: review.invoiceId },
      data: { status: newStatus },
    });

    // Log event on XRPL
    const xrplTxHash = await this.xrplService.logEvent(wallet, {
      eventType: 'InvoiceReviewed',
      projectId: invoice.project_id,
      metadata: {
        invoiceId: review.invoiceId,
        reviewerId: review.reviewerId,
        decision: review.decision,
        notes: review.notes,
      },
    });

    // Create workflow entry
    await prisma.invoiceWorkflow.create({
      data: {
        invoice_id: review.invoiceId,
        from_status: InvoiceStatus.SUBMITTED,
        to_status: newStatus,
        actor_id: review.reviewerId,
        xrpl_tx_hash: xrplTxHash,
        notes: review.notes,
      },
    });
  }

  /**
   * Step 3: Architect certifies invoice
   */
  async certifyByArchitect(
    invoiceId: string,
    architectId: string,
    wallet: any
  ): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.GC_REVIEWED) {
      throw new Error('Invoice must be reviewed by GC first');
    }

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.CERTIFIED },
    });

    // Create payment certificate
    const certificate = await prisma.paymentCertificate.create({
      data: {
        invoice_id: invoiceId,
        architect_id: architectId,
      },
    });

    // TODO: Mint NFT certificate on XRPL
    // const nftTokenId = await this.xrplService.mintCertificate(...);
    // await prisma.paymentCertificate.update({
    //   where: { id: certificate.id },
    //   data: { nft_token_id: nftTokenId },
    // });

    // Log event
    const xrplTxHash = await this.xrplService.logEvent(wallet, {
      eventType: 'CertificateIssued',
      projectId: invoice.project_id,
      metadata: {
        invoiceId,
        certificateId: certificate.id,
        architectId,
      },
    });

    await prisma.paymentCertificate.update({
      where: { id: certificate.id },
      data: { xrpl_tx_hash: xrplTxHash },
    });

    // Create workflow entry
    await prisma.invoiceWorkflow.create({
      data: {
        invoice_id: invoiceId,
        from_status: InvoiceStatus.GC_REVIEWED,
        to_status: InvoiceStatus.CERTIFIED,
        actor_id: architectId,
        xrpl_tx_hash: xrplTxHash,
      },
    });

    return certificate.id;
  }

  /**
   * Step 4: Project Owner approves payment
   */
  async approveByOwner(
    invoiceId: string,
    ownerId: string,
    wallet: any
  ): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { subcontractor: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.CERTIFIED) {
      throw new Error('Invoice must be certified first');
    }

    // Update status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.APPROVED },
    });

    // Log approval event
    await this.xrplService.logEvent(wallet, {
      eventType: 'PaymentApproved',
      projectId: invoice.project_id,
      metadata: {
        invoiceId,
        ownerId,
        amount: invoice.amount,
      },
    });
  }

  /**
   * Step 5: Execute payment on XRPL
   */
  async executePayment(
    invoiceId: string,
    fromWallet: any,
    toAddress: string
  ): Promise<string> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new Error('Invoice must be approved before payment');
    }

    // Convert amount to XRP (assuming 1 USD = 0.5 XRP for demo)
    const xrpAmount = (invoice.amount * 0.5).toString();

    // Execute payment on XRPL
    const txHash = await this.xrplService.executePayment({
      fromWallet,
      toAddress,
      amount: xrpAmount,
      invoiceId,
      memo: `Payment for invoice ${invoice.invoice_number}`,
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        invoice_id: invoiceId,
        from_wallet: fromWallet.address,
        to_wallet: toAddress,
        amount: invoice.amount,
        xrpl_tx_hash: txHash,
        status: 'confirmed',
        confirmed_at: new Date(),
      },
    });

    // Update invoice status
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    // Log payment event
    await this.xrplService.logEvent(fromWallet, {
      eventType: 'PaymentExecuted',
      projectId: invoice.project_id,
      metadata: {
        invoiceId,
        txHash,
        amount: invoice.amount,
      },
    });

    return txHash;
  }
}

