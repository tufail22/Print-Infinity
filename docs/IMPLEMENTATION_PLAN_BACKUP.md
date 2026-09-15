# Implementation Plan - Customer Mobile Web App (`/web`)

Build a modern, mobile-first single-flow customer printing wizard on `/print?store=<store_id>` in Next.js 14 App Router, connected directly to Supabase storage and database with live Realtime status tracking.

## User Review Required

> [!NOTE]
> - Route `/print` will auto-detect the `store` query parameter. If omitted, it will automatically query Supabase for the first active store (`a0000000-0000-0000-0000-000000000001`) from seed data for a seamless dev experience.
> - Client-side image compression is performed with HTML Canvas API (zero heavy dependencies, fast on mobile).
> - PDF page counting is handled via pure client-side PDF inspection (parsing `%PDF` page catalog markers and `/Count` headers for lightweight instantaneous page counts without bulky external bundles).

## Proposed Architecture & UI Flow

```
/print?store=<store_id>
  │
  ├── Step 1: Store Landing (Animated store badge, online status, "Upload your document to print" CTA)
  ├── Step 2: Document Upload (Drag & tap, multi-file, PDF/Word/PPT/Images, client-side validation, 100MB cap, image compression, page counter, upload progress)
  ├── Step 3: Advanced Print Settings (Color mode toggle, copies stepper, comprehensive paper sizes + Custom in cm/inch, orientation, duplex, page ranges + odd/even + reverse, layout/n-up, booklet/poster, quality, Smart Auto-Tune button, live pricing)
  ├── Step 4: Payment Selection (Cash at counter vs. UPI with dynamic QR code & status simulation)
  └── Step 5: Live Order Tracker (Realtime subscription on customer_token, animated progress from pending_approval -> approved -> printing -> completed)
```

## Proposed Changes

### Web Application (`/web`)

#### [NEW] Dependencies in `web/package.json`
- Ensure `@supabase/supabase-js`, `lucide-react`, `canvas-confetti` (for celebratory completion), `qrcode` (for rendering dynamic UPI QR codes) are installed.

#### [NEW] [web/src/config/pricing.ts](file:///d:/Print%20Infinty%202.0/web/src/config/pricing.ts)
- Editable price rate configuration (base rates per page for B&W vs Color, paper size multipliers for A3/custom, duplex discounts, and quality surcharges).

#### [NEW] [web/src/lib/pdfUtils.ts](file:///d:/Print%20Infinty%202.0/web/src/lib/pdfUtils.ts)
- Fast, client-side lightweight PDF page count extractor reading binary stream metadata.

#### [NEW] [web/src/lib/imageCompressor.ts](file:///d:/Print%20Infinty%202.0/web/src/lib/imageCompressor.ts)
- Client-side image compressor reducing files >2MB before upload to save customer bandwidth.

#### [NEW] [web/src/lib/tokenManager.ts](file:///d:/Print%20Infinty%202.0/web/src/lib/tokenManager.ts)
- Ephemeral session `customer_token` generator and manager in memory / `sessionStorage`.

#### [NEW] UI Components (`web/src/components/print/`)
- `StoreHeader.tsx`: Store logo with pulse animation, store name, address, and live status.
- `UploadZone.tsx`: Tap & drag file dropzone, file chips with page count, file size, thumbnail preview, 100MB cap checks.
- `SettingsSheet.tsx`:
  - Color mode pill toggle (with B&W / Color icons, accessible aria labels).
  - Copies stepper (`-` / `+` buttons).
  - Paper Size picker (A4 default, Letter, Legal, A3, A5, B5, Tabloid, and **Custom Size** in cm / inches).
  - Page Range selector (All, Odd, Even, Custom Range, Reverse Order).
  - Multi-page layout (1-up, 2-up, 4-up, booklet, poster).
  - Quality selector (Eco, Standard, High, Best).
  - **"Smart Auto-Tune"** button to automatically detect document type and apply error-free optimal settings.
  - Live price estimate card with detailed breakdown.
- `PaymentSelector.tsx`: Two prominent interactive cards ("Pay with UPI" with dynamic QR generator, "Pay with Cash at counter").
- `LiveTracker.tsx`: Live status stepper subscribed to Supabase Realtime via `customer_token`.

#### [NEW] [web/src/app/print/page.tsx](file:///d:/Print%20Infinty%202.0/web/src/app/print/page.tsx)
- Mobile-first single-flow wizard with smooth step transitions, sticky bottom navigation bar, and state management.

#### [NEW] [web/src/app/print/layout.tsx](file:///d:/Print%20Infinty%202.0/web/src/app/print/layout.tsx)
- SEO meta tags (title, description, viewport, OpenGraph metadata).

## Verification Plan

### Automated / Build Verification
- Install required packages in `/web`.
- Run Next.js build or TypeScript type-check (`npm run build` or `npx tsc --noEmit`).

### End-to-End Browser Testing
- Run Next.js development server on `http://localhost:3000`.
- Use the **Browser Subagent** tool to navigate to `http://localhost:3000/print?store=a0000000-0000-0000-0000-000000000001`.
- Step through the entire wizard:
  1. Landing screen verification.
  2. Upload a sample document.
  3. Customize print settings (Color, Copies, Custom paper size, Multi-page, Smart Auto-Tune).
  4. Select payment (Cash and UPI QR generation).
  5. View confirmation and Realtime subscription tracking state.
- Capture screenshots for each step to embed in the `walkthrough.md`.
