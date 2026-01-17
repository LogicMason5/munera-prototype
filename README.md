# Munera Intelligence – Diligence Platform (Prototype)

**A focused technical prototype demonstrating trust architecture, XRPL integration, and multi-party construction workflows**

---

## Overview

This repository contains a **purpose-built prototype** for the *Munera Intelligence: Diligence* platform.

The goal of this prototype is **not** to deliver a production-ready system, but to **validate core architectural decisions** around:

* Multi-party invoice and approval workflows

* Immutable auditability using the XRP Ledger (XRPL)

* Secure off-chain document storage with on-chain verification

* Event-driven project traceability across stakeholders

The prototype focuses on **one complete trust loop** — from invoice submission to payment execution — and implements only the minimum infrastructure required to demonstrate this flow clearly and correctly.

---

## Prototype Intent (Important)

This prototype is intentionally scoped to answer one question:

> *Can XRPL serve as a reliable, auditable trust layer for construction project diligence while core logic remains off-chain?*

To keep that answer clear, several production concerns (authentication, UI completeness, DevOps, hardening) are **intentionally excluded**.

All omissions are deliberate and map directly to known production implementation paths.

---

## High-Level Architecture

```
Frontend (React / Next.js)

 ├─ Image Upload (mapped to 3D model sections)

 ├─ Invoice Payment Widget

 └─ XRP Wallet Hook

        │

        │ REST / JSON

        ▼

Backend API (Node.js / Express / TypeScript)

 ├─ Invoice Workflow Service

 ├─ Project Ledger Service

 ├─ XRPL Service

 └─ IPFS Service

        │

        ├─ Database (Prisma ORM)

        ├─ XRPL Testnet (events, hashes, payments)

        └─ IPFS (documents & images)
```

### Architectural Principle

* **Off-chain**: documents, images, workflows, business logic

* **On-chain (XRPL)**: hashes, approvals, payments, immutable events

XRPL acts as a **shared trust anchor**, not a data store.

---

## Core Implemented Flows

### 1. Invoice Workflow (End-to-End)

**Lifecycle**

```
DRAFT → SUBMITTED → GC_REVIEWED → CERTIFIED → APPROVED → PAID

                                   ↓

                                REJECTED
```

**What's implemented**

* Invoice upload and metadata persistence

* IPFS document storage

* Hash recording on XRPL

* Role-based workflow transitions

* Event logging for every state change

* XRP payment execution on XRPL testnet

This flow mirrors real construction payment processes and demonstrates how trust, approvals, and settlement are enforced.

---

### 2. Project Ledger (Audit Trail)

All critical project actions are recorded and aggregated into a **unified project ledger**, including:

* Invoice submissions and approvals

* Payments

* Image uploads

* Contract-related events

* Milestones and inspections

The ledger provides:

* Chronological traceability

* XRPL-backed verification

* A foundation for compliance and dispute resolution

---

### 3. Construction Site Image Documentation

* Upload site images

* Map images to specific 3D model sections

* Store files on IPFS

* Record upload proofs on XRPL

* Retrieve images by project or model section

This demonstrates how physical progress can be cryptographically linked to project records.

---

## XRPL Integration Points

XRPL is used selectively and intentionally for:

* Document hash anchoring

* Project event logging

* Multi-step approval verification

* XRP payment execution

* Transaction verification and querying

No large data or business logic is stored on-chain.

---

## Technology Stack

### Backend

* Node.js + TypeScript

* Express.js

* Prisma ORM

* XRPL (`xrpl` SDK)

* IPFS (`ipfs-http-client`)

### Frontend

* React / Next.js

* TypeScript

* Minimal UI components (functional focus)

### Infrastructure

* XRPL Testnet (configurable)

* IPFS (Infura or self-hosted)

* Relational database via Prisma

---

## Project Structure

```
backend/

 ├─ config/          # XRPL & database configuration

 ├─ controllers/     # Image & ledger endpoints

 └─ services/

     ├─ invoice/     # Invoice workflow logic

     ├─ xrpl/        # Blockchain interactions

     └─ ipfs/        # File storage

frontend/

 ├─ components/

 │   ├─ 3d/          # Image uploader

 │   └─ invoice/     # Payment widget

 └─ hooks/

     └─ useXRPWallet.ts

shared/

 └─ types/           # Shared TypeScript definitions
```

---

## API Highlights

### Image Upload

`POST /api/projects/:projectId/images`

* Uploads image to IPFS

* Records hash on XRPL

* Persists metadata

### Project Ledger

`GET /api/projects/:projectId/ledger/actions`

* Returns unified project activity timeline

* Aggregates events from all subsystems

### Payments

`POST /api/payments/execute`

* Executes XRP payment on XRPL testnet

* Records transaction and updates invoice state

---

## Scope Boundaries (Intentional)

The following are **explicitly out of scope** for this prototype:

* Authentication & authorization

* Secure wallet key management

* Production-grade error handling

* Testing suite

* CI/CD and deployment

* UI/UX polish

* Performance optimization

These were excluded to keep focus on **trust flows, ledger integrity, and workflow correctness**.

---

## Path to Production (High-Level)

To evolve this prototype into a production system:

1. Add authentication and role-based access control

2. Harden wallet and key management

3. Complete Prisma schema and migrations

4. Implement XRPL event synchronization

5. Add validation, testing, and monitoring

6. Expand UI and dashboard experiences

The existing architecture is designed to support this evolution without refactoring core logic.

