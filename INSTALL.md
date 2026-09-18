# 🖨️ Print Infinity Agent — Installation Guide

This guide explains how to install and run the **Print Infinity Agent** on your Windows PC. No special software, developer tools, or pre-installed runtimes (.NET or Windows App SDK) are required — everything is self-contained.

---

## 📋 System Requirements

* **Supported Operating Systems**: Windows 11 (all versions) or Windows 10 Version 1809 (Build 17763) or newer.
* **Unsupported**: Windows 7, Windows 8 / 8.1, or Windows 10 versions older than 1809 (these older versions lack the system APIs required by the modern Windows App SDK).

---

## ⚡ Step 1: Download the Right Package for Your PC

We provide two pre-built release packages:
* **`PrintInfinity-Agent-win-x64.zip`** (for regular Intel / AMD processors — **95%+ of Windows PCs**)
* **`PrintInfinity-Agent-win-arm64.zip`** (for ARM-based Windows laptops like Surface Pro X, Snapdragon X Elite, etc.)

> 💡 **How to check your PC type (in 5 seconds):**  
> Go to Windows **Settings** → **System** → **About** (or press `Win + X` and select **System**), then look at **System type**:
> * If it says **"64-bit operating system, x64-based processor"**, download **`PrintInfinity-Agent-win-x64.zip`**.
> * If it says **"ARM-based processor"**, download **`PrintInfinity-Agent-win-arm64.zip`**.

---

## 📂 Step 2: Extract the ZIP

1. Right-click the downloaded `.zip` file in your Downloads folder.
2. Select **Extract All...**.
3. Choose a destination folder (for example: `C:\Users\<YourUser>\AppData\Local\Programs\PrintInfinityAgent` or `Documents\PrintInfinityAgent`).
4. Click **Extract**.

---

## 🚀 Step 3: Run the Application

1. Open the extracted folder.
2. Double-click **`PrintInfinity.Agent.exe`**.

### 🛡️ Windows SmartScreen Warning (First Run Only)

Because this software is open-source and not yet signed with an expensive commercial corporate certificate, Windows SmartScreen may show a blue prompt:
> **"Windows protected your PC"**  
> *Microsoft Defender SmartScreen prevented an unrecognized app from starting.*

**How to proceed:**
1. Click the underlined link **"More info"**.
2. Click the **"Run anyway"** button that appears.

The application will launch immediately. You will only need to do this once.

---

## 🔒 Step 4 (Optional): Verify SHA256 Checksum

If you would like to confirm your download is authentic and has not been corrupted or modified in transit:

1. Download the corresponding `.sha256` checksum file alongside the `.zip`.
2. Open **PowerShell** in the folder where your file was downloaded and run:
   ```powershell
   Get-FileHash .\PrintInfinity-Agent-win-x64.zip -Algorithm SHA256
   ```
3. Ensure the displayed hash matches the string inside `PrintInfinity-Agent-win-x64.zip.sha256`.

---

## ⚙️ First-Time App Setup

1. Sign in with your storekeeper Supabase account credentials.
2. Under **Printers**, select your shop's connected printers and designate them as **Color** or **Black & White**.
3. The app will sit unobtrusively in your **System Tray** and ring/notify you whenever a customer submits and pays for a print job!
