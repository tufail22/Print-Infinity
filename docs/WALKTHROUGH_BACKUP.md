# Print Infinity — Customer Web App (`/web`) Walkthrough

The mobile-first customer-facing web application for **Print Infinity** has been built and tested in Next.js 14 App Router.

**Local Host URL**: [http://localhost:3000/print?store=a0000000-0000-0000-0000-000000000001](http://localhost:3000/print?store=a0000000-0000-0000-0000-000000000001)

---

## 📱 Implemented Screens & Features

### Screen 1: Store Landing
- **Animated Branding**: Store logo with glow pulse, live store status badge (**"Printer Online & Ready"**), store name, and address.
- **Center Call to Action**: Prominent `"Upload Your Document to Print"` button leading directly into the flow.
- **Trust Highlights**: Cards showcasing zero-disk memory streaming and instant UPI/Cash settlement.

### Screen 2: Multi-File Upload Zone
- **Formats Supported**: PDF, Word (`.doc`, `.docx`), PowerPoint (`.ppt`, `.pptx`), Images (`.jpg`, `.png`, `.webp`), and text documents.
- **Client-Side Validation**:
  - Validates file extensions before acceptance.
  - Enforces strict **100MB file size ceiling** with informative alert cards.
- **PDF Page Count Detection**: Uses client-side binary stream parsing (`pdfUtils.ts`) to count pages instantaneously.
- **Client-Side Image Compression**: Automatically compresses raster images over ~2MB using the HTML Canvas API (`imageCompressor.ts`) before upload.
- **File Chips**: Displays thumbnail preview, page count badge, formatted size, and remove button.

### Screen 3: Advanced Print Settings & Live Pricing
- **Color Mode**: Big interactive cards for **Black & White** (₹2.00/page) vs **Full Color** (₹10.00/page). Employs distinct icons, checkmarks, and typography to satisfy accessibility standards without relying on color alone.
- **Copies Stepper**: `-` and `+` controls with direct numeric quantity tracking.
- **Paper Sizes**: A4 (standard default), Letter, Legal, A3 (large), A5, B5, Tabloid.
- **Custom Paper Size**: Dedicated sub-panel allowing customers to define exact dimensions in **centimeters (cm)** or **inches (in)**.
- **Orientation**: Portrait vs Landscape with visual aspect-ratio cards.
- **Duplex Options**: Single-sided vs Double-sided (2-sided).
- **Page Ranges**: All pages, Odd pages only, Even pages only, Custom range input (`e.g. 1-3, 5, 8`), and **"Reverse order"** print toggle.
- **Size & Layout**:
  - Pages Per Sheet (N-Up): 1, 2, 4, 6, 9 pages on 1 sheet.
  - Document Output Mode: Singly, Multiple, Poster, Booklet.
  - Image Scaling: Fit to printable area, Fill page, or 100% Actual size.
  - Margins: Normal, Narrow, Wide, None/Borderless.
  - Print Quality: Eco/Draft, Standard, High, Best Photo.
- **⚡ Smart Auto-Tune**: One-click intelligence button that analyzes the document and automatically sets optimal error-free printer settings.
- **Live Estimated Price Card**: Real-time calculated total breakdown displaying rate per page, total sheets needed, duplex savings, and final total.

### Screen 4: Payment Selector
- **Pay with UPI QR**:
  - Dynamically renders a high-contrast UPI QR code (`qrcode` library) encoding `upi://pay?pa=...&am=...`.
  - Gateway verification simulation button allowing instant testing.
- **Pay Cash at Counter**:
  - Submits job immediately with `payment.method = 'cash'` and `payment.status = 'pending'`, allowing the storekeeper to approve upon physical cash handover.

### Screen 5: Live Order Tracker (Supabase Realtime)
- **Zero Credentials Exposure**: Subscribes directly to Supabase Realtime using the client-generated ephemeral `customer_token`.
- **Live Lifecycle Stepper**:
  - `pending_approval` ➔ `approved` ➔ `printing` ➔ `completed`
- **Celebration**: Triggers celebratory confetti upon reaching `completed`.
- **Receipt Details**: Displays order ticket ID, token prefix, print configuration summary, and zero-disk privacy commitment.

---

## 🔒 Security & Performance Features

- **Ephemeral Customer Token**: 192-bit cryptographic random token generated client-side at session start, stored strictly in memory and `sessionStorage`.
- **Direct Storage Upload**: Uploads directly to private `print-uploads` bucket via Supabase anon client with RLS.
- **SEO & Meta**: Descriptive titles, OpenGraph metadata, and mobile viewports in `/print/layout.tsx`.
- **Accessibility**: Full keyboard focus rings, ARIA roles, and screen-reader compliant labeling.

---

## 🧪 Build & Verification

- **Production Build**: Verified with `npm run build`.
  ```
  ✓ Compiled successfully
  ✓ Generating static pages (5/5)
  Route (app) /print: 93.4 kB
  ```
- **Local Server**: Running and healthy at `http://localhost:3000/print`.
