# Backend APIs & Serverless Route Handlers

## 1. Route Handlers Index (`/web/src/app/api`)

All endpoints are built using Next.js App Router Node.js/Edge Route Handlers (`route.ts`).

| Endpoint | Method | Auth Scope | Purpose |
| :--- | :---: | :--- | :--- |
| `/api/print-jobs/create` | `POST` | Public (Rate-Limited) | Validates input, inserts `print_jobs` and `payments` records. |
| `/api/print-jobs/status` | `GET` | Customer Token | Retrieves single job record matching `x-customer-token`. |
| `/api/payment/create-order` | `POST` | Public | Generates Razorpay order in INR paise. |
| `/api/payment/verify` | `POST` | Customer Token | Verifies Razorpay payment signature and advances job state. |
| `/api/payment/switch-to-cash` | `POST` | Customer Token | Switches in-flight online order to counter cash payment. |
| `/api/payment/webhook` | `POST` | Razorpay HMAC | Authoritative webhook for payment capture notifications. |
| `/api/store/manage` | `GET/POST`| Public (GET) / Auth (POST) | Fetches public store details or updates storekeeper settings. |
| `/api/store/register` | `POST` | Authenticated | Provisions a new store and links storekeeper profile. |

---

## 2. Detailed API Specifications

### 2.1 Create Print Job (`POST /api/print-jobs/create`)
- **Rate Limit**: 5 requests per 60 seconds per IP address (sliding-window map). Exceeded requests return `429 Too Many Requests` with `Retry-After` header.
- **Request Body**:
  ```json
  {
    "store_id": "a0000000-0000-0000-0000-000000000001",
    "customer_token": "a1b2c3d4e5f6... (16-128 chars)",
    "color_mode": "bw",
    "copies": 1,
    "paper_size": "A4",
    "duplex": false,
    "storage_path": "a0000000-0000-0000-0000-000000000001/doc_172000.pdf",
    "page_count": 5,
    "method": "upi",
    "amount": 15.00,
    "gateway_ref": "order_xyz (optional)"
  }
  ```
- **Validation Rules**:
  - `store_id`: UUID regex (`/^[0-9a-f]{8}-[0-9a-f]{4}...$/i`).
  - `customer_token`: String, length between 16 and 128 characters.
  - `copies`: Integer between 1 and 100.
  - `page_count`: Integer between 1 and 2000.
  - `amount`: Number between 0.01 and 10,000.
  - `storage_path`: Regex `/^[a-f0-9\-]{36}\/[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/`.
  - Extension: Must belong to `ALLOWED_EXTENSIONS` (`pdf, png, jpg, jpeg, webp, doc, docx, ppt, pptx, xls, xlsx, txt, rtf`).
- **Initial Status**:
  - `method == "cash"` $\rightarrow$ `status = "pending_approval"`.
  - `method == "upi"` $\rightarrow$ `status = "pending_payment"`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "job": { "id": "...", "status": "pending_payment", ... },
    "payment": { "id": "...", "amount": 15.00, ... }
  }
  ```

---

### 2.2 Razorpay Webhook (`POST /api/payment/webhook`)
- **Security**: Raw body extraction and HMAC-SHA256 signature verification against `RAZORPAY_WEBHOOK_SECRET`:
  ```typescript
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  ```
- **Events Processed**: `payment.captured`, `order.paid`, `payment_link.paid`.
- **Database Reconciliation**:
  1. Locates matching `payments` record via `gateway_ref` or `notes.print_job_id`.
  2. Updates `payments.status = 'verified'`.
  3. Updates `print_jobs.status = 'pending_approval'` with idempotency constraint:
     ```sql
     UPDATE print_jobs SET status = 'pending_approval'
     WHERE id = :targetJobId AND status = 'pending_payment';
     ```
     *(If the job has already been approved, printed, or completed by the storekeeper, status is safely retained without regression).*

---

### 2.3 Switch to Cash (`POST /api/payment/switch-to-cash`)
- **Purpose**: Enables customers who initiated UPI payment to change to counter payment without re-uploading their files.
- **Request Body**:
  ```json
  {
    "print_job_id": "UUID",
    "customer_token": "string"
  }
  ```
- **Logic**:
  - Validates `print_jobs.status == 'pending_payment'`.
  - Sets `print_jobs.status = 'pending_approval'`.
  - Updates `payments.method = 'cash'`, `payments.gateway_ref = 'CASH_COUNTER'`.

---

### 2.4 Customer Job Status (`GET /api/print-jobs/status`)
- **Query Parameter**: `?id={UUID}`.
- **Header**: `x-customer-token: {TOKEN}`.
- **Security**: Invokes PostgreSQL RPC `get_customer_print_job(p_customer_token)` ensuring anonymous clients can only view jobs matching their authorized session token.
- **Response**: Full job metadata (status, page count, copies, color mode, rejection reason). Never returns storage URLs or file content.
