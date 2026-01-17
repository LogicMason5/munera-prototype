/**
 * Shared Invoice Types
 */

export enum InvoiceStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  GC_REVIEWED = 'gc_reviewed',
  REJECTED = 'rejected',
  CERTIFIED = 'certified',
  APPROVED = 'approved',
  PAID = 'paid',
}

export interface Invoice {
  id: string;
  invoice_number: string;
  project_id: string;
  subcontractor_id: string;
  general_contractor_id: string;
  amount: number;
  status: InvoiceStatus;
  invoice_hash?: string;
  xrpl_tx_hash?: string;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceWorkflowStep {
  id: string;
  invoice_id: string;
  from_status: InvoiceStatus;
  to_status: InvoiceStatus;
  actor_id: string;
  xrpl_tx_hash?: string;
  notes?: string;
  created_at: Date;
}

