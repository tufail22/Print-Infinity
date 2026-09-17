# 🚀 Print Infinity — Complete Setup & Deployment Guide

This guide covers everything required to onboard a new store to the **Print Infinity** platform: configuring the Supabase database, generating the store's physical counter QR code, installing the Windows PC Agent, and tagging printers as Color or Black & White.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Step 1: Create Store & Storekeeper in Supabase](#-step-1-create-store--storekeeper-in-supabase)
3. [Step 2: Generate & Print the Counter QR Code](#-step-2-generate--print-the-counter-qr-code)
4. [Step 3: Install the Windows App on the Shop PC](#-step-3-install-the-windows-app-on-the-shop-pc)
5. [Step 4: Tag Printers as Color / B&W](#-step-4-tag-printers-as-color--bw)
6. [Step 5: Store Profile & Pricing Management (/admin)](#-step-5-store-profile--pricing-management-admin)
7. [Appendix: Deploying the Web App to Vercel](#-appendix-deploying-the-web-app-to-vercel)

---

## 🏗 Architecture Overview

Print Infinity consists of three integrated components:
1. **Customer Web App (Next.js)**: Runs on customer mobile browsers via QR scan. Customers upload documents, configure print settings, preview pages, and pay via UPI or Cash.
2. **Supabase Cloud Backend**: Handles PostgreSQL database, Row Level Security (RLS), Realtime WebSocket event broadcasting, and private storage with short-lived signed URLs.
3. **Print Infinity Agent (WinUI 3 / .NET 8)**: Runs silently on the shop counter PC. Listens to the live queue in the system tray, auto-selects the tagged printer, and spools print jobs straight to hardware via in-memory buffers.

---

## 🏬 Step 1: Create Store & Storekeeper in Supabase

### 1.1 Insert Store Record
Open your [Supabase Dashboard](https://supabase.com/dashboard) -> **SQL Editor**, and run the following query to register your store:

```sql
-- Insert new store record
INSERT INTO public.stores (id, name, address, active, bw_price_per_page, color_price_per_page)
VALUES (
    'a0000000-0000-0000-0000-000000000001', -- Custom UUID or use gen_random_uuid()
    'Print Infinity — Downtown Express',
    'Shop #4, Metro Walk Commercial Hub, Main Street',
    TRUE,
    2.00,  -- Default B&W price per page (₹2.00)
    10.00  -- Default Color price per page (₹10.00)
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    bw_price_per_page = EXCLUDED.bw_price_per_page,
    color_price_per_page = EXCLUDED.color_price_per_page;
```
> 💡 **Save the Store ID**: In the example above, `a0000000-0000-0000-0000-000000000001` is your `STORE_ID`. You will need this for the QR code.

### 1.2 Create Storekeeper Account in Supabase Auth
1. Go to **Authentication** -> **Users** -> Click **Add User** -> **Create User**.
2. Enter the shopkeeper's email (e.g., `shop1@printinfinity.in`) and a secure password.
3. Check **Auto Confirm Email**.
4. Click **Create User**.
5. Copy the newly created user's **User UID** (e.g., `c1111111-1111-1111-1111-111111111111`).

### 1.3 Link Storekeeper to Store
Back in the **SQL Editor**, link the Auth user to the store:

```sql
INSERT INTO public.storekeepers (id, store_id, role)
VALUES (
    'c1111111-1111-1111-1111-111111111111', -- User UID from step 1.2
    'a0000000-0000-0000-0000-000000000001', -- STORE_ID from step 1.1
    'storekeeper'
)
ON CONFLICT (id) DO UPDATE SET store_id = EXCLUDED.store_id;
```

---

## 📱 Step 2: Generate & Print the Counter QR Code

Customers scan a physical QR code placed at your counter to open the web app pre-configured for your store.

### 2.1 Construct the URL
Format:
```
https://<your-deployed-domain>.vercel.app/print?store=<STORE_ID>
```
**Example**:
```
https://printinfinity.vercel.app/print?store=a0000000-0000-0000-0000-000000000001
```

### 2.2 Generate the QR Code Image
You can generate a high-resolution QR code using:
1. **Online Generator**: Visit [qr-code-generator.com](https://www.qr-code-generator.com/) or [qrcode-monkey.com](https://www.qrcode-monkey.com/), paste the URL, and download as PNG/SVG.
2. **Terminal / Node.js**:
   ```bash
   npx qrcode "https://printinfinity.vercel.app/print?store=a0000000-0000-0000-0000-000000000001" -o store_counter_qr.png
   ```

### 2.3 Physical Counter Display Recommendations
- Print the QR code on an **A5 or A6 acrylic tent card / standee**.
- Include clear instructions:
  - *"📷 Scan QR to Print Instantly from your Phone"*
  - *"1. Upload PDF or Photos"*
  - *"2. Choose Color / B&W & Number of Copies"*
  - *"3. Pay via UPI or Cash at Counter"*
  - *"4. Collect your prints right here!"*

---

## 💻 Step 3: Install the Windows App on the Shop PC

The **Print Infinity Agent** runs on the PC connected to your counter printers.

### 3.1 Run the 1-Click Installer
1. Copy the `windows-app` folder (or published release package) to the shop PC.
2. Double-click **`Install-PrintInfinityAgent.bat`**.
3. The installer will automatically:
   - Copy the application to `%LocalAppData%\Programs\PrintInfinityAgent`.
   - Create a desktop shortcut: **Print Infinity Agent**.
   - Create a Start Menu entry: **Print Infinity**.
   - Register the app in Windows Startup with `--tray` so it **starts automatically in the background on every PC boot**.
   - Launch the application.

### 3.2 Sign In
1. On the login screen, enter the storekeeper credentials created in [Step 1.2](#12-create-storekeeper-account-in-supabase-auth).
2. Click **Sign In to Store**.
3. Credentials are encrypted and saved to the **Windows Credential Locker (DPAPI)**. The shopkeeper never needs to type the password again.

### 3.3 Always-On Tray Mode
- Closing or minimizing the application sends it directly to the **Windows System Tray** (near the clock).
- When a customer submits an order, a native Windows chime and toast notification appears.
- Clicking the notification or tray icon brings the queue to the front.

---

## 🖨️ Step 4: Tag Printers as Color / B&W

Print Infinity automatically routes incoming jobs based on the color mode selected by the customer.

1. In the Windows Agent, open the **Printer Setup** tab on the left sidebar.
2. The app queries Windows and lists every installed printer (USB, Network WiFi, Thermal).
3. **Tag each printer**:
   - For your color printer (e.g. *Canon imageRUNNER Color* or *Epson L3250*):
     - Toggle Type to: **Color**
     - Select Connection: **WiFi** or **USB**
   - For your high-speed monochrome printer (e.g. *HP LaserJet Pro M404dn*):
     - Toggle Type to: **Black & White**
     - Select Connection: **USB**
4. Click **Save Configuration**.
5. The settings are saved to the `public.printers` table and cached locally.
6. Click **Test Print** to print a sample test page and verify spooler communication.

> ⚠️ **Routing Rules**:
> - If a customer orders a B&W job, the agent will **only** send it to an online Black & White printer.
> - If a customer orders a Color job, the agent will **only** send it to an online Color printer.
> - If the designated printer is turned off or out of paper, the agent notifies the storekeeper with a friendly alert and holds the job in queue with a **Retry** button.

---

## ⚙️ Step 5: Store Profile & Pricing Management (/admin)

Storekeepers can manage store details without writing SQL:
1. Navigate to `https://<your-vercel-domain>.vercel.app/admin` in any browser.
2. Sign in with the storekeeper credentials.
3. From the **Storekeeper Admin Portal**, you can:
   - **Update Store Name & Address**.
   - **Set B&W Rate Per Page** (e.g., ₹2.00).
   - **Set Color Rate Per Page** (e.g., ₹10.00).
   - **Upload Store Logo** (displayed on the customer landing page).
4. Click **Save Store Settings**. Changes take effect immediately for all new customer QR scans!

---

## 🌐 Appendix: Deploying the Web App to Vercel

### Option A: 1-Click Import via Vercel Dashboard (Recommended)
1. Push this repository to GitHub.
2. Log into [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
3. Import your GitHub repository (`Print-Infinity`).
4. Configure Project Settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Select `web` (or leave as root if using the included `vercel.json`).
5. Open the **Environment Variables** section and copy the variables from `web/.env.example`:
   - `NEXT_PUBLIC_SUPABASE_PROJECT_ID`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(Mark as Server-only!)*
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET` *(Mark as Server-only!)*
   - `RAZORPAY_WEBHOOK_SECRET` *(Mark as Server-only!)*
6. Click **Deploy**.

### Option B: Deploy via Vercel CLI
```bash
cd web
npx vercel
```
Follow the interactive prompts to link your project and deploy.

### Configuring Razorpay Webhook in Production
1. In your [Razorpay Dashboard](https://dashboard.razorpay.com/) -> **Settings** -> **Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL**: `https://<your-vercel-domain>.vercel.app/api/payment/webhook`
4. **Secret**: Enter the value of `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events**: Check `payment.captured` and `order.paid`.
6. Click **Save Webhook**.
