# 🧪 Print Infinity — End-to-End Test Plan & Verification Suite

This document establishes the comprehensive test suite, manual QA checklist, and automated validation plan for Print Infinity. It covers all customer and storekeeper touchpoints across the Next.js web application, Supabase Realtime / Edge Functions, and the .NET 8 WinUI 3 Windows Agent.

---

## 📋 Test Matrix & Operational Scenarios Overview

| Test ID | Scenario | Platform / Components | Trigger / Entrypoint | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **E2E-01** | **Successful UPI Print Job** | Web App, Razorpay API, Windows Agent, Physical Printer | Customer scans QR, uploads file, completes UPI payment | Job transitions `pending_payment` -> `pending_approval` -> `completed`. Physical pages spool silently. Storage file deleted. |
| **E2E-02** | **Successful Cash Print Job** | Web App, Storekeeper Dashboard, Windows Agent | Customer selects "Pay Cash at Counter" | Job enters `pending_payment`. Storekeeper collects cash and verifies in dashboard. Agent spools document to printer. |
| **E2E-03** | **Rejected Print Job** | Windows Agent, Storekeeper UI, Customer Live Tracker | Storekeeper identifies corrupt/unreadable file & clicks Reject | Storekeeper inputs reason. Job marked `rejected`. Customer live tracker updates immediately with reason. |
| **E2E-04** | **Expired / Abandoned Job** | Web App, Supabase Database, Storage Bucket | Customer uploads file and abandons checkout (15+ min TTL) | `expire_outdated_print_jobs()` marks row `expired`. Unclaimed file is purged from `print-uploads` bucket. |
| **E2E-05** | **Printer Offline Scenario** | Windows Agent, Print Spooler Service | Customer submits Color or B&W job when matching printer is off | Agent prevents spool failure, issues non-technical guidance to storekeeper. Job stays in queue with retry action. |
| **E2E-06** | **Network Disconnect & Reconnect** | Windows Agent, Supabase Realtime Channel | Store PC drops WiFi/Ethernet connection mid-queue | Agent indicates reconnecting state. Once reconnected, channel auto-reestablishes and syncs missed jobs via REST. |

---

## 🔬 Detailed Scenario Specifications & Checklists

---

### Test Case E2E-01: Successful UPI Print Job
**Objective**: Verify the complete automated flow from customer QR scan, file upload, UPI payment completion via Razorpay webhook, Windows app approval, memory spooling, and file purge.

#### Preconditions
- Store PC is running `PrintInfinity.Agent.exe` and signed into the store account.
- At least one printer matching the job's color mode (`color` or `bw`) is online and mapped in the agent.
- Customer accesses the store URL: `https://<domain>/print?store=<store_id>`.

#### Step-by-Step Execution
1. **Upload**: Customer uploads a multi-page PDF document (e.g., 3 pages).
2. **Settings**: Customer selects:
   - Color Mode: `Black & White`
   - Copies: `1`
   - Paper Size: `A4`
   - Duplex: `Single-sided`
3. **Review**: Customer verifies document appearance in the interactive Live Print Preview.
4. **Checkout**: Customer clicks **Proceed to Payment**, selects **Pay via UPI (Instant Approval)**.
5. **Gateway**: In the Razorpay modal, customer completes UPI payment using test mode UPI ID (`success@razorpay`).
6. **Webhook & Verification**:
   - Razorpay issues `order.paid` / `payment.captured` webhook to `/api/payment/webhook`.
   - Webhook verifies HMAC SHA256 signature and updates `print_jobs.status` from `pending_payment` to `pending_approval`.
7. **Storekeeper Queue Alert**:
   - Windows Agent receives Supabase Realtime event.
   - Windows native toast notification displays: *"New Black & White Print Job (3 pages) waiting for approval"*.
   - Job appears in Live Queue with only metadata: `BW | 1 copy | 3 pages | A4 | ₹15.00` (Zero preview/filename for privacy).
8. **Storekeeper Approval**: Storekeeper clicks **Approve** (or presses keyboard shortcut `Alt + A`).
9. **Printing**:
   - Agent generates fresh short-lived Storage signed URL (valid ≤5 min).
   - Agent streams bytes directly into memory buffer (`MemoryStream` — never written to disk).
   - Agent submits raw byte spool job silently to target printer.
   - Job status updates to `printing` then `completed`.
10. **Tracker & Cleanup**:
    - Customer live tracker page updates in realtime to **"Ready for Pickup"** with celebratory animation.
    - Supabase storage object in `print-uploads` bucket is immediately deleted.

#### Database & System Verification
```sql
-- 1. Check job status and payment record
SELECT id, status, color_mode, copies, storage_path 
FROM public.print_jobs 
WHERE id = '<job_id>';
-- Expected: status = 'completed', storage_path IS NULL or file removed

SELECT id, method, status, amount 
FROM public.payments 
WHERE print_job_id = '<job_id>';
-- Expected: method = 'upi', status = 'verified'
```
- [ ] Pass / Fail: `____________________`

---

### Test Case E2E-02: Successful Cash Print Job
**Objective**: Verify the counter payment flow where customer pays physical cash, storekeeper acknowledges receipt, and job proceeds through approval and printing.

#### Preconditions
- Storekeeper is present at the shop counter with Windows Agent open.
- Customer has mobile device at counter.

#### Step-by-Step Execution
1. **Selection**: Customer uploads document and configures print settings.
2. **Payment Selection**: In Step 5, customer selects **Pay with Cash at Counter**.
3. **Pending Order Creation**:
   - Web app creates `print_jobs` row with `status = 'pending_payment'`.
   - Web app creates `payments` row with `method = 'cash'`, `status = 'pending'`.
4. **Customer Live Tracker**: Customer screen redirects to `/tracker?token=<customer_token>` showing:
   - *"Payment Pending: Please show order code #XXX to the shopkeeper and pay ₹XX.00"*.
5. **Storekeeper Acknowledgment**:
   - Customer approaches counter and pays cash.
   - Storekeeper locates the job order code in the Cash Approvals section or Admin dashboard.
   - Storekeeper clicks **Confirm Cash Received**.
6. **State Transition**:
   - Payment status updates to `verified`.
   - Job status advances to `pending_approval`.
7. **Queue Arrival & Print**:
   - Job appears in the Windows Agent active queue.
   - Storekeeper clicks **Approve** -> Agent spools document directly to printer.
8. **Completion**:
   - Job updates to `completed`.
   - Customer tracker updates to *"Your prints are ready!"*.

#### Database Verification
```sql
SELECT pj.status AS job_status, p.method, p.status AS payment_status 
FROM public.print_jobs pj
JOIN public.payments p ON p.print_job_id = pj.id
WHERE pj.customer_token = '<customer_token>';
-- Expected: job_status = 'completed', method = 'cash', payment_status = 'verified'
```
- [ ] Pass / Fail: `____________________`

---

### Test Case E2E-03: Rejected Job Flow
**Objective**: Verify that when a shopkeeper rejects a job (e.g. illegible resolution, damaged pages, unsupported custom size), the storekeeper must supply a reason, and the customer is immediately notified without printing.

#### Preconditions
- Active job waiting in `pending_approval` state.
- Customer is viewing their live order tracker on mobile.

#### Step-by-Step Execution
1. **Inspection**: Storekeeper inspects the job metadata in Windows Agent queue (e.g., storekeeper recognizes shop is out of 100gsm parchment paper or special size requested).
2. **Rejection Trigger**: Storekeeper clicks **Reject** (or presses keyboard shortcut `Alt + R`).
3. **Reason Modal**:
   - Modal dialog prompts: *"Enter reason for rejection (required)"*.
   - Storekeeper types: *"Shop currently out of Glossy Photo Paper. Please select Plain Paper or request a cash refund."*
   - Storekeeper clicks **Confirm Rejection**.
4. **Agent Action**:
   - Agent updates `print_jobs` table:
     - `status = 'rejected'`
     - `rejection_reason = 'Shop currently out of Glossy Photo Paper...'`
   - Agent deletes the uploaded document from Supabase Storage to protect privacy.
5. **Customer Tracker Notification**:
   - Customer's live tracker receives Realtime update.
   - Tracker immediately turns red/amber with an alert:
     *"Job Rejected by Store: Shop currently out of Glossy Photo Paper. Please select Plain Paper or request a cash refund."*
   - Customer is given a **"Start New Print"** button.

#### Database Verification
```sql
SELECT status, rejection_reason, storage_path 
FROM public.print_jobs 
WHERE id = '<job_id>';
-- Expected: status = 'rejected', rejection_reason IS NOT NULL, storage_path IS NULL
```
- [ ] Pass / Fail: `____________________`

---

### Test Case E2E-04: Expired / Abandoned Job Cleanup
**Objective**: Ensure that customer files abandoned before payment do not linger on servers or compromise privacy, and are cleaned up within the 15-minute TTL.

#### Preconditions
- Customer uploaded a file to `print-uploads` bucket.
- Job created with `storage_expires_at = NOW() + INTERVAL '15 minutes'`.
- Customer closes the browser tab and never completes payment.

#### Step-by-Step Execution
1. Simulate expiration by advancing `storage_expires_at` into the past:
   ```sql
   UPDATE public.print_jobs 
   SET storage_expires_at = NOW() - INTERVAL '1 minute'
   WHERE id = '<abandoned_job_id>';
   ```
2. Invoke the automated expiration procedure:
   ```sql
   SELECT * FROM public.expire_outdated_print_jobs();
   ```
3. **Verification**:
   - Target row status transitions to `'expired'`.
   - File is marked for cleanup or Edge Function `cleanup-expired-uploads` deletes the bucket object.
4. If customer re-opens the tracker URL:
   - Web application displays: *"This print session has expired. Uploaded files have been permanently deleted for your security."*

#### Database Verification
```sql
SELECT id, status, storage_expires_at 
FROM public.print_jobs 
WHERE id = '<abandoned_job_id>';
-- Expected: status = 'expired'
```
- [ ] Pass / Fail: `____________________`

---

### Test Case E2E-05: Printer Offline Scenario
**Objective**: Verify agent resilience when all printers matching the job's color mode are powered off, out of paper, unplugged, or have a stopped Windows print spooler service.

#### Preconditions
- All configured Color printers in Windows are paused, turned off, or unplugged.
- Storekeeper is running the Windows Agent.

#### Step-by-Step Execution
1. Customer submits a Color print job.
2. Job arrives in the Windows Agent queue.
3. Storekeeper clicks **Approve**.
4. **Agent Printer Resolution**:
   - Agent scans active Windows printers tagged as `color` with `is_online = true`.
   - Agent finds 0 active matches.
5. **Storekeeper Guidance**:
   - The app does NOT crash or silently fail.
   - An informative alert dialog is displayed:
     *"No online Color printer detected. Please verify printer power and USB/WiFi connection, or open Printer Setup to assign an available printer."*
   - The job remains in the queue with a **Retry** button so it is not lost once the printer is powered on.

- [ ] Pass / Fail: `____________________`

---

### Test Case E2E-06: Windows App Network Loss & Auto-Reconnect Mid-Queue
**Objective**: Verify that the shop's PC handles intermittent WiFi / broadband dropouts without losing pending jobs or getting out of sync with Supabase Realtime.

#### Preconditions
- Windows Agent is actively monitoring the queue.
- Network connection to the shop PC can be toggled (e.g. disable WiFi adapter or unplug Ethernet).

#### Step-by-Step Execution
1. **Network Disconnect**:
   - Disconnect the PC's network adapter.
2. **UI Indicator**:
   - Supabase Realtime channel signals disconnection.
   - Windows Agent displays an amber status banner:
     *"⚠️ Connection lost. Retrying connection to print queue..."*
3. **Incoming Job During Outage**:
   - Customer submits and pays for a print job via their phone (phone has active 4G/5G).
   - Supabase backend registers the job in `pending_approval`.
4. **Network Reconnection**:
   - Re-enable the PC's network adapter.
5. **Automatic Synchronization**:
   - Agent's Realtime listener auto-reconnects with exponential backoff.
   - Agent triggers a REST reconciliation query (`SELECT * FROM print_jobs WHERE store_id = ... AND status = 'pending_approval'`).
   - The pending job submitted during the outage immediately appears in the queue with a notification toast.
   - Status banner turns green: *"Connected to Live Queue"*.

- [ ] Pass / Fail: `____________________`

---

## 🤖 Automated Test Script Suite (`scratch/test_e2e_scenarios.mjs`)

You can run automated verification of all core API transitions, payment webhooks, token security, and RLS enforcement using Node.js:

```bash
node scratch/test_e2e_scenarios.mjs
```

### What the Automated Suite Asserts:
1. **Job Creation**: Verifies rate-limiting, field validation (rejects invalid color modes, copies < 1, oversized documents).
2. **UPI Order & Webhook**: Generates Razorpay order, crafts valid HMAC SHA256 webhook signature, verifies state transition to `pending_approval`.
3. **Cash Order Workflow**: Creates counter cash order, verifies pending payment state.
4. **Customer Token Isolation**: Asserts that customer A cannot access or query customer B's print job using token isolation.
5. **Expiration Procedure**: Asserts `expire_outdated_print_jobs()` properly flags stale jobs.
